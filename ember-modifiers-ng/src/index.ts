import { getOwner } from '@ember/owner';
import { assert } from '@ember/debug';
import { registerDestructor } from '@ember/destroyable';
import { createCache, getValue } from '@glimmer/tracking/primitives/cache';
import Modifier from 'ember-modifier';
import { TrackedArray } from 'tracked-built-ins';
import type {
  CreateModifier,
  Dict,
  ElementClass,
  JsPropertyKey,
  ModifierContext,
  TrackedCache,
} from './types';

export const createModifier = <
  const Named extends Dict,
  const Positional = [],
  El extends Element = Element,
>(
  blueprint: (context: ModifierContext<El, Named>) => void,
  options?: { element?: ElementClass; positional: Positional } | undefined,
): ReturnType<CreateModifier<El, Named>> => {
  class ModifierClass extends Modifier {
    #initialized: undefined | { element: El; cache: TrackedCache<void> };

    modify(element: El, positional: unknown[], named: Dict) {
      if (this.#initialized) {
        getValue(this.#initialized.cache);
        return;
      }

      const args = buildArgs(
        positional,
        named,
        options?.positional as JsPropertyKey[],
      ) as Named;

      const state = new ModifierState(element, args, this);

      blueprint(state.context);

      assert(
        `Element must be an instance of ${options?.element?.name}`,
        !options?.element || element instanceof options.element,
      );

      const cache = createCache(() => {
        for (const onSync of state.onSyncs) {
          getValue(onSync);
        }
      });

      this.#initialized = { element, cache };

      getValue(cache);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ModifierClass as any;
};

class ModifierState<El extends Element, Args extends Dict> {
  #element: El;
  #args: Args;
  #parent: object;

  context: ModifierContext<El, Args>;
  onSyncs: TrackedArray<TrackedCache<void>> = new TrackedArray();

  constructor(element: El, args: Args, parent: object) {
    this.#element = element;
    this.#args = args;
    this.#parent = parent;

    const owner = getOwner(parent);
    assert(`BUG: A modifier is expected to have an Ember owner`, owner);

    this.context = {
      service: <T>(name: string): T => {
        return owner.lookup(`service:${name}`) as T;
      },
      on: { sync: this.#addOnSync },
    };
  }

  #addOnSync = (
    callback: (element: El, args: Args) => undefined | void | (() => void),
  ) => {
    let lastCleanup: undefined | void | (() => void);

    registerDestructor(this.#parent, () => {
      lastCleanup?.();
    });

    this.onSyncs.push(
      createCache(() => {
        lastCleanup?.();
        lastCleanup = callback(this.#element, this.#args);
      }),
    );
  };
}

/**
 * If positional arguments are specified, create a new args proxy that converts
 * them into named arguments.
 *
 * The behavior of the returned args object is the same as the behavior of the
 * Ember args proxy, with positional arguments mapped to the specified named
 * arguments..
 */
function buildArgs(
  this: void,
  positional: unknown[],
  named: Dict,
  positionalNames: JsPropertyKey[] | undefined,
): Dict {
  return positionalNames
    ? (new Proxy(
        {},
        {
          get(_target, key) {
            const positionalIndex = positionalNames.indexOf(key);
            if (positionalIndex !== -1) {
              return positional[positionalIndex];
            }

            return Reflect.get(named, key);
          },
          has(_target, key) {
            const positionalIndex = positional.indexOf(key);
            return positionalIndex !== -1 || Reflect.has(named, key);
          },
          ownKeys() {
            return [...positionalNames, ...Reflect.ownKeys(named)];
          },
          getOwnPropertyDescriptor(_target, key) {
            const positionalIndex = positionalNames.indexOf(key);

            if (positionalIndex !== -1) {
              return {
                enumerable: true,
                configurable: true,
                value: positional[positionalIndex],
              };
            }

            return Reflect.getOwnPropertyDescriptor(named, key);
          },
        },
      ) as Dict)
    : named;
}

import type { createCache } from '@glimmer/tracking/primitives/cache';
import type { ModifierLike } from '@glint/template';
import 'ember-source/types';

export interface ModifierContext<
  E extends Element,
  N extends Record<string, unknown>,
> {
  service: <T>(name: string) => T;
  on: {
    sync: (
      fn: (element: E, args: N) => undefined | void | (() => void),
    ) => void;
  };
}

export type ModifierBlueprint<
  E extends Element,
  N extends Record<string, unknown>,
> = (context: ModifierContext<E, N>) => void;

export type ModifierOptions<
  E extends Element,
  N extends Record<string, unknown>,
> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element?: abstract new (...args: any[]) => E;
  positional?: (keyof N & (string | symbol))[];
};

export type InvokableModifier<
  N extends Record<string, unknown>,
  Options extends { Element: Element; Positional: string[] },
> = ModifierLike<{
  Args: {
    Positional: Options['Positional'] extends infer P
      ? {
          [K in keyof P]: P[K] extends infer NKey extends keyof N
            ? N[NKey]
            : never;
        }
      : // eslint-disable-next-line @typescript-eslint/ban-types
        {};
    Named: N;
  };
  Element: Options['Element'] extends undefined ? Element : Options['Element'];
}>;

export type CreateModifier<E extends Element, Named extends Dict> = (
  factory: ModifierBlueprint<E, Named>,
  options?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    element?: ElementClass<E>;
    positional?: (keyof Named & (string | symbol))[];
  },
) => ModifierLike<{ Args: { Named: Named }; Element: E }>;

export type TrackedCache<T> = ReturnType<typeof createCache<T>>;
export type JsPropertyKey = string | symbol;
export type ElementClass<E extends Element = Element> = abstract new (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
) => E;
export type Dict<T = unknown> = Record<string, T>;

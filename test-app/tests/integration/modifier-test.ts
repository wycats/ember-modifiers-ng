/* eslint-disable no-undef */

// @ts-check
import { module, test, assert as qunitAssert } from 'qunit';
import { createModifier } from '@ember-ng/modifiers';
import { getRootElement, render } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import { hbs } from 'ember-cli-htmlbars';
import { tracked } from '@glimmer/tracking';

const idle = () => {
  return new Promise((resolve) => {
    requestIdleCallback(resolve);
  });
};

class EventRecorder {
  #events: string[] = [];

  record(event: string) {
    this.#events.push(event);
  }

  expect(events: string[], reason?: string | undefined) {
    qunitAssert.deepEqual(this.#events, events, reason);
    this.#events = [];
  }
}

module('Integration | Modifier | createModifier', function (hooks) {
  setupRenderingTest(hooks);

  test('called on install and cleanup', async function () {
    const recorder = new EventRecorder();
    const modifier = createModifier(({ on }) => {
      recorder.record('create');
      on.sync((el) => {
        recorder.record(`install:${el.id}`);
        return () => recorder.record(`cleanup:${el.id}`);
      });
    });

    this.setProperties({ modifier, shouldRender: true });

    await render(hbs`
      <div id="outer">
        {{#if this.shouldRender}}
          <p id="inner" {{this.modifier}}></p>
        {{/if}}
      </div>
    `);

    recorder.expect(['create', 'install:inner']);
    await idle();
    recorder.expect([]);

    this.setProperties({ shouldRender: false });
    recorder.expect(['cleanup:inner']);
  });

  test('changes to arguments re-syncs the modifier', async function () {
    const state = new RenderState();
    const modifier = createModifier<{ trackedDep: number }>(({ on }) => {
      state.record('create');
      on.sync((el, args) => {
        state.record(`install`, { id: el.id, trackedDep: args.trackedDep });
        return () =>
          state.record(`cleanup`, { id: el.id, trackedDep: args.trackedDep });
      });
    });

    this.setProperties({ modifier, state });

    await render(hbs`
      <div id="outer">
        {{#if this.state.shouldRender}}
          {{#let (unique-id) as |id|}}
            <p id={{id}} class="inner" {{this.modifier trackedDep=this.state.trackedDep}}></p>
          {{/let}}
        {{/if}}
      </div>
    `);

    const inner = Inner.find();
    const result = new RenderResult(state, inner);

    state.expect(
      [Event('create'), Event(`install`, { id: inner.id, trackedDep: 1 })],
      'initial render',
    );

    await result.expectStable('after browser idle');

    await result.invalidateDep('for the first time');
    await result.clear('after first invalidation');

    await result.expectStable('after clearing');
    await result.show('re-enabling');

    await result.expectStable('after re-enabling');

    await result.invalidateDep('for the second time');
    await result.clear('after second invalidation');
    await result.expectStable('after clearing again');
  });
});

type RecordedEvent =
  | [type: 'create']
  | [
      type: 'install' | 'cleanup',
      args: { id: string | undefined; trackedDep: number | undefined },
    ];

class RenderResult {
  readonly #state: RenderState;
  readonly #inner: Inner;

  constructor(state: RenderState, inner: Inner) {
    this.#state = state;
    this.#inner = inner;
  }

  async clear(reason: string) {
    const prev = this.#state.trackedDep;
    const prevId = this.#inner.id;

    this.#state.clear();
    await idle();

    this.#inner.expectCleared(reason);
    this.#state.expect(
      [Event('cleanup', { id: prevId, trackedDep: prev })],
      `events after clearing (${reason})`,
    );
  }

  async show(reason: string) {
    this.#state.shouldRender = true;
    await idle();
    this.#inner.expectRendered(reason);
    this.#state.expect(
      [
        Event('create'),
        Event('install', {
          id: this.#inner.id,
          trackedDep: this.#state.trackedDep,
        }),
      ],
      `events after showing (${reason})`,
    );
  }

  async invalidateDep(reason: string) {
    const prev = this.#state.trackedDep;
    const prevId = this.#inner.id;
    this.#state.trackedDep++;
    await idle();
    this.#inner.expectStable(reason);
    this.#state.expect(
      [
        Event('cleanup', { id: prevId, trackedDep: prev + 1 }),
        Event('install', { id: prevId, trackedDep: prev + 1 }),
      ],
      `events after invalidating (${reason})`,
    );
  }

  async expectStable(reason: string) {
    await idle();

    this.#inner.expectStable(reason);
    this.#state.expect([], `events after stable (${reason})`);
  }

  // #eventId(type: 'install' | 'cleanup', trackedId: number) {
  //   return Event(type, { id: this.#inner.id, trackedDep: trackedId });
  // }

  get eventId() {
    return `${this.#inner.id}:${this.#state.trackedDep}`;
  }
}

class RenderState {
  @tracked trackedDep = 1;
  @tracked shouldRender = true;

  readonly events = new EventRecorder();

  invalidateDep() {
    this.trackedDep++;
  }

  clear() {
    this.shouldRender = false;
  }

  show() {
    this.shouldRender = true;
  }

  record(...args: RecordedEvent) {
    this.events.record(Event(...args));
  }

  expect(events: string[], reason?: string | undefined) {
    this.events.expect(events, reason);
  }
}

function Event(...[type, args]: RecordedEvent) {
  const argList = Object.entries(args ?? {}).map(
    ([k, v]) => `${k}=${String(v)}`,
  );
  if (argList.length === 0) {
    return type;
  } else {
    return `${type} ${argList.join(', ')}`;
  }
}

class Inner {
  static find() {
    return new Inner(Inner.#getElement());
  }

  static #getElement(): HTMLParagraphElement | null {
    const element =
      getRootElement().querySelector<HTMLParagraphElement>('p.inner');

    return element;
  }

  #element: HTMLParagraphElement | null;

  constructor(element: HTMLParagraphElement | null) {
    this.#element = element;
  }

  get id() {
    return this.#element?.id;
  }

  get #existing() {
    return existing(this.#element, 'Inner element should exist');
  }

  update() {
    this.#update();
    return this.#existing;
  }

  #update() {
    const element: HTMLParagraphElement | null =
      getRootElement().querySelector('p.inner');

    return (this.#element = element);
  }

  expectStable(reason: string) {
    const current = getRootElement().querySelector('p.inner');
    QUnit.assert.strictEqual(
      this.#element,
      current,
      `The inner element should be stable (${reason})`,
    );
  }

  expectRendered(reason: string) {
    const element = this.#update();

    exists(element, `The inner element should be rendered (${reason})`);

    return element;
  }

  expectCleared(reason: string) {
    QUnit.assert.strictEqual(
      this.#update(),
      null,
      `The inner element should be cleared (${reason})`,
    );
  }
}

function exists<T>(
  value: T | null | undefined,
  reason: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Expected value to not be null or undefined (${reason})`);
  }
}

function existing<T>(value: T | null | undefined, reason: string): T {
  exists(value, reason);
  return value;
}

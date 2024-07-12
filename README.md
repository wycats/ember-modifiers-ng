# @ember-ng/modifiers

This addon provides a unified, function-based API for building Ember modifiers.

It supports:

1. 🔢 Positional Arguments
2. 🔡 Excellent TypeScript Types
3. 🛠️ Services

## Compatibility

- Ember.js v3.28 or above
- Embroider or ember-auto-import v2

## Installation

```
ember install @ember-ng/modifiers
```

## Usage

A modifier is a function that allows an element to interact with reactive data.

## Usage

```ts
// app/modifiers/autofocus.js
export default createModifier(({ on }) => {
  on.install((element) => element.focus());
});
```

In a GJS file:

```gjs
import { autofocus } from 'app/modifiers/autofocus';

<template><input {{autofocus}} /></template>
```

In an HBS file:

```hbs
<div {{autofocus}}></div>
```

## Examples

### Simple Modifier

### Cleanup

If the `on.install` hook returns a function, it will be called when the `on.install` hook is cleaned up.

```ts
// app/modifiers/on-resize.js
export default createModifier<{ callback: (element: Element) => void }>(
  ({ on }) => {
    on.install((element, args) => {
      const observer = new ResizeObserver(() => {
        args.callback(element);
      });

      observer.observe(element);

      return () => observer.disconnect();
    });
  },
);
```

Usage:

```hbs
<div {{onResize callback=this.onResize}}>{{this.text}}</div>
```

An `on.install` hook is cleaned up when any of its tracked dependencies change
or when the element is removed from the DOM.

Since the arguments passed to `on.install` are tracked, any changes to
arguments that are used in the hook will cause the hook to be cleaned up and
reinstalled.

> [!TIP]
>
> If you use a tracked argument in an event handler registered in the `on.install` hook,
> it will not become a dependency of the `on.install` hook. In the case of this example,
> the callback will not become a dependency of the `on.install` hook, but the current
> value of `callback` will be used when the resize observer runs.

### Positional Arguments

```ts
// app/modifiers/on-resize.js
export default createModifier<{ callback: (element: Element) => void }>(
  ({ on }) => {
    on.install((element, args) => {
      const observer = new ResizeObserver(() => {
        args.callback(element);
      });

      observer.observe(element);

      return () => observer.disconnect();
    });
  },
  {
    positional: ['callback'],
  },
);
```

Usage:

```hbs
<div {{onResize this.onResize}}>{{this.text}}</div>
```

> [!TIP]
>
> Declaring a positional argument makes it possible to pass the argument to the
> modifier as a positional argument in the template. It has no effect on the
> implementation of the modifier itself, which still accesses the argument as a
> named argument.
>
> Declared positional arguments can also be passed to the modifier as the
> equivalent named argument.

### Services

```ts
// app/modifiers/on-resize.js
export default createModifier<{ callback: (element: Element) => void }>(
  ({ on, service }) => {
    const resizeObserver = service('resize-observer');

    on.install((element, args) => {
      const disconnect = resizeObserver.observe(element, () =>
        args.callback(element),
      );
      return disconnect;
    });
  },
  {
    positional: ['callback'],
  },
);
```

Usage:

```hbs
<div {{onResize this.onResize}}>{{this.text}}</div>
```

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).

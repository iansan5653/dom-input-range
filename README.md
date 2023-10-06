# `InputRange`

The [`Range`](https://developer.mozilla.org/en-US/docs/Web/API/Range) web API provides access to a slice of a document, including some very useful functions for obtaining the coordinates of the contents of that slice (`getClientRects` and `getBoundingClientRect`).

These _could_ be extremely powerful when used in tandem with form input fields as they can allow for annotating text without having to wrap it in a `span`. Unfortunately, the contents of `<input>` and `<textarea>` elements remain inaccessible to this API because they are not rendered like regular `Text` nodes.

This library aims to provide a solution to that through a new [`InputRange`](https://iansan5653.github.io/dom-input-range/classes/InputRange.html) class that implements a subset of the `Range` API.

![Screenshot of a textarea with highlighted range of text. A blue box is rendered around the entire range and the text in the range is highlighted with translucent red boxes.](./screenshot.png)

## Usage

First, install the package:

```sh
npm install dom-input-range
```

A new `InputRange` can be [constructed](https://iansan5653.github.io/dom-input-range/classes/InputRange.html#constructor) with an element and offsets. For example, to get the coordinates of the bounding box around the first ten characters of a `textarea`:

```js
import { InputRange } from "dom-input-range";

new InputRange(element, 0, 10).getBoundingClientRect();
```

There is also a convenient [`fromSelection`](https://iansan5653.github.io/dom-input-range/classes/InputRange.html#fromSelection) method for creating a range from the active selection. This can also be used to get the coordinates of the caret:

```js
import { InputRange } from "dom-input-range";

InputRange.fromSelection(element).getClientRects();
```

For the full api, see the docs for [`InputRange`](https://iansan5653.github.io/dom-input-range/classes/InputRange.html).

## Demos

- [Words](https://iansan5653.github.io/dom-input-range/demos/words/): Highlight certain words in an input as the user types
- [Caret](https://iansan5653.github.io/dom-input-range/demos/caret/): Show an indicator wherever the caret is located
- [Playground](https://iansan5653.github.io/dom-input-range/demos/playground/): Play with a `<textarea>` to see the difference between [`getBoundingClientRect`](https://iansan5653.github.io/dom-input-range/classes/InputRange.html#getBoundingClientRect) and [`getClientRects`](https://iansan5653.github.io/dom-input-range/classes/InputRange.html#getClientRects)

## Available features and limitations

This API is focused on providing an intuitive way to obtain the coordinates of text inside a form field element. It also implements a few other `Range` methods for consistency with the browser API, but it does not implement the entire class:

- All methods for querying information about the range are implemented
- This `InputRange` cannot cross `Node` boundaries, so any method that works with `Node`s is not implemented
- Two new manipulation methods are present instead: `setStartOffset` and `setEndOffset`
- Methods that modify the range contents are not implemented - work with the input `value` directly instead

## Implementation and performance considerations

Behind the scenes, `InputRange` works by creating a `<div>` that copies all of the styling and contents from the input element. This 'clone' is then appended to the document and hidden from view so it can be queried. This is adapted from the approach taken in the [`textarea-caret`](https://github.com/koddsson/textarea-caret-position) utility.

Mounting a new element and copying styles can have a real performance impact, and this API has been carefully designed to minimize that. The clone element is only created once per input element, and is reused for all subsequent queries — even if new `InputRange` instances are constructed. The clone element is automatically discarded after it is not queried for a while.

There is practically no overhead to constructing new `InputRange` instances - whether or not you reuse them is entirely up to what best fits with your usage.

The result of this is that the consumer should typically not need to consider performance. If you do notice any performance problems, please [create a new issue](https://github.com/iansan5653/dom-input-range/issues).

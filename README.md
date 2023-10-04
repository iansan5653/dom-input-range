# `dom-input-range`

The [`Range`](https://developer.mozilla.org/en-US/docs/Web/API/Range) web API provides access to a slice of a document, including some very useful functions for obtaining the coordinates of the contents of that slice (`getClientRects` and `getBoundingClientRect`).

These *could* be extremely powerful when used in tandem with form input fields as they can allow for annotating text without having to wrap it in a `span`. Unfortunately, the contents of `<input>` and `<textarea>` elements remain inaccessible to this API because they are not rendered like regular `Text` nodes.

This library aims to provide a solution to that through a new `InputRange` class that implements a subset of the `Range` API.

## Usage

First, install the package:

```sh
npm install dom-input-range
```

Usage is straightforward. For example, to get the coordinates of the bounding box around the first ten characters of a `textarea`:

```js
import {InputRange} from "dom-input-range";

new InputRange(element, 0, 10).getBoundingClientRect();
```

> [!IMPORTANT]  
> Support for `<input>` elements is not yet implemented, but will be added in an upcoming release.

Or obtain all rects for the current selection (can include more than one rect if the selection spans multiple lines):

```js
import {InputRange} from "dom-input-range";

InputRange.fromSelection(element).getClientRects();
```

## Available features and limitations

This API is focused on providing an intuitive way to obtain the coordinates of text inside a form field element. It also implements a few other `Range` methods for consistency with the browser API, but it does not implement the entire class.

The native `Range` API is designed to work around and across node boundaries. `InputRange`, however, represents a somewhat different concept in that it can only represent a slice of the contents within a single input element. The edges of `InputRange` cannot cross node boundaries, so methods that operate on `Node`s are not implemented in this API.

The native API also allows for some manipulation of the `Range` contents, such as deletion (`deleteContents`). This is not supported by `InputRange` because the behavior would not fire `change` events, which could be unexpected.

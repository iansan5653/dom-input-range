import {InputElement} from "./types.js";

// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
const propertiesToCopy = [
  "direction", // RTL support
  "boxSizing",
  "width", // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  "height",
  "overflowX",
  "overflowY", // copy the scrollbar for IE

  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",

  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",

  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration", // might not make a difference, but better be safe

  "letterSpacing",
  "wordSpacing",

  "tabSize",
  "MozTabSize" as "tabSize", // prefixed version for Firefox <= 52
] as const satisfies ReadonlyArray<keyof CSSStyleDeclaration>;

const clones = new WeakMap<InputElement, HTMLDivElement>();

/**
 * Create a `div` that exactly matches an input element in all but position. Important: note that the style of the
 * clone will automatically update as the style of the input changes, but the text will not! This must be done manually.
 *
 * This is carefully optimized to:
 *   - Allow the referenced element to get garbage collected on unmount
 *   - Avoid creating any more elements than necessary
 *   - Avoid applying any styles more often than necessary
 * Done wrong, this can have significant performance implications.
 */
export class InputStyleClone {
  readonly #mutationObserver = new MutationObserver(() => this.#updateStyles());
  readonly #resizeObserver = new ResizeObserver(() => this.#updateStyles());
  readonly #inputRef;

  constructor(input: InputElement) {
    // careful not to keep around any class-level references to elements that would prevent them from getting
    // garbage-collected after unmount
    this.#inputRef = new WeakRef(input);

    const existingClone = clones.get(input);

    if (!existingClone) {
      const newClone = document.createElement("div");
      newClone.setAttribute("aria-hidden", "true");
      document.body.appendChild(newClone);

      this.#updateStyles();

      clones.set(input, newClone);

      this.#mutationObserver.observe(input, {
        attributeFilter: ["style"],
      });
      this.#resizeObserver.observe(input);
    }
  }

  get inputElement() {
    const input = this.#inputRef.deref();

    if (!input) {
      // We *only* clean up if the input has been garbage collected. We don't want to expose some public `dispose` method
      // because all the instances share the same clone, so if one instance is disposed it would affect all the others.
      // For this to work it's critical to allow the input to get collected by not storing a class-level ref to it.
      this.#mutationObserver.disconnect();
      this.#resizeObserver.disconnect();
      this.cloneElement?.remove();
    }

    return input;
  }

  get cloneElement() {
    const input = this.inputElement;
    const clone = input && clones.get(input);

    if (clone) {
      // Text content cannot be updated via event listener because change events are not triggered when value is set
      // directly. Nor can we use a mutationobserver because value is a property, not an attribute. So we always set it
      // on retrieval instead. This should be a low-cost operation so we don't need to worry too much about overdoing it.
      clone.textContent = input.value;
    }

    return clone;
  }

  #updateStyles() {
    const clone = this.cloneElement;
    const input = this.inputElement;

    if (!clone || !input) return;

    const style = clone.style;
    const inputStyle = window.getComputedStyle(input);

    // Default wrapping styles
    style.whiteSpace = "pre-wrap";
    style.wordWrap = "break-word";

    // Position off-screen
    style.position = "fixed";
    style.top = "0";
    style.transform = "translateY(-100%)";

    const isFirefox = "mozInnerScreenX" in window;

    // Transfer the element's properties to the div
    for (const prop of propertiesToCopy)
      if (prop === "width" && inputStyle.boxSizing === "border-box") {
        // With box-sizing: border-box we need to offset the size slightly inwards.  This small difference can compound
        // greatly in long textareas with lots of wrapping, leading to very innacurate results if not accounted for.
        // Firefox will return computed styles in floats, like `0.9px`, while chromium might return `1px` for the same element.
        // Either way we use `parseFloat` to turn `0.9px` into `0.9` and `1px` into `1`
        const totalBorderWidth =
          parseFloat(inputStyle.borderLeftWidth) +
          parseFloat(inputStyle.borderRightWidth);
        // When a vertical scrollbar is present it shrinks the content. We need to account for this by using clientWidth
        // instead of width in everything but Firefox. When we do that we also have to account for the border width.
        const width = isFirefox
          ? parseFloat(inputStyle.width) - totalBorderWidth
          : input.clientWidth + totalBorderWidth;
        style.width = `${width}px`;
      } else {
        style[prop] = inputStyle[prop];
      }

    if (isFirefox) {
      // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
      if (input.scrollHeight > parseInt(inputStyle.height))
        style.overflowY = "scroll";
    } else {
      style.overflow = "hidden"; // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
    }
  }
}

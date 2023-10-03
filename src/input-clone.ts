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

/**
 * Create a `div` that exactly matches an input element in all but position. Important: note that the style of the
 * clone will automatically update as the style of the input changes, but the text will not! This must be done manually.
 */
export class InputStyleClone {
  readonly cloneElement = document.createElement("div");

  readonly #mutationObserver = new MutationObserver(() => this.#updateStyles());
  readonly #resizeObserver = new ResizeObserver(() => this.#updateStyles());

  constructor(readonly inputElement: InputElement) {
    document.body.appendChild(this.cloneElement);

    this.#updateStyles();

    this.#mutationObserver.observe(this.inputElement, {
      attributeFilter: ["style"],
    });
    this.#resizeObserver.observe(this.inputElement);
  }

  dispose() {
    this.cloneElement?.remove();
    this.#mutationObserver.disconnect();
    this.#resizeObserver.disconnect();
  }

  #updateStyles() {
    const style = this.cloneElement?.style;
    const inputStyle = window.getComputedStyle(this.inputElement);

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
          : this.inputElement.clientWidth + totalBorderWidth;
        style.width = `${width}px`;
      } else {
        style[prop] = inputStyle[prop];
      }

    if (isFirefox) {
      // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
      if (this.inputElement.scrollHeight > parseInt(inputStyle.height))
        style.overflowY = "scroll";
    } else {
      style.overflow = "hidden"; // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
    }
  }
}

export type InputElement = HTMLTextAreaElement;

/** Create a `div` that exactly matches an input element in all but position. */
export class InputStyleClone {
  #mutationObserver = new MutationObserver(() => this.#updateStyles());
  #resizeObserver = new ResizeObserver(() => this.#updateStyles());

  // This class is unique in that it will prevent itself from getting garbage collected because of the subscribed
  // observers (if never detached). Because of this, we want to avoid preventing the existence of this class from also
  // preventing the garbage collection of the associated input. This also allows us to automatically detach if the
  // input gets collected.
  #inputRef: WeakRef<InputElement>;

  // There's no need to store the div in a weakref because once we auto-detach based on the input, this will get
  // released as the class itself gets garbage collected.
  #cloneElement: HTMLDivElement;

  isDetached = false;

  constructor(input: InputElement) {
    this.#inputRef = new WeakRef(input);

    const clone = document.createElement("div");
    clone.setAttribute("aria-hidden", "true");
    document.body.appendChild(clone);
    this.#cloneElement = clone;

    this.#updateStyles();

    this.#mutationObserver.observe(input, {
      attributeFilter: ["style"],
    });
    this.#resizeObserver.observe(input);
  }

  get cloneElement() {
    const inputElement = this.#inputElement;
    if (inputElement) {
      // Text content cannot be updated via event listener because change events are not triggered when value is set
      // directly. Nor can we use MutationObserver because value is a property, not an attribute. So we always set it
      // on retrieval instead. This is a low-cost operation so we don't need to worry too much about overdoing it.
      this.#cloneElement.textContent = inputElement.value;
    }

    return this.#cloneElement;
  }

  detach() {
    this.#mutationObserver.disconnect();
    this.#resizeObserver.disconnect();
    this.#cloneElement?.remove();
    this.isDetached = true;
  }

  /**
   * Return a copy of the passed rect, adjusted to match the position of the input element.
   * Returns null if the input element is no longer available.
   */
  offsetCloneRect(rect: DOMRect) {
    const cloneElement = this.#cloneElement;
    const inputElement = this.#inputElement;

    // Mimic browser behavior by returning a 0-rect if the element is not present
    if (!inputElement) return new DOMRect();

    const cloneRect = cloneElement.getBoundingClientRect();
    const inputRect = inputElement.getBoundingClientRect();

    // The div is not scrollable so it does not have scroll adjustment built in
    const inputScroll = {
      top: inputElement.scrollTop,
      left: inputElement.scrollLeft,
    };

    return new DOMRect(
      rect.left - cloneRect.left + inputRect.left - inputScroll.left,
      rect.top - cloneRect.top + inputRect.top - inputScroll.top,
      rect.width,
      rect.height
    );
  }

  // --- private ---

  get #inputElement() {
    return this.#inputRef.deref();
  }

  #updateStyles() {
    const clone = this.#cloneElement;
    const input = this.#inputElement;

    if (!input) return;

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

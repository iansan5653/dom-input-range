export type InputElement = HTMLTextAreaElement | HTMLInputElement;

/**
 * Create a `div` that exactly matches an input element and automatically stays in sync with it.
 *
 * PRIOR ART: This approach & code was adapted from the following MIT-licensed sources:
 * - primer/react (Copyright (c) 2018 GitHub, Inc.): https://github.com/primer/react/blob/a0db832302702b869aa22b0c4049ad9305ef631f/src/drafts/utils/character-coordinates.ts
 * - koddsson/textarea-caret-position (Copyright (c) 2015 Jonathan Ong me@jongleberry.com): https://github.com/koddsson/textarea-caret-position/blob/eba40ec8488eed4d77815f109af22e1d9c0751d3/index.js
 * - component/textarea-caret-position (Copyright (c) 2015 Jonathan Ong me@jongleberry.com): https://github.com/component/textarea-caret-position/blob/b5db7a7e47dd149c2a66276183c69234e4dabe30/index.js
 */
export class InputStyleClone {
  #mutationObserver = new MutationObserver(() => this.#updateStyles());
  #resizeObserver = new ResizeObserver(() => this.#updateLayout());

  // This class is unique in that it will prevent itself from getting garbage collected because of the subscribed
  // observers (if never detached). Because of this, we want to avoid preventing the existence of this class from also
  // preventing the garbage collection of the associated input. This also allows us to automatically detach if the
  // input gets collected.
  #inputRef: WeakRef<InputElement>;

  // There's no need to store the div in a weakref because once we auto-detach based on the input, this will get
  // released as the class itself gets garbage collected.
  #cloneContainer: HTMLDivElement;
  #cloneElement: HTMLDivElement;

  isDetached = false;

  constructor(input: InputElement) {
    this.#inputRef = new WeakRef(input);

    const cloneContainer = InputStyleClone.#createContainerElement();
    document.body.appendChild(cloneContainer);

    const clone = InputStyleClone.#createCloneElement(input instanceof HTMLTextAreaElement);
    cloneContainer.appendChild(clone);

    this.#cloneContainer = cloneContainer;
    this.#cloneElement = clone;

    this.#updateStyles();

    this.#mutationObserver.observe(input, {
      attributeFilter: ["style"],
    });
    this.#resizeObserver.observe(input);
  }

  get cloneElement() {
    // Text content cannot be updated via event listener because change events are not triggered when value is set
    // directly. Nor can we use MutationObserver because value is a property, not an attribute. So we always set it
    // on retrieval instead. This is a low-cost operation so we don't need to worry too much about overdoing it.
    this.#updateText();

    return this.#cloneElement;
  }

  detach() {
    this.#mutationObserver.disconnect();
    this.#resizeObserver.disconnect();
    this.#cloneContainer.remove();
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
      rect.height,
    );
  }

  // --- private ---

  static #createContainerElement() {
    const element = document.createElement("div");
    // We need a container because position:absolute is not compatible with display:table-cell which is used for single-line input clones
    element.style.position = "absolute";
    return element;
  }

  static #createCloneElement(targetIsTextarea: boolean) {
    const element = document.createElement("div");

    element.style.pointerEvents = "none";
    element.style.userSelect = "none";
    element.style.overflow = "hidden";

    // Important not to use display:none which would not render the content at all
    element.style.visibility = "hidden";

    if (targetIsTextarea) {
      element.style.whiteSpace = "pre-wrap";
      element.style.wordWrap = "break-word";
    } else {
      element.style.whiteSpace = "nowrap";
      // text in single-line inputs is vertically centered
      element.style.display = "table-cell";
      element.style.verticalAlign = "middle";
    }

    return element;
  }

  get #inputElement() {
    return this.#inputRef.deref();
  }

  /** Update only geometric properties without recalculating styles. */
  #updateLayout() {
    const clone = this.#cloneElement;
    const input = this.#inputElement;

    if (!input) return;

    const inputStyle = window.getComputedStyle(input);

    clone.style.height = inputStyle.height;
    clone.style.width = inputStyle.width;

    // Immediately re-adjust for browser inconsistencies in scrollbar handling, if necessary
    clone.style.height = `calc(${inputStyle.height} + ${input.clientHeight - clone.clientHeight}px)`;
    clone.style.width = `calc(${inputStyle.width} + ${input.clientWidth - clone.clientWidth}px)`;
  }

  #updateStyles() {
    const clone = this.#cloneElement;
    const input = this.#inputElement;

    if (!input) return;

    const inputStyle = window.getComputedStyle(input);

    for (const prop of propertiesToCopy) clone.style[prop] = inputStyle[prop];
  }

  #updateText() {
    // Original code replaced spaces with NBSP (`\u00a0`) but this seems unecessary if we have word-wrap: nowrap
    this.#cloneElement.textContent = this.#inputElement?.value ?? "";
  }
}

// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
const propertiesToCopy = [
  "direction", // RTL support
  "boxSizing",

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

export type InputElement = HTMLTextAreaElement | HTMLInputElement;

export class InputStyleCloneUpdateEvent extends Event {
  constructor() {
    super("update");
  }
}

const CloneRegistry = new WeakMap<InputElement, InputStyleCloneElement>();

/**
 * Create an element that exactly matches an input pixel-for-pixel and automatically stays in sync with it. This
 * is a non-interactive overlay on to the input and can be used to affect the visual appearance of the input
 * without modifying its behavior. The clone element is hidden by default.
 *
 * This lower level API powers the `InputRange` but provides more advanced functionality including event updates.
 *
 * Emits `update` events whenever anything is recalculated: when the layout changes, when the user scrolls, when the
 * input is updated, etc. This event may be emitted more than once per change.
 *
 * NOTE! This class will not auto update if `input.value` is set directly!
 *
 */
// PRIOR ART: This approach was adapted from the following MIT-licensed sources:
//  - primer/react (Copyright (c) 2018 GitHub, Inc.): https://github.com/primer/react/blob/a0db832302702b869aa22b0c4049ad9305ef631f/src/drafts/utils/character-coordinates.ts
//  - component/textarea-caret-position (Copyright (c) 2015 Jonathan Ong me@jongleberry.com): https://github.com/component/textarea-caret-position/blob/b5db7a7e47dd149c2a66276183c69234e4dabe30/index.js
//  - koddsson/textarea-caret-position (Copyright (c) 2015 Jonathan Ong me@jongleberry.com): https://github.com/koddsson/textarea-caret-position/blob/eba40ec8488eed4d77815f109af22e1d9c0751d3/index.js
export class InputStyleCloneElement extends HTMLElement {
  #styleObserver = new MutationObserver(() => this.#updateStyles());
  #resizeObserver = new ResizeObserver(() => this.#requestUpdateLayout());

  // This class is unique in that it will prevent itself from getting garbage collected because of the subscribed
  // observers (if never detached). Because of this, we want to avoid preventing the existence of this class from also
  // preventing the garbage collection of the associated input. This also allows us to automatically detach if the
  // input gets collected.
  #inputRef: WeakRef<InputElement>;
  #container: HTMLDivElement;

  /**
   * Get the clone for an input, reusing an existing one if available. This avoids creating unecessary clones, which
   * have a performance cost due to their high-frequency event-based updates. Because these elements are shared, they
   * should NOT be mutated directly.
   */
  static for(input: InputElement) {
    const clone = CloneRegistry.get(input) ?? new InputStyleCloneElement(input);
    CloneRegistry.set(input, clone);
    return clone;
  }

  /** Avoid constructing directly: Use `InputStyleCloneElement.for` instead. */
  constructor(input: InputElement) {
    super();

    this.#inputRef = new WeakRef(input);

    // We want position:absolute so it doesn't take space in the layout, but that doesn't work with display:table-cell
    // used in the HTMLInputElement approach. So we need a wrapper.
    this.#container = document.createElement("div");
    this.#container.style.position = "absolute";
    input.after(this.#container);
    this.#container.appendChild(this);
  }

  /**
   * Force a recalculation. Will emit an `update` event. This is typically not needed unless the input has changed in
   * an unobservable way, eg by directly writing to the `value` property.
   */
  forceUpdate() {
    this.#updateStyles();
    this.#updateText();
  }

  /** @private */
  connectedCallback() {
    const input = this.#inputElement;
    if (!input) return this.remove();

    this.style.pointerEvents = "none";
    this.style.userSelect = "none";
    this.style.overflow = "hidden";
    this.style.display = "block";

    // Important not to use display:none which would not render the content at all
    this.style.visibility = "hidden";

    if (input instanceof HTMLTextAreaElement) {
      this.style.whiteSpace = "pre-wrap";
      this.style.wordWrap = "break-word";
    } else {
      this.style.whiteSpace = "nowrap";
      // text in single-line inputs is vertically centered
      this.style.display = "table-cell";
      this.style.verticalAlign = "middle";
    }

    this.setAttribute("aria-hidden", "true");

    this.#updateStyles();
    this.#updateText();

    this.#styleObserver.observe(input, {
      attributeFilter: ["style"],
    });
    this.#resizeObserver.observe(input);

    document.addEventListener("scroll", this.#onDocumentScrollOrResize, { capture: true });
    window.addEventListener("resize", this.#onDocumentScrollOrResize, { capture: true });
    input.addEventListener("input", this.#onInput);
  }

  /** @private */
  disconnectedCallback() {
    this.#container.remove();
    this.#styleObserver.disconnect();
    this.#resizeObserver.disconnect();
    document.removeEventListener("scroll", this.#onDocumentScrollOrResize, { capture: true });
    window.removeEventListener("resize", this.#onDocumentScrollOrResize, { capture: true });

    const input = this.#inputElement;
    if (input) {
      input.removeEventListener("input", this.#onInput);
      CloneRegistry.delete(input);
    }
  }

  // --- private ---

  get #inputElement() {
    return this.#inputRef.deref();
  }

  #usingInput<T>(fn: (input: InputElement) => T | void) {
    const input = this.#inputElement;
    if (!input) return this.remove();
    return fn(input);
  }

  #xOffset = 0;
  #yOffset = 0;

  /** Update only geometric properties without recalculating styles. */
  #updateLayout() {
    this.#usingInput((input) => {
      const inputStyle = window.getComputedStyle(input);

      this.style.height = inputStyle.height;
      this.style.width = inputStyle.width;

      // Immediately re-adjust for browser inconsistencies in scrollbar handling, if necessary
      this.style.height = `calc(${inputStyle.height} + ${input.clientHeight - this.clientHeight}px)`;
      this.style.width = `calc(${inputStyle.width} + ${input.clientWidth - this.clientWidth}px)`;

      // Position on top of the input
      const inputRect = input.getBoundingClientRect();
      const cloneRect = this.getBoundingClientRect();

      this.#xOffset = this.#xOffset + inputRect.left - cloneRect.left;
      this.#yOffset = this.#yOffset + inputRect.top - cloneRect.top;

      this.style.transform = `translate(${this.#xOffset}px, ${this.#yOffset}px)`;

      this.scrollTop = input.scrollTop;
      this.scrollLeft = input.scrollLeft;

      this.dispatchEvent(new InputStyleCloneUpdateEvent());
    });
  }

  #isLayoutUpdating = false;

  #requestUpdateLayout() {
    if (this.#isLayoutUpdating) return;
    this.#isLayoutUpdating = true;

    requestAnimationFrame(() => {
      this.#updateLayout();
      this.#isLayoutUpdating = false;
    });
  }

  #updateStyles() {
    this.#usingInput((input) => {
      const inputStyle = window.getComputedStyle(input);

      for (const prop of propertiesToCopy) this.style[prop] = inputStyle[prop];

      this.#requestUpdateLayout();
    });
  }

  #updateText() {
    this.#usingInput((input) => {
      this.textContent = input.value;

      // No need to update layout; if the text causes a scroll it will trigger a layout change via event listener
      this.dispatchEvent(new InputStyleCloneUpdateEvent());
    });
  }

  #onInput = () => this.#updateText();

  #onDocumentScrollOrResize = (event: Event) => {
    this.#usingInput((input) => {
      if (
        event.target === document ||
        event.target === window ||
        (event.target instanceof Node && event.target.contains(input))
      )
        this.#requestUpdateLayout();
    });
  };
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

customElements.define("input-style-clone", InputStyleCloneElement);

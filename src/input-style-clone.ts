export type InputElement = HTMLTextAreaElement | HTMLInputElement;

export class InputStyleCloneUpdateEvent extends Event {
  constructor() {
    super("update");
  }
}

const CloneRegistry = new WeakMap<InputElement, InputStyleClone>();

/**
 * Creates an element that exactly matches an input pixel-for-pixel and automatically stays in sync with it. This
 * is a non-interactive overlay on to the input and can be used to affect the visual appearance of the input
 * without modifying its behavior. The clone element is hidden by default.
 *
 * This lower level API powers the `InputRange` but provides more advanced functionality including event updates.
 *
 * Emits `update` events whenever anything is recalculated: when the layout changes, when the user scrolls, when the
 * input is updated, etc. This event may be emitted more than once per change.
 *
 * @note There may be cases in which the clone cannot observe changes to the input and fails to automatically update.
 * For example, if the `value` property on the input is written to directly, no `input` event is emitted by the input
 * and the clone does not automatically update. In these cases, `forceUpdate` can be used to manually trigger an update.
 */
// PRIOR ART: This approach was adapted from the following MIT-licensed sources:
//  - primer/react (Copyright (c) 2018 GitHub, Inc.): https://github.com/primer/react/blob/a0db832302702b869aa22b0c4049ad9305ef631f/src/drafts/utils/character-coordinates.ts
//  - component/textarea-caret-position (Copyright (c) 2015 Jonathan Ong me@jongleberry.com): https://github.com/component/textarea-caret-position/blob/b5db7a7e47dd149c2a66276183c69234e4dabe30/index.js
//  - koddsson/textarea-caret-position (Copyright (c) 2015 Jonathan Ong me@jongleberry.com): https://github.com/koddsson/textarea-caret-position/blob/eba40ec8488eed4d77815f109af22e1d9c0751d3/index.js
export class InputStyleClone extends EventTarget {
  #styleObserver = new MutationObserver(() => this.#updateStyles());
  #resizeObserver = new ResizeObserver(() => this.#requestUpdateLayout());

  // This class is unique in that it will prevent itself from getting garbage collected because of the subscribed
  // observers (if never detached). Because of this, we want to avoid preventing the existence of this class from also
  // preventing the garbage collection of the associated input. This also allows us to automatically detach if the
  // input gets collected.
  #inputRef?: WeakRef<InputElement>;
  #container = document.createElement("div");
  #cloneElement = document.createElement("div");

  /**
   * Get the clone for an input, reusing an existing one if available. This avoids creating unecessary clones, which
   * have a performance cost due to their high-frequency event-based updates. Because these elements are shared, they
   * should be mutated with caution. If you're planning to mutate the clone, consider constructing a new one instead.
   *
   * Upon initial creation the clone element will automatically be inserted into the DOM and begin observing the
   * linked input.
   * @param input The target input to clone.
   */
  static for(input: InputElement) {
    let clone = CloneRegistry.get(input);

    if (!clone) {
      clone = new InputStyleClone(input);
      CloneRegistry.set(input, clone);
    }

    return clone;
  }

  /**
   * Connect this instance to a target input element and insert this instance into the DOM in the correct location.
   *
   * NOTE: calling the static `for` method is usually preferable as it will reuse an existing clone if available.
   * However, if reusing clones is problematic (ie, if the clone needs to be mutated), a clone can be constructed
   * directly with `new InputStyleClone(target)`.
   */
  constructor(input: InputElement) {
    super();

    this.#inputRef = new WeakRef(input);

    // We want position:absolute so it doesn't take space in the layout, but that doesn't work with display:table-cell
    // used in the HTMLInputElement approach. So we need a wrapper.
    this.#container.style.position = "absolute";
    this.#container.style.pointerEvents = "none";
    this.#container.setAttribute("aria-hidden", "true");

    this.#container.appendChild(this.#cloneElement);

    this.#cloneElement.style.pointerEvents = "none";
    this.#cloneElement.style.userSelect = "none";
    this.#cloneElement.style.overflow = "hidden";
    this.#cloneElement.style.display = "block";

    // Important not to use display:none which would not render the content at all
    this.#cloneElement.style.visibility = "hidden";

    if (input instanceof HTMLTextAreaElement) {
      this.#cloneElement.style.whiteSpace = "pre-wrap";
      this.#cloneElement.style.wordWrap = "break-word";
    } else {
      this.#cloneElement.style.whiteSpace = "nowrap";
      // text in single-line inputs is vertically centered
      this.#cloneElement.style.display = "table-cell";
      this.#cloneElement.style.verticalAlign = "middle";
    }

    input.after(this.#container);

    this.#updateStyles();
    this.#updateText();

    this.#styleObserver.observe(input, {
      attributeFilter: [
        "style",
        "dir", // users can right-click in some browsers to change the text direction dynamically
      ],
    });
    this.#resizeObserver.observe(input);

    document.addEventListener("scroll", this.#onDocumentScrollOrResize, { capture: true });
    window.addEventListener("resize", this.#onDocumentScrollOrResize, { capture: true });
    // capture so this happens first, so other things can respond to `input` events after this data updates
    input.addEventListener("input", this.#onInput, { capture: true });
  }

  /** Get the clone element. */
  get element() {
    return this.#cloneElement;
  }

  /**
   * Force a recalculation. Will emit an `update` event. This is typically not needed unless the input has changed in
   * an unobservable way, eg by directly writing to the `value` property.
   */
  forceUpdate() {
    this.#updateStyles();
    this.#updateText();
  }

  disconnect() {
    this.#container?.remove();
    this.#styleObserver.disconnect();
    this.#resizeObserver.disconnect();
    document.removeEventListener("scroll", this.#onDocumentScrollOrResize, { capture: true });
    window.removeEventListener("resize", this.#onDocumentScrollOrResize, { capture: true });

    // Can't use `usingInput` here since that could infinitely recurse
    const input = this.#input;
    if (input) {
      input.removeEventListener("input", this.#onInput, { capture: true });
      CloneRegistry.delete(input);
    }
  }

  // --- private ---

  get #input() {
    return this.#inputRef?.deref();
  }

  /** Perform `fn` using the `input` if it is still available. If not, clean up the clone instead. */
  #usingInput<T>(fn: (input: InputElement) => T | void) {
    const input = this.#input;
    if (!input) return this.disconnect();
    return fn(input);
  }

  /** Current relative x-adjustment in pixels, executed via CSS transform. */
  #xOffset = 0;
  /** Current relative y-adjustment in pixels, executed via CSS transform. */
  #yOffset = 0;

  /**
   * Update only geometric properties without recalculating styles. Typically call `#requestUpdateLayout` instead to
   * only update once per animation frame.
   */
  #updateLayout() {
    // This runs often, so keep it as fast as possible! Avoid all unecessary updates.
    this.#usingInput((input) => {
      const inputStyle = window.getComputedStyle(input);

      this.#cloneElement.style.height = inputStyle.height;
      this.#cloneElement.style.width = inputStyle.width;

      // Immediately re-adjust for browser inconsistencies in scrollbar handling, if necessary
      if (input.clientHeight !== this.#cloneElement.clientHeight)
        this.#cloneElement.style.height = `calc(${inputStyle.height} + ${
          input.clientHeight - this.#cloneElement.clientHeight
        }px)`;
      if (input.clientWidth !== this.#cloneElement.clientWidth)
        this.#cloneElement.style.width = `calc(${inputStyle.width} + ${
          input.clientWidth - this.#cloneElement.clientWidth
        }px)`;

      // Position on top of the input
      const inputRect = input.getBoundingClientRect();
      const cloneRect = this.#cloneElement.getBoundingClientRect();

      this.#xOffset = this.#xOffset + inputRect.left - cloneRect.left;
      this.#yOffset = this.#yOffset + inputRect.top - cloneRect.top;

      this.#cloneElement.style.transform = `translate(${this.#xOffset}px, ${this.#yOffset}px)`;

      this.#cloneElement.scrollTop = input.scrollTop;
      this.#cloneElement.scrollLeft = input.scrollLeft;

      this.dispatchEvent(new InputStyleCloneUpdateEvent());
    });
  }

  #isLayoutUpdating = false;

  /** Request a layout update. Will only happen once per animation frame, to avoid unecessary updates. */
  #requestUpdateLayout() {
    if (this.#isLayoutUpdating) return;
    this.#isLayoutUpdating = true;

    requestAnimationFrame(() => {
      this.#updateLayout();
      this.#isLayoutUpdating = false;
    });
  }

  /** Update the styles of the clone based on the styles of the input, then request a layout update. */
  #updateStyles() {
    this.#usingInput((input) => {
      const inputStyle = window.getComputedStyle(input);

      for (const prop of propertiesToCopy) this.#cloneElement.style[prop] = inputStyle[prop];

      this.#requestUpdateLayout();
    });
  }

  /**
   * Update the text content of the clone based on the text content of the input. Triggers a layout update in case the
   * text update caused scrolling.
   */
  #updateText() {
    this.#usingInput((input) => {
      this.#cloneElement.textContent = input.value;

      // This is often unecessary on a pure text update, but text updates could potentially cause layout updates like
      // scrolling or resizing. And we run the update on _every frame_ when scrolling, so this isn't that expensive.
      // We don't requestUpdateLayout here because this one should happen synchronously, so that clients can react
      // within their own `input` event handlers.
      this.#updateLayout();
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
  // RTL / vertical writing modes support:
  "direction",
  "writingMode",
  "unicodeBidi",
  "textOrientation",

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

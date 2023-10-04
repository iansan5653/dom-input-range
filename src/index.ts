import {DOMRectListLike} from "./dom-rect-list-like.js";
import {InputElement, InputStyleClone} from "./input-style-clone.js";

/**
 * A fragment of a document that can contain only pieces of a single text node. Does not implement `Range` methods
 * that operate with other nodes or directly mutate the contents of the `Range`.
 */
interface ReadonlyTextRange
  extends AbstractRange,
    Pick<
      Range,
      | "commonAncestorContainer"
      | "cloneContents"
      | "collapse"
      | "getBoundingClientRect"
      | "getClientRects"
      | "toString"
    > {
  /** The range only operates on a single `Text` node, so only the offsets can be set. */
  setStartOffset(offset: number): void;
  /** The range only operates on a single `Text` node, so only the offsets can be set. */
  setEndOffset(offset: number): void;
}

export class InputRange implements ReadonlyTextRange {
  #inputElement: InputElement;

  #startOffset: number;
  #endOffset: number;

  constructor(
    element: InputElement,
    startOffset: number,
    endOffset = startOffset
  ) {
    this.#inputElement = element;
    this.#startOffset = startOffset;
    this.#endOffset = endOffset;
  }

  static fromSelection(input: InputElement) {
    const {selectionStart, selectionEnd} = input;
    return new InputRange(input, selectionStart, selectionEnd);
  }

  get collapsed() {
    return this.startOffset === this.endOffset;
  }

  get commonAncestorContainer() {
    return this.#inputElement;
  }

  get endContainer() {
    return this.#inputElement;
  }

  get startContainer() {
    return this.#inputElement;
  }

  get startOffset() {
    return this.#startOffset;
  }

  get endOffset() {
    return this.#endOffset;
  }

  // This could just be a regular setter, but the DOM Range API has `startOffset` and `endOffset` as readonly properties
  // so this better aligns with expectations.
  setStartOffset(offset: number) {
    this.#startOffset = this.#clampOffset(offset);
  }

  setEndOffset(offset: number) {
    this.#endOffset = this.#clampOffset(offset);
  }

  collapse(toStart = false) {
    if (toStart) this.setEndOffset(this.startOffset);
    else this.setStartOffset(this.endOffset);
  }

  /** Always returns a `Text` node containing the content in the range. */
  cloneContents() {
    return this.#createCloneRange().cloneContents();
  }

  cloneRange() {
    return new InputRange(this.#inputElement, this.startOffset, this.endOffset);
  }

  getBoundingClientRect() {
    const range = this.#createCloneRange();

    const cloneRect = range.getBoundingClientRect();
    const offsetRect = this.#styleClone.offsetCloneRect(cloneRect);

    return offsetRect;
  }

  getClientRects() {
    const range = this.#createCloneRange();

    const cloneRects = Array.from(range.getClientRects());
    const offsetRects = cloneRects.map((domRect) =>
      this.#styleClone.offsetCloneRect(domRect)
    );

    return new DOMRectListLike(...offsetRects);
  }

  toString() {
    return this.#createCloneRange.toString();
  }

  // --- private ---

  get #styleClone() {
    return InputRange.getStyleCloneFor(this.#inputElement);
  }

  get #cloneElement() {
    return this.#styleClone.cloneElement;
  }

  #clampOffset(offset: number) {
    return Math.max(0, Math.min(offset, this.#inputElement.value.length));
  }

  #createCloneRange() {
    // It's tempting to create a single Range and reuse it across the lifetime of the class. However, this wouldn't be
    // accurate because the contents of the input can change and the contents of the range would become stale. So we
    // must create a new range every time we need it.
    const range = document.createRange();

    const textNode = this.#cloneElement.childNodes[0];
    if (textNode) {
      range.setStart(textNode, this.startOffset);
      range.setEnd(textNode, this.endOffset);
    }

    return range;
  }

  // --- static ---

  static #CLONE_USAGE_TIMEOUT = 5_000;

  static #cloneRegistry = new WeakMap<
    InputElement,
    {instance: InputStyleClone; removalTimeout: number}
  >();

  /**
   * Get the clone for an input, reusing an existing one if possible. Existing clones are deleted if not used, so it's
   * important that we always call this method instead of storing a reference to the clone. The clone is completely
   * private so we don't need to worry about consumers doing this incorrectly.
   */
  static getStyleCloneFor(input: InputElement) {
    const existing = this.#cloneRegistry.get(input);

    let instance: InputStyleClone;
    if (existing) {
      clearTimeout(existing.removalTimeout);
      instance = existing.instance;
    } else {
      instance = new InputStyleClone(input);
    }

    this.#cloneRegistry.set(input, {
      instance,
      removalTimeout: setTimeout(() => {
        // Delete from map before detaching to avoid race conditions where another call grabs the clone we are detaching
        this.#cloneRegistry.delete(input);
        instance.detach();
      }, InputRange.#CLONE_USAGE_TIMEOUT),
    });

    return instance;
  }
}

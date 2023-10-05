import { DOMRectListLike } from "./dom-rect-list-like.js";
import { InputElement, InputStyleClone } from "./input-style-clone.js";

/**
 * A fragment of a document that can contain only pieces of a single text node. Does not implement `Range` methods
 * that operate with other nodes or directly mutate the contents of the `Range`.
 */
export interface ReadonlyTextRange
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

  /**
   * Construct a new `InputRange`.
   * @param element The target input element that contains the content for the range.
   * @param startOffset The inclusive 0-based start offset for the range. Will be adjusted to fit in the input contents.
   * @param endOffset The exclusive 0-based end offset for the range. Will be adjusted to fit in the input contents.
   */
  constructor(element: InputElement, startOffset = 0, endOffset = startOffset) {
    this.#inputElement = element;
    this.#startOffset = startOffset;
    this.#endOffset = endOffset;
  }

  /** Create a new range from the current user selection. */
  static fromSelection(input: InputElement): InputRange {
    const { selectionStart, selectionEnd } = input;
    return new InputRange(input, selectionStart, selectionEnd);
  }

  /** Returns true if the start is equal to the end of this range. */
  get collapsed(): boolean {
    return this.startOffset === this.endOffset;
  }

  /** Always returns the containing input element. */
  get commonAncestorContainer(): InputElement {
    return this.#inputElement;
  }

  /** Always returns the containing input element. */
  get endContainer(): InputElement {
    return this.#inputElement;
  }

  /** Always returns the containing input element. */
  get startContainer(): InputElement {
    return this.#inputElement;
  }

  get startOffset(): number {
    return this.#startOffset;
  }

  get endOffset(): number {
    return this.#endOffset;
  }

  /** Update the inclusive start offset. Will be adjusted to fit within the content size. */
  setStartOffset(offset: number): void {
    this.#startOffset = this.#clampOffset(offset);
  }

  /** Update the exclusive end offset. Will be adjusted to fit within the content size. */
  setEndOffset(offset: number): void {
    this.#endOffset = this.#clampOffset(offset);
  }

  /**
   * Collapse this range to one side.
   * @param toStart If `true`, will collapse to the start side. Otherwise, will collapse to the end.
   */
  collapse(toStart = false): void {
    if (toStart) this.setEndOffset(this.startOffset);
    else this.setStartOffset(this.endOffset);
  }

  /** Returns a `DocumentFragment` containing a new `Text` node containing the content in the range. */
  cloneContents(): DocumentFragment {
    return this.#createCloneRange().cloneContents();
  }

  /** Create a copy of this range. */
  cloneRange(): InputRange {
    return new InputRange(this.#inputElement, this.startOffset, this.endOffset);
  }

  /** Obtain one rect that contains the entire contents of the range. */
  getBoundingClientRect(): DOMRect {
    const range = this.#createCloneRange();

    const cloneRect = range.getBoundingClientRect();
    const offsetRect = this.#styleClone.offsetCloneRect(cloneRect);

    return offsetRect;
  }

  /** Obtain the rects that contain contents of this range. There may be multiple if the range spans multiple lines. */
  getClientRects(): DOMRectList {
    const range = this.#createCloneRange();

    const cloneRects = Array.from(range.getClientRects());
    const offsetRects = cloneRects.map((domRect) =>
      this.#styleClone.offsetCloneRect(domRect),
    );

    return new DOMRectListLike(...offsetRects);
  }

  /** Get the contents of the range as a string. */
  toString(): string {
    return this.#createCloneRange.toString();
  }

  // --- private ---

  get #styleClone() {
    return InputRange.#getStyleCloneFor(this.#inputElement);
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
    { instance: InputStyleClone; removalTimeout: ReturnType<typeof setTimeout> }
  >();

  /**
   * Get the clone for an input, reusing an existing one if possible. Existing clones are deleted if not used, so it's
   * important that we always call this method instead of storing a reference to the clone. The clone is completely
   * private so we don't need to worry about consumers doing this incorrectly.
   */
  static #getStyleCloneFor(input: InputElement) {
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

import { type InputElement, InputStyleCloneElement } from "./input-style-clone-element.js";

export type { InputElement } from "./input-style-clone-element.js";

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
   * @param startOffset The inclusive 0-based start index for the range. Will be adjusted to fit in the input contents.
   * @param endOffset The exclusive 0-based end index for the range. Will be adjusted to fit in the input contents.
   */
  constructor(element: InputElement, startOffset = 0, endOffset = startOffset) {
    this.#inputElement = element;
    this.#startOffset = startOffset;
    this.#endOffset = endOffset;
  }

  /**
   * Create a new range from the current user selection. If the input is not focused, the range will just be the start
   * of the input (offsets `0` to `0`).
   *
   * This can be used to get the caret coordinates: if the resulting range is `collapsed`, the location of the
   * `getBoundingClientRect` will be the location of the caret caret (note, however, that the width will be `0` in
   * this case).
   */
  static fromSelection(input: InputElement): InputRange {
    const { selectionStart, selectionEnd } = input;
    return new InputRange(input, selectionStart ?? undefined, selectionEnd ?? undefined);
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

  /**
   * Obtain one rect that contains the entire contents of the range. If the range spans multiple lines, this box will
   * contain all pieces of the range but may also contain some space outside the range.
   * @see https://iansan5653.github.io/dom-input-range/demos/playground/
   */
  getBoundingClientRect(): DOMRect {
    return this.#createCloneRange().getBoundingClientRect();
  }

  /**
   * Obtain the rects that contain contents of this range. If the range spans multiple lines, there will be multiple
   * bounding boxes. These boxes can be used, for example, to draw a highlight over the range.
   * @see https://iansan5653.github.io/dom-input-range/demos/playground/
   */
  getClientRects(): DOMRectList {
    return this.#createCloneRange().getClientRects();
  }

  /** Get the contents of the range as a string. */
  toString(): string {
    return this.#createCloneRange().toString();
  }

  /**
   * Get the underlying `InputStyleClone` instance powering these calculations. This can be used to listen for
   * updates to trigger layout recalculation.
   */
  getStyleClone(): InputStyleCloneElement {
    return this.#styleClone;
  }

  // --- private ---

  get #styleClone() {
    return InputStyleCloneElement.for(this.#inputElement);
  }

  get #cloneElement() {
    return this.#styleClone;
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
}

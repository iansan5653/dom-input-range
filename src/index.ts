import {DOMRectListLike} from "./dom-rect-list-like.js";
import {InputStyleClone} from "./input-clone.js";

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
      | "detach"
      | "getBoundingClientRect"
      | "getClientRects"
      | "toString"
    > {
  /** The range only operates on a single Text node, so only the offsets can be set. */
  setStartOffset(offset: number): void;
  /** The range only operates on a single Text node, so only the offsets can be set. */
  setEndOffset(offset: number): void;
}

/** Supported targets for `InputRange`. */
type InputElement = HTMLTextAreaElement;

export class InputRange implements ReadonlyTextRange {
  #styleClone: InputStyleClone;
  #inputElement: InputElement;

  #startOffset: number;
  #endOffset: number;

  constructor(
    element: InputElement,
    startOffset: number,
    endOffset = startOffset
  ) {
    this.#inputElement = element;
    this.#styleClone = new InputStyleClone(element);
    this.#startOffset = startOffset;
    this.#endOffset = endOffset;
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
    this.#startOffset = offset;
  }

  setEndOffset(offset: number) {
    this.#endOffset = offset;
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

  /**
   * In `InputRange` is important to detach to preserve performance! If not explicitly detached, the range will remain
   * attached until the input is unmounted, which could be the lifetime of the page. This would cause a memory leak if
   * more `InputRange`s continue to be constructed without cleaning up existing ones.
   */
  detach() {
    this.#styleClone.detach();
  }

  getBoundingClientRect() {
    const range = this.#createCloneRange();

    const cloneRect = range.getBoundingClientRect();
    const offsetRect = this.#offsetCloneRect(cloneRect);

    return offsetRect;
  }

  getClientRects() {
    const range = this.#createCloneRange();

    const cloneRects = Array.from(range.getClientRects());
    const offsetRects = cloneRects.map((domRect) =>
      this.#offsetCloneRect(domRect)
    );

    return new DOMRectListLike(...offsetRects);
  }

  toString() {
    return this.#createCloneRange.toString();
  }

  // --- private ---

  get #cloneElement() {
    return this.#styleClone.cloneElement;
  }

  #createCloneRange() {
    // It's tempting to create a single Range and reuse it across the lifetime of the class. However, this wouldn't be
    // accurate because the contents of the input can change and the contents of the range would become stale. So we
    // must create a new range every time we need it.
    const textNode = this.#cloneElement.childNodes[0];

    const range = document.createRange();
    range.setStart(textNode, this.startOffset);
    range.setEnd(textNode, this.endOffset);

    return range;
  }

  /**
   * Return a copy of the passed rect, adjusted to match the position of the input element.
   */
  #offsetCloneRect(rect: DOMRect) {
    const cloneElement = this.#cloneElement;
    const inputElement = this.#inputElement;

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
}

import {DOMRectListLike} from "./dom-rect-list-like.js";
import {InputStyleClone} from "./input-clone.js";
import {InputElement} from "./types.js";

export class InputRange
  implements Omit<Pick<Range, keyof InputRange>, "cloneRange">
{
  #styleClone: InputStyleClone;
  #inputElement: InputElement;

  constructor(
    element: InputElement,
    public startOffset: number,
    public endOffset = startOffset
  ) {
    this.#inputElement = element;
    this.#styleClone = new InputStyleClone(element);
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

  collapse(toStart = false) {
    if (toStart) {
      this.endOffset = this.startOffset;
    } else {
      this.startOffset = this.endOffset;
    }
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

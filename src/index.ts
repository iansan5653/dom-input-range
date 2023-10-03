import {DOMRectListLike} from "./dom-rect-list-like.js";
import {InputStyleClone} from "./input-clone.js";
import {InputElement} from "./types.js";

export class InputRange implements Pick<Range, keyof InputRange> {
  readonly #cloneElement;
  readonly #inputElement;

  constructor(
    element: InputElement,
    public startOffset: number,
    public endOffset = startOffset
  ) {
    this.#inputElement = element;
    this.#cloneElement = new InputStyleClone(element).cloneElement;
  }

  getClientRects() {
    this.#cloneElement.textContent = this.#inputElement.value;

    const textNode = this.#cloneElement.childNodes[0];
    if (!textNode) return new DOMRectListLike();

    const range = document.createRange();

    range.setStart(textNode, this.startOffset);
    range.setEnd(textNode, this.endOffset);

    const cloneRects = Array.from(range.getClientRects());

    const offsetRects = cloneRects.map((domRect) =>
      this.#offsetCloneRect(domRect)
    );

    return new DOMRectListLike(...offsetRects);
  }

  /**
   * Return a copy of the passed rect adjusted to match the position of the input element.
   */
  #offsetCloneRect(rect: DOMRect) {
    const cloneRect = this.#cloneElement.getBoundingClientRect();
    const inputRect = this.#inputElement.getBoundingClientRect();

    // The div is not scrollable so it does not have scroll adjustment built in
    const inputScroll = {
      top: this.#inputElement.scrollTop,
      left: this.#inputElement.scrollLeft,
    };

    return new DOMRect(
      rect.left - cloneRect.top + inputRect.top - inputScroll.top,
      rect.top - cloneRect.left + inputRect.left - inputScroll.left,
      rect.width,
      rect.height
    );
  }
}

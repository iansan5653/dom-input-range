import {DOMRectListLike} from "./dom-rect-list-like.js";
import {InputStyleClone} from "./input-clone.js";
import {InputElement} from "./types.js";

export class InputRange implements Pick<Range, keyof InputRange> {
  readonly #styleClone;
  readonly #inputRef;

  constructor(
    element: InputElement,
    public startOffset: number,
    public endOffset = startOffset
  ) {
    this.#inputRef = new WeakRef(element);
    this.#styleClone = new InputStyleClone(element);
  }

  get #cloneElement() {
    return this.#styleClone.cloneElement;
  }

  get #inputElement() {
    return this.#inputRef.deref();
  }

  getClientRects() {
    const cloneElement = this.#cloneElement;
    const inputElement = this.#inputElement;

    if (!cloneElement || !inputElement) return new DOMRectListLike();

    cloneElement.textContent = inputElement.value;

    const textNode = cloneElement.childNodes[0];
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
    const cloneElement = this.#cloneElement;
    const inputElement = this.#inputElement;
    if (!cloneElement || !inputElement)
      throw new Error(
        "Failed to obtain elements to offset rect. Ensure that the function was not called after unmount."
      );

    const cloneRect = cloneElement.getBoundingClientRect();
    const inputRect = inputElement.getBoundingClientRect();

    // The div is not scrollable so it does not have scroll adjustment built in
    const inputScroll = {
      top: inputElement.scrollTop,
      left: inputElement.scrollLeft,
    };

    return new DOMRect(
      rect.left - cloneRect.top + inputRect.top - inputScroll.top,
      rect.top - cloneRect.left + inputRect.left - inputScroll.left,
      rect.width,
      rect.height
    );
  }
}

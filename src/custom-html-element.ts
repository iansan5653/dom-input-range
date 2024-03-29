/**
 * A custom element is implemented as a class which extends HTMLElement (in the
 * case of autonomous elements) or the interface you want to customize (in the
 * case of customized built-in elements).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks
 */
export abstract class CustomHTMLElement extends HTMLElement {
  /**
   * Called each time the element is added to the document. The specification
   * recommends that, as far as possible, developers should implement custom
   * element setup in this callback rather than the constructor.
   * @private
   */
  connectedCallback?(): void;
  /**
   * Called each time the element is removed from the document.
   * @private
   */
  disconnectedCallback?(): void;
  /**
   * Called each time the element is moved to a new document.
   * @private
   */
  adoptedCallback?(): void;
  /**
   * Called when attributes are changed, added, removed, or replaced.
   * @private
   */
  attributeChangedCallback?(): void;
}

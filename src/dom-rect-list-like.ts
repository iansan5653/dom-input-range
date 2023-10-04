/**
 * Looks like a `DOMRectList` so we can implement `getClientRects`.
 */
// It's not possible to extend (or just use) `DOMRectList` because the constructor is not exposed.
export class DOMRectListLike extends Array<DOMRect> implements DOMRectList {
  item(index: number) {
    return this[index] ?? null;
  }
}

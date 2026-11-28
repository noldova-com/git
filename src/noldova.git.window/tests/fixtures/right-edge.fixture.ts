/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RightEdge {
  private static readonly tolerance: number = 0.5;

  public static insideOf(element: Element, inset: number): number {
    const bounds: DOMRect = element.getBoundingClientRect();
    return bounds.left + element.clientLeft + element.clientWidth - inset * RightEdge.remPixels();
  }

  public static contentOf(element: Element): number {
    return RightEdge.insideOf(element, 0) - parseFloat(getComputedStyle(element).paddingRight);
  }

  public static endOf(element: Element): number {
    const glyph: Element | null = element.matches("[nol-icon-button]") ? element.querySelector(".nol-icon-button-glyph") : null;
    if (!Object.isNull(glyph))
      return glyph.getBoundingClientRect().right;
    const style: CSSStyleDeclaration = getComputedStyle(element);
    if (style.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(style.borderRightWidth) > 0)
      return element.getBoundingClientRect().right;
    const range: Range = document.createRange();
    range.selectNodeContents(element);
    return Math.max(...[...range.getClientRects()].map(t => t.right));
  }

  public static missesOf(root: ParentNode, edge: number, selectors: readonly string[]): readonly string[] {
    return selectors.flatMap(t => {
      const found: Element | null = root.querySelector(t);
      if (Object.isNull(found))
        return [`${t}: missing`];
      const offset: number = edge - RightEdge.endOf(found);
      return Math.abs(offset) < RightEdge.tolerance ? [] : [`${t}: ${Math.round(offset / RightEdge.remPixels() * 1000) / 1000}rem`];
    });
  }

  private static remPixels(): number {
    return parseFloat(getComputedStyle(document.documentElement).fontSize);
  }
}

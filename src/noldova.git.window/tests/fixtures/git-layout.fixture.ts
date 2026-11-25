/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Finds what a screen clips, pushes out of its host, scrolls sideways or draws over other text, as the geometry measures it. */
import "@noldova/context.core";

export class GitLayout {
  /** How far, in CSS pixels, a box may pass another before it counts, for sub-pixel rounding. */
  private static readonly SLACK: number = 1;

  /** Each problem in the screen under the root, as "what: element", empty when nothing clips, leaves the root, scrolls sideways or overlaps. */
  public static problemsOf(root: HTMLElement): readonly string[] {
    const shown: readonly HTMLElement[] = [...root.querySelectorAll<HTMLElement>("*")].filter(t => GitLayout.isShown(t));
    const texts: readonly HTMLElement[] = shown.filter(t => [...t.childNodes].some(u => u.nodeType === Node.TEXT_NODE && (u.textContent ?? "").trim().length > 0));
    const area: DOMRect = root.getBoundingClientRect();
    const problems: string[] = [];
    for (const element of shown) {
      const style: CSSStyleDeclaration = getComputedStyle(element);
      if (style.display === "inline" || element.scrollWidth <= element.clientWidth + GitLayout.SLACK)
        continue;
      if (style.overflowX === "auto" || style.overflowX === "scroll")
        problems.push(`scrolls sideways: ${GitLayout.nameOf(element)}`);
      else if (style.textOverflow !== "ellipsis")
        problems.push(`clips: ${GitLayout.nameOf(element)}`);
    }
    const seen: ReadonlyMap<HTMLElement, readonly DOMRect[]> = new Map(texts.map(t => [t, GitLayout.visibleRectsOf(t, root)]));
    for (const [text, rects] of seen)
      if (rects.some(t => t.left < area.left - GitLayout.SLACK || t.right > area.right + GitLayout.SLACK))
        problems.push(`leaves the screen: ${GitLayout.nameOf(text)}`);
    [...seen].forEach(([text, rects], i) => {
      for (const [other, others] of [...seen].slice(i + 1))
        if (!text.contains(other) && !other.contains(text) && GitLayout.overlaps(rects, others))
          problems.push(`overlaps: ${GitLayout.nameOf(text)} and ${GitLayout.nameOf(other)}`);
    });
    return problems;
  }

  private static isShown(element: HTMLElement): boolean {
    const box: DOMRect = element.getBoundingClientRect();
    return box.width > GitLayout.SLACK && box.height > GitLayout.SLACK && getComputedStyle(element).visibility !== "hidden";
  }

  /** The element's line boxes cut to every ancestor below the root that clips or scrolls its overflow, so what a scroll hides isn't counted. */
  private static visibleRectsOf(element: HTMLElement, root: HTMLElement): readonly DOMRect[] {
    let rects: DOMRect[] = [...element.getClientRects()];
    for (let parent: HTMLElement | null = element.parentElement; !Object.isNull(parent) && parent !== root; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflow === "visible")
        continue;
      const clip: DOMRect = parent.getBoundingClientRect();
      rects = rects.map(t => DOMRect.fromRect({ x: Math.max(t.left, clip.left), y: Math.max(t.top, clip.top), width: Math.min(t.right, clip.right) - Math.max(t.left, clip.left),
        height: Math.min(t.bottom, clip.bottom) - Math.max(t.top, clip.top) })).filter(t => t.width > GitLayout.SLACK && t.height > GitLayout.SLACK);
    }
    return rects;
  }

  private static overlaps(first: readonly DOMRect[], second: readonly DOMRect[]): boolean {
    return first.some(t => second.some(u =>
      Math.min(t.right, u.right) - Math.max(t.left, u.left) > GitLayout.SLACK && Math.min(t.bottom, u.bottom) - Math.max(t.top, u.top) > GitLayout.SLACK));
  }

  private static nameOf(element: HTMLElement): string {
    const text: string = (element.innerText || element.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 40);
    return `${element.localName}${[...element.classList].map(t => `.${t}`).join("")} "${text}"`;
  }
}

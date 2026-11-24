/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

/**
 * Keeps the focus on a control when the control that held it as the person pressed goes away, as a staged file's row or a dismissed banner does,
 * rather than letting it fall to the page: it moves to the control now at the pressed one's place in the nearest container that survives, such as the
 * next row's same button or the new state's first button; while none is there, as when a spinner stands in for the next state, it waits for one, until
 * the focus goes elsewhere or the person presses again.
 */
export class FocusKeeper {
  /** Keeps the focus within the root until the returned function stops it. */
  public static keep(root: HTMLElement): () => void {
    let watching: MutationObserver | null = null;
    const stop = (): void => {
      watching?.disconnect();
      watching = null;
    };
    const pressed = (): void => {
      stop();
      const control: HTMLElement | null = root.querySelector<HTMLElement>(Resources.focusedSelector);
      if (control === null)
        return;
      const places: readonly (readonly [Element, number])[] = FocusKeeper.placesOf(root, control);
      const observer: MutationObserver = new MutationObserver(() => {
        if (control.isConnected)
          return;
        if (document.activeElement !== document.body) {
          stop();
          return;
        }
        const survivor: readonly [HTMLElement, readonly HTMLElement[]] | null = FocusKeeper.survivorOf(places);
        if (survivor === null)
          return;
        stop();
        FocusKeeper.focus(...survivor);
      });
      watching = observer;
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [Resources.disabledAttribute] });
    };
    root.addEventListener("click", pressed, true);
    return () => {
      stop();
      root.removeEventListener("click", pressed, true);
    };
  }

  /** Each container from the control's up to the root, with the control's place among the controls in it. */
  private static placesOf(root: HTMLElement, control: HTMLElement): readonly (readonly [Element, number])[] {
    const places: (readonly [Element, number])[] = [];
    for (let at: Element | null = control.parentElement; at !== null; at = at === root ? null : at.parentElement)
      places.push([at, FocusKeeper.controlsOf(at).indexOf(control)]);
    return places;
  }

  /**
   * The control at the pressed one's place, or the last one before it, in the nearest container that is still there and holds any, with the controls
   * before it there.
   */
  private static survivorOf(places: readonly (readonly [Element, number])[]): readonly [HTMLElement, readonly HTMLElement[]] | null {
    for (const [container, place] of places) {
      const controls: readonly HTMLElement[] = container.isConnected ? FocusKeeper.controlsOf(container) : [];
      const at: number = Math.min(place, controls.length - 1);
      const survivor: HTMLElement | undefined = controls[at];
      if (survivor !== undefined)
        return [survivor, controls.slice(0, at)];
    }
    return null;
  }

  /**
   * Focuses the survivor; when it can't take the focus, as a row's button shown only while the row holds the focus can't, it focuses the nearest
   * control before it that can, then the survivor again, which that control may have shown.
   */
  private static focus(survivor: HTMLElement, before: readonly HTMLElement[]): void {
    for (const control of [survivor, ...[...before].reverse()]) {
      control.focus();
      if (document.activeElement === control) {
        survivor.focus();
        return;
      }
    }
  }

  private static controlsOf(container: Element): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(Resources.focusableSelector)];
  }
}

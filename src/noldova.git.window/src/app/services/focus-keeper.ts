/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { FocusPlace } from "../models/focus-place.ts";
import { FocusSurvivor } from "../models/focus-survivor.ts";

export class FocusKeeper {
  public static keep(root: HTMLElement): () => void {
    let watching: MutationObserver | null = null;
    const stop = (): void => {
      watching?.disconnect();
      watching = null;
    };
    const pressed = (): void => {
      stop();
      const control: HTMLElement | null = root.querySelector<HTMLElement>(Resources.focusedSelector);
      if (Object.isNull(control))
        return;
      const places: readonly FocusPlace[] = FocusKeeper.placesOf(root, control);
      const observer: MutationObserver = new MutationObserver(() => {
        if (control.isConnected)
          return;
        if (document.activeElement !== document.body) {
          stop();
          return;
        }
        const survivor: FocusSurvivor | null = FocusKeeper.survivorOf(places);
        if (Object.isNull(survivor))
          return;
        stop();
        FocusKeeper.focus(survivor.control, survivor.before);
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

  private static placesOf(root: HTMLElement, control: HTMLElement): readonly FocusPlace[] {
    const places: FocusPlace[] = [];
    for (let at: Element | null = control.parentElement; !Object.isNull(at); at = at === root ? null : at.parentElement)
      places.push(new FocusPlace(at, FocusKeeper.controlsOf(at).indexOf(control)));
    return places;
  }

  private static survivorOf(places: readonly FocusPlace[]): FocusSurvivor | null {
    for (const place of places) {
      const controls: readonly HTMLElement[] = place.container.isConnected ? FocusKeeper.controlsOf(place.container) : [];
      const at: number = Math.min(place.place, controls.length - 1);
      const survivor: HTMLElement | undefined = controls[at];
      if (!Object.isUndefined(survivor))
        return new FocusSurvivor(survivor, controls.slice(0, at));
    }
    return null;
  }

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

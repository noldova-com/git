/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A container the pressed control was in, from its own up to the root, with the control's place among the controls in it. */
export class FocusPlace {
  public readonly container: Element;
  /** The pressed control's index among the container's controls. */
  public readonly place: number;

  public constructor(container: Element, place: number) {
    this.container = container;
    this.place = place;
  }
}

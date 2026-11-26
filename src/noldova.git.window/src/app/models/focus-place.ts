/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FocusPlace {
  public readonly container: Element;
  public readonly place: number;

  public constructor(container: Element, place: number) {
    this.container = container;
    this.place = place;
  }
}

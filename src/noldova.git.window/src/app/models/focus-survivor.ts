/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FocusSurvivor {
  public readonly control: HTMLElement;
  public readonly before: readonly HTMLElement[];

  public constructor(control: HTMLElement, before: readonly HTMLElement[]) {
    this.control = control;
    this.before = before;
  }
}

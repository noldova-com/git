/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** One of Azure DevOps's merge types, as its Complete panel names it. */
export class MergeTypeChoice {
  public readonly type: string;
  public readonly label: string;

  public constructor(type: string, label: string) {
    this.type = type;
    this.label = label;
  }
}

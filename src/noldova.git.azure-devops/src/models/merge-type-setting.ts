/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MergeTypeSetting {
  public readonly type: string;
  public readonly setting: string;

  public constructor(type: string, setting: string) {
    this.type = type;
    this.setting = setting;
  }
}

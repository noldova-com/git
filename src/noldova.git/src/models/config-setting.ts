/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConfigSetting {
  public readonly key: string;
  public readonly value: string;

  public constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
}

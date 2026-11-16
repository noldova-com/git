/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DeviceCode } from "@noldova/git.hosting.protocol";

export class DeviceGrant {
  public readonly deviceCode: string;
  public readonly code: DeviceCode;
  public readonly expiresIn: number;
  public readonly interval: number;

  public constructor(deviceCode: string, code: DeviceCode, expiresIn: number, interval: number) {
    this.deviceCode = deviceCode;
    this.code = code;
    this.expiresIn = expiresIn;
    this.interval = interval;
  }
}

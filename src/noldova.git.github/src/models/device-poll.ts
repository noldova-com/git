/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DevicePoll {
  public readonly token: string | null;
  public readonly slowDown: boolean;
  public readonly interval: number | null;

  private constructor(token: string | null, slowDown: boolean, interval: number | null) {
    this.token = token;
    this.slowDown = slowDown;
    this.interval = interval;
  }

  public static pending(): DevicePoll {
    return new DevicePoll(null, false, null);
  }

  public static slowedDown(interval: number | null): DevicePoll {
    return new DevicePoll(null, true, interval);
  }

  public static granted(token: string): DevicePoll {
    return new DevicePoll(token, false, null);
  }
}

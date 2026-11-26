/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RedirectAnswer {
  public readonly code: string | null;
  public readonly error: string | null;

  public constructor(code: string | null, error: string | null) {
    this.code = code;
    this.error = error;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export class DesktopRangeRead {
  public readonly range: string | null;
  public readonly findings: readonly string[];

  public constructor(range: string | null, findings: readonly string[]) {
    this.range = range;
    this.findings = findings;
  }
}

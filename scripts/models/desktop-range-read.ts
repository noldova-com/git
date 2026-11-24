/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
/** The one Noldova Desktop range every archive's module.json names, or null when they differ or one names none, and what the check found wrong. */
export class DesktopRangeRead {
  public readonly range: string | null;
  public readonly findings: readonly string[];

  public constructor(range: string | null, findings: readonly string[]) {
    this.range = range;
    this.findings = findings;
  }
}

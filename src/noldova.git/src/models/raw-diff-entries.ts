/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { IRawDiffEntry } from "../interfaces/i-raw-diff-entry.ts";

export class RawDiffEntries {
  public readonly entries: IRawDiffEntry[];
  public readonly patch: Buffer;

  public constructor(entries: IRawDiffEntry[], patch: Buffer) {
    this.entries = entries;
    this.patch = patch;
  }
}

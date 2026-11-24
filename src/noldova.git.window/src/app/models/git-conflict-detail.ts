/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ActiveConflict, ShikiLineTokenizer } from "@noldova/editor.angular";

/** What the Conflict view shows of a conflicts document: its active conflict, with its base, and the check before the commit. */
export class GitConflictDetail {
  /** The merge editor's active conflict, with its base and its lines in the result, or `null` while none is. */
  public readonly active: ActiveConflict | null;
  /** The open file's tokenizer, which colors the base's code, or `null` while it loads or when no language fits the file. */
  public readonly tokenizer: ShikiLineTokenizer | null;
  /** The files out of conflict that still have a conflict marker line, or `null` until the check answers or after it fails. */
  public readonly leftoverMarkers: readonly string[] | null;
  /** Why the check for conflict markers failed, or `null` while it didn't. */
  public readonly markerFailure: string | null;

  public constructor(active: ActiveConflict | null, tokenizer: ShikiLineTokenizer | null, leftoverMarkers: readonly string[] | null,
    markerFailure: string | null) {
    this.active = active;
    this.tokenizer = tokenizer;
    this.leftoverMarkers = leftoverMarkers;
    this.markerFailure = markerFailure;
  }
}

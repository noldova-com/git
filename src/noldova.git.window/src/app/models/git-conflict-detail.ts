/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ActiveConflict, ShikiLineTokenizer } from "@noldova/editor.angular";

export class GitConflictDetail {
  public readonly active: ActiveConflict | null;
  public readonly tokenizer: ShikiLineTokenizer | null;
  public readonly leftoverMarkers: readonly string[] | null;
  public readonly markerFailure: string | null;

  public constructor(active: ActiveConflict | null, tokenizer: ShikiLineTokenizer | null, leftoverMarkers: readonly string[] | null,
    markerFailure: string | null) {
    this.active = active;
    this.tokenizer = tokenizer;
    this.leftoverMarkers = leftoverMarkers;
    this.markerFailure = markerFailure;
  }
}

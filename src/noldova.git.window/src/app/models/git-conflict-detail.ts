/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ActiveConflict } from "@noldova/code.editor.merge.angular";

export class GitConflictDetail {
  public readonly active: ActiveConflict | null;
  public readonly language: string | null;
  public readonly leftoverMarkers: readonly string[] | null;
  public readonly markerFailure: string | null;

  public constructor(active: ActiveConflict | null, language: string | null, leftoverMarkers: readonly string[] | null,
    markerFailure: string | null) {
    this.active = active;
    this.language = language;
    this.leftoverMarkers = leftoverMarkers;
    this.markerFailure = markerFailure;
  }
}

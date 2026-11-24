/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

/** Finds git's conflict marker lines, seven `<`, `|`, `=` or `>` at a line's start, in a file's text. */
export class ConflictMarkers {
  public static has(text: string): boolean {
    return Resources.conflictMarkerPattern.test(text);
  }
}

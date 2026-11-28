/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class ChangedPathsParser {

  public static parse(output: Buffer): Buffer[] {
    const paths: Buffer[] = [];
    let start = 0;
    let isOriginalPath = false;
    while (start < output.length) {
      const end = output.indexOf(Resources.nulByte, start);
      const entry = output.subarray(start, end < 0 ? output.length : end);
      start = end < 0 ? output.length : end + 1;
      if (isOriginalPath) {
        isOriginalPath = false;
        continue;
      }
      const kind = entry.toString(Resources.latin1Encoding, 0, 1);
      const fields = Resources.statusFieldCounts.get(kind);
      if (Object.isUndefined(fields))
        continue;
      paths.push(entry.subarray(ChangedPathsParser.pathStart(entry, fields)));
      isOriginalPath = kind === Resources.renamedEntryKind;
    }
    return paths;
  }

  private static pathStart(entry: Buffer, fields: number): number {
    let start = 0;
    for (let field = 0; field < fields; field++)
      start = entry.indexOf(Resources.spaceByte, start) + 1;
    return start;
  }
}

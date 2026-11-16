/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class PathBatches {

  public static split(paths: readonly string[]): string[][] {
    const batches: string[][] = [];
    let batch: string[] = [];
    let size = 0;
    for (const path of paths) {
      const cost = path.length + Resources.pathQuotingCost;
      if (batch.length > 0 && size + cost > Resources.pathBatchBytes) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(path);
      size += cost;
    }
    if (batch.length > 0)
      batches.push(batch);
    return batches;
  }
}

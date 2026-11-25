/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { GitFileLayout } from "../enums/git-file-layout.ts";
import { GitFileItem } from "../models/git-file-item.ts";
import type { GitFileRow } from "../models/git-file-row.ts";
import { Resources } from "../../resources.ts";
import { GitPathLayout } from "./git-path-layout.ts";

/** Lays a group's files out as items, in one of the three layouts. */
export class GitFileTree {
  /** The items to show; a closed folder's rows are left out. */
  public static itemsOf(rows: readonly GitFileRow[], layout: GitFileLayout, closed: ReadonlySet<string>): GitFileItem[] {
    return GitPathLayout.layout(rows, t => t.path, layout, closed).map(t => Object.isNull(t.item)
      ? new GitFileItem(Resources.formatFolderKey(t.folder), t.folder, t.name, null, t.depth)
      : new GitFileItem(t.item.key, "", t.name, t.item, t.depth));
  }
}

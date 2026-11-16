/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WorktreeEntry } from "../models/worktree-entry.ts";
import { Resources } from "../resources.ts";

export class WorktreeListParser {

  public static parse(output: Buffer): WorktreeEntry[] {
    const entries: WorktreeEntry[] = [];
    let attributes: string[] = [];
    for (const attribute of output.toString(Resources.utf8Encoding).split(Resources.recordSeparator)) {
      if (attribute.length > 0) {
        attributes.push(attribute);
        continue;
      }
      if (attributes.length > 0)
        entries.push(WorktreeListParser.parseEntry(attributes));
      attributes = [];
    }
    return entries;
  }

  private static parseEntry(attributes: readonly string[]): WorktreeEntry {
    let folder = "";
    let head: string | null = null;
    let branch: string | null = null;
    let lockReason: string | null = null;
    let isPrunable = false;
    for (const attribute of attributes) {
      const separator = attribute.indexOf(Resources.wordSeparator);
      const name = separator < 0 ? attribute : attribute.slice(0, separator);
      const value = separator < 0 ? "" : attribute.slice(separator + 1);
      switch (name) {
        case Resources.worktreeAttribute:
          folder = value;
          break;
        case Resources.headAttribute:
          head = value;
          break;
        case Resources.branchAttribute:
          branch = value.startsWith(Resources.branchRefsPrefix) ? value.slice(Resources.branchRefsPrefix.length) : value;
          break;
        case Resources.lockedAttribute:
          lockReason = value;
          break;
        case Resources.prunableAttribute:
          isPrunable = true;
          break;
      }
    }
    return new WorktreeEntry(folder, head, branch, lockReason, isPrunable);
  }
}

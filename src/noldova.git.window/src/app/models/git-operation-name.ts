/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type GitOperation, OperationKind } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

/** What an operation in progress applies, as a person reads it in "Merging <name> into main". */
export class GitOperationName {
  /**
   * A merge's branch or tag from git's prepared message, since the runtime sends the merge head's id; else the operation's own name, with a
   * full commit id shortened; `null` when the operation names nothing.
   */
  public static of(operation: GitOperation): string | null {
    const name: string | null = operation.kind === OperationKind.Merge ? Resources.mergedNamePattern.exec(operation.message ?? "")?.[1] ?? operation.from : operation.from;
    return !Object.isNull(name) && Resources.objectIdPattern.test(name) ? name.slice(0, Resources.shortIdLength) : name;
  }
}

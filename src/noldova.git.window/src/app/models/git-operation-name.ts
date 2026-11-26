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

export class GitOperationName {
  public static of(operation: GitOperation): string | null {
    const name: string | null = operation.kind === OperationKind.Merge ? Resources.mergedNamePattern.exec(operation.message ?? "")?.[1] ?? operation.from : operation.from;
    return !Object.isNull(name) && Resources.objectIdPattern.test(name) ? name.slice(0, Resources.shortIdLength) : name;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitOperation, OperationKind } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitOperationName } from "../../../src/app/models/git-operation-name.ts";

describe("GitOperationName", () => {
  const id: string = "1820bd3066de892c96c573700b94416c51a88c8c";
  const merge = (message: string | null): string | null => GitOperationName.of(new GitOperation(OperationKind.Merge, id, message));

  it("names a merge by what git's prepared message says it merges, as the runtime sends the merge head's id", () => {
    expect([
      merge("Merge branch 'fix/rename-detection'"),
      merge("Merge branch 'main' into sample/1234-branch"),
      merge("Merge remote-tracking branch 'origin/main'"),
      merge("Merge tag 'v0.0.6'"),
      merge("Merge branch 'main' of host-1.example:notes")
    ]).toEqual(["fix/rename-detection", "main", "origin/main", "v0.0.6", "main"]);
  });

  it("names a merge by its head's short id when the message names no single branch or tag, or names a commit", () => {
    expect([
      merge(null),
      merge("Merge branches 'a' and 'b'"),
      merge("A message the person wrote"),
      merge(`Merge commit '${id}'`)
    ]).toEqual(["1820bd3", "1820bd3", "1820bd3", "1820bd3"]);
  });

  it("names a cherry-pick or revert by its commit's short id, a rebase by its branch, and nothing when the operation names nothing", () => {
    const long: string = "ab".repeat(32);

    expect([
      GitOperationName.of(new GitOperation(OperationKind.CherryPick, id, "Draw lanes on a canvas")),
      GitOperationName.of(new GitOperation(OperationKind.Revert, long, "Revert \"Draw lanes\"")),
      GitOperationName.of(new GitOperation(OperationKind.Rebase, "feature/graph-canvas", null)),
      GitOperationName.of(new GitOperation(OperationKind.Rebase, null, null))
    ]).toEqual(["1820bd3", "abababa", "feature/graph-canvas", null]);
  });
});

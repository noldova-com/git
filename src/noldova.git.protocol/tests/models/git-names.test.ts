/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { describe, it } from "vitest";

import { JsonReader } from "@noldova/context.json";

import { GitNames } from "../../src/api/index.ts";

describe("GitNames", () => {
  it("names the module as its module.json declares it", () => {
    const declaration = JsonReader.parse(readFileSync(new URL("../../../noldova.git/module.json", import.meta.url), "utf8"));

    assert.equal(GitNames.moduleId, declaration.readString("id"));
  });

  it("names the folder an app binds to an agent session under the module's id", () => {
    assert.equal(GitNames.folderBinding, "git.folder");
  });

  it("names the service the runtime part publishes for the modules that depend on it under the module's id", () => {
    assert.equal(GitNames.repositoriesService, "git.repositories");
  });

  it("names the agent tools the module declares, each under the module's id", () => {
    const declaration = JsonReader.parse(readFileSync(new URL("../../../noldova.git/module.json", import.meta.url), "utf8"));

    assert.deepEqual([GitNames.statusTool, GitNames.diffTool, GitNames.logTool, GitNames.branchesTool, GitNames.stageTool, GitNames.unstageTool,
      GitNames.createBranchTool, GitNames.switchBranchTool, GitNames.commitTool, GitNames.pushTool, GitNames.pullTool], declaration.readObject("contributes").readStringArray("tools"));
  });

  it("names each method and the change event under the module's id", () => {
    assert.deepEqual([
      GitNames.statusMethod,
      GitNames.diffMethod,
      GitNames.branchesMethod,
      GitNames.logMethod,
      GitNames.worktreesMethod,
      GitNames.stageMethod,
      GitNames.unstageMethod,
      GitNames.createBranchMethod,
      GitNames.switchBranchMethod,
      GitNames.commitMethod,
      GitNames.pushMethod,
      GitNames.pullMethod,
      GitNames.pullHooksMethod,
      GitNames.watchMethod,
      GitNames.unwatchMethod,
      GitNames.changedEvent
    ], [
      "git.status",
      "git.diff",
      "git.branches",
      "git.log",
      "git.worktrees",
      "git.stage",
      "git.unstage",
      "git.createBranch",
      "git.switchBranch",
      "git.commit",
      "git.push",
      "git.pull",
      "git.pullHooks",
      "git.watch",
      "git.unwatch",
      "git.changed"
    ]);
  });
});

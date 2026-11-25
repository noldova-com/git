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

  it("names the remote branches' read under the module's id, as its module.json declares it", () => {
    const declaration = JsonReader.parse(readFileSync(new URL("../../../noldova.git/module.json", import.meta.url), "utf8"));

    assert.equal(GitNames.remoteTracksMethod, "git.remoteTracks");
    assert.ok(declaration.readObject("contributes").readStringArray("methods").includes(GitNames.remoteTracksMethod));
  });

  it("names the commit signing read under the module's id, as its module.json declares it", () => {
    const declaration = JsonReader.parse(readFileSync(new URL("../../../noldova.git/module.json", import.meta.url), "utf8"));

    assert.equal(GitNames.commitSigningMethod, "git.commitSigning");
    assert.ok(declaration.readObject("contributes").readStringArray("methods").includes(GitNames.commitSigningMethod));
  });

  it("names each method and the change event under the module's id", () => {
    assert.deepEqual([
      GitNames.statusMethod,
      GitNames.diffMethod,
      GitNames.diffTotalsMethod,
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
      GitNames.avatarMethod,
      GitNames.renameBranchMethod,
      GitNames.deleteBranchMethod,
      GitNames.createTagMethod,
      GitNames.deleteTagMethod,
      GitNames.stageLinesMethod,
      GitNames.unstageLinesMethod,
      GitNames.watchMethod,
      GitNames.unwatchMethod,
      GitNames.journalMethod,
      GitNames.undoMethod,
      GitNames.resetMethod,
      GitNames.undoCommitMethod,
      GitNames.forcePushMethod,
      GitNames.conflictMethod,
      GitNames.resolveConflictMethod,
      GitNames.markerCheckMethod,
      GitNames.continueOperationMethod,
      GitNames.abortOperationMethod,
      GitNames.predictMethod,
      GitNames.mergeMethod,
      GitNames.fetchMethod,
      GitNames.stashMethod,
      GitNames.rebasePlanMethod,
      GitNames.rebaseCheckMethod,
      GitNames.rebaseMethod,
      GitNames.commitSignatureMethod,
      GitNames.changedEvent
    ], [
      "git.status",
      "git.diff",
      "git.diffTotals",
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
      "git.avatar",
      "git.renameBranch",
      "git.deleteBranch",
      "git.createTag",
      "git.deleteTag",
      "git.stageLines",
      "git.unstageLines",
      "git.watch",
      "git.unwatch",
      "git.journal",
      "git.undo",
      "git.reset",
      "git.undoCommit",
      "git.forcePush",
      "git.conflict",
      "git.resolveConflict",
      "git.markerCheck",
      "git.continueOperation",
      "git.abortOperation",
      "git.predict",
      "git.merge",
      "git.fetch",
      "git.stash",
      "git.rebasePlan",
      "git.rebaseCheck",
      "git.rebase",
      "git.commitSignature",
      "git.changed"
    ]);
  });
});

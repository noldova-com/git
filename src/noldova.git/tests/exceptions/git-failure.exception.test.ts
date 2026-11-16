/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { UntrustedSource } from "@noldova/git.protocol";

import { AlreadyOnBranchException } from "../../src/exceptions/already-on-branch.exception.ts";
import { BaseInvalidException } from "../../src/exceptions/base-invalid.exception.ts";
import { BranchCheckedOutException } from "../../src/exceptions/branch-checked-out.exception.ts";
import { BranchExistsException } from "../../src/exceptions/branch-exists.exception.ts";
import { BranchInvalidException } from "../../src/exceptions/branch-invalid.exception.ts";
import { BranchKeptException } from "../../src/exceptions/branch-kept.exception.ts";
import { BranchUnmergedException } from "../../src/exceptions/branch-unmerged.exception.ts";
import { ChangesTooLargeException } from "../../src/exceptions/changes-too-large.exception.ts";
import { ChangesTooSlowException } from "../../src/exceptions/changes-too-slow.exception.ts";
import { ChangesUnreadableException } from "../../src/exceptions/changes-unreadable.exception.ts";
import { ColumnInvalidException } from "../../src/exceptions/column-invalid.exception.ts";
import { CommitConflictsException } from "../../src/exceptions/commit-conflicts.exception.ts";
import { CommitHookFailedException } from "../../src/exceptions/commit-hook-failed.exception.ts";
import { CredentialsNeededException } from "../../src/exceptions/credentials-needed.exception.ts";
import { FilterNotSwitchableException } from "../../src/exceptions/filter-not-switchable.exception.ts";
import { FilterSubmodulesTooManyException } from "../../src/exceptions/filter-submodules-too-many.exception.ts";
import { FolderNotAbsoluteException } from "../../src/exceptions/folder-not-absolute.exception.ts";
import { FolderUnreadableException } from "../../src/exceptions/folder-unreadable.exception.ts";
import { GhMissingException } from "../../src/exceptions/gh-missing.exception.ts";
import { GitFailedException } from "../../src/exceptions/git-failed.exception.ts";
import { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { GitMissingException } from "../../src/exceptions/git-missing.exception.ts";
import { GitTooOldException } from "../../src/exceptions/git-too-old.exception.ts";
import { HooksUnreadableException } from "../../src/exceptions/hooks-unreadable.exception.ts";
import { HostKeyUnknownException } from "../../src/exceptions/host-key-unknown.exception.ts";
import { IndexLockedException } from "../../src/exceptions/index-locked.exception.ts";
import { KeyInOtherRepositoryException } from "../../src/exceptions/key-in-other-repository.exception.ts";
import { KeyRefusedException } from "../../src/exceptions/key-refused.exception.ts";
import { LockedElsewhereException } from "../../src/exceptions/locked-elsewhere.exception.ts";
import { NotARepositoryException } from "../../src/exceptions/not-a-repository.exception.ts";
import { NothingStagedException } from "../../src/exceptions/nothing-staged.exception.ts";
import { NothingToPushException } from "../../src/exceptions/nothing-to-push.exception.ts";
import { OutputLimitInvalidException } from "../../src/exceptions/output-limit-invalid.exception.ts";
import { ProgramTimedOutException } from "../../src/exceptions/program-timed-out.exception.ts";
import { PullChangesInTheWayException } from "../../src/exceptions/pull-changes-in-the-way.exception.ts";
import { PullConflictsException } from "../../src/exceptions/pull-conflicts.exception.ts";
import { PullDetachedException } from "../../src/exceptions/pull-detached.exception.ts";
import { PullDivergedException } from "../../src/exceptions/pull-diverged.exception.ts";
import { PullNoUpstreamException } from "../../src/exceptions/pull-no-upstream.exception.ts";
import { PushBehindException } from "../../src/exceptions/push-behind.exception.ts";
import { PushDetachedException } from "../../src/exceptions/push-detached.exception.ts";
import { PushNoRemoteException } from "../../src/exceptions/push-no-remote.exception.ts";
import { PushRejectedException } from "../../src/exceptions/push-rejected.exception.ts";
import { RepositoryNotAbsoluteException } from "../../src/exceptions/repository-not-absolute.exception.ts";
import { RequestDeniedException } from "../../src/exceptions/request-denied.exception.ts";
import { RequestExpiredException } from "../../src/exceptions/request-expired.exception.ts";
import { RequestMovedException } from "../../src/exceptions/request-moved.exception.ts";
import { RequestTooLargeException } from "../../src/exceptions/request-too-large.exception.ts";
import { RequestWithdrawnException } from "../../src/exceptions/request-withdrawn.exception.ts";
import { StaleRemovalException } from "../../src/exceptions/stale-removal.exception.ts";
import { StatusMovedException } from "../../src/exceptions/status-moved.exception.ts";
import { SwitchChangesInTheWayException } from "../../src/exceptions/switch-changes-in-the-way.exception.ts";
import { SwitchDuringOperationException } from "../../src/exceptions/switch-during-operation.exception.ts";
import { TimeLimitInvalidException } from "../../src/exceptions/time-limit-invalid.exception.ts";
import { UnreadableOutputException } from "../../src/exceptions/unreadable-output.exception.ts";
import { UpstreamNotSetException } from "../../src/exceptions/upstream-not-set.exception.ts";
import { WorktreeBranchCheckedOutException } from "../../src/exceptions/worktree-branch-checked-out.exception.ts";
import { WorktreeListTooLargeException } from "../../src/exceptions/worktree-list-too-large.exception.ts";
import { WorktreeListTruncatedException } from "../../src/exceptions/worktree-list-truncated.exception.ts";
import { WorktreeMissingException } from "../../src/exceptions/worktree-missing.exception.ts";
import { WorktreeOutcomeUnknownException } from "../../src/exceptions/worktree-outcome-unknown.exception.ts";
import { WorktreeWithdrawnException } from "../../src/exceptions/worktree-withdrawn.exception.ts";
import { WriteOutcomeUnknownException } from "../../src/exceptions/write-outcome-unknown.exception.ts";

describe("GitFailureException", () => {
  test("is the base of every failure the module answers on the wire", () => {
    const output = { text: "fatal: the remote said no", source: UntrustedSource.Repository };
    const cause = new Error("The operation was aborted.");
    const failures = [
      new WorktreeOutcomeUnknownException(cause),
      new WorktreeWithdrawnException(cause),
      new RequestTooLargeException(),
      new GitFailedException("status", output),
      new SwitchDuringOperationException(),
      new CommitConflictsException(),
      new PullConflictsException(),
      new AlreadyOnBranchException("main"),
      new SwitchChangesInTheWayException(["a.txt"], output),
      new PullChangesInTheWayException(["a.txt"], output),
      new BranchCheckedOutException("main", output),
      new WorktreeBranchCheckedOutException("noldova/a1"),
      new ChangesTooLargeException(),
      new ChangesTooSlowException(cause),
      new ChangesUnreadableException(cause),
      new NothingStagedException(),
      new CommitHookFailedException(output),
      new UnreadableOutputException("log", "commits", cause),
      new FilterNotSwitchableException(),
      new FilterSubmodulesTooManyException(256),
      new GitTooOldException("2.34.1"),
      new HooksUnreadableException(),
      new IndexLockedException(),
      new GitMissingException("git", cause),
      new GhMissingException("gh", cause),
      new ProgramTimedOutException("git", 30_000),
      new PullDivergedException(),
      new PullDetachedException(),
      new PullNoUpstreamException(),
      new PushBehindException(),
      new PushRejectedException(output),
      new NothingToPushException(),
      new PushDetachedException(),
      new PushNoRemoteException(),
      new UpstreamNotSetException(output),
      new HostKeyUnknownException(output),
      new KeyRefusedException(output),
      new CredentialsNeededException(output),
      new RepositoryNotAbsoluteException("relative"),
      new NotARepositoryException("/tmp/a"),
      new FolderUnreadableException("/tmp/a", cause),
      new ColumnInvalidException("state"),
      new KeyInOtherRepositoryException(),
      new WorktreeMissingException(),
      new LockedElsewhereException("/tmp/w"),
      new StaleRemovalException(),
      new BranchKeptException("noldova/a1", output),
      new BranchUnmergedException("noldova/a1", output),
      new BaseInvalidException("v9"),
      new BranchInvalidException("a..b"),
      new BranchExistsException("topic"),
      new WorktreeListTooLargeException(),
      new WorktreeListTruncatedException(),
      new RequestMovedException(),
      new StatusMovedException(),
      new WriteOutcomeUnknownException(cause),
      new RequestExpiredException(),
      new RequestWithdrawnException(),
      new RequestDeniedException()
    ];

    for (const failure of failures)
      assert.ok(failure instanceof GitFailureException, failure.name);
  });

  test("leaves out the checks of the module's own arguments, which are internal", () => {
    const internals = [
      new OutputLimitInvalidException(0),
      new TimeLimitInvalidException(1.5),
      new FolderNotAbsoluteException("working folder", "relative")
    ];

    for (const internal of internals)
      assert.ok(!(internal instanceof GitFailureException), internal.name);
  });
});

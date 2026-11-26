/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import {
  CaptureOutcome, CaptureRequest, CaptureResult, PreviewOutcome, PreviewRequest, PreviewResult, RestoreOutcome, RestoreRequest, RestoreResult
} from "@noldova/checkpoints.protocol";
import { FailureCode } from "@noldova/git.protocol";
import { describe, test } from "vitest";

import { CheckpointFailedException } from "../../src/exceptions/checkpoint-failed.exception.ts";
import { UndoNotPossibleException } from "../../src/exceptions/undo-not-possible.exception.ts";
import { CheckpointStore } from "../../src/services/checkpoint-store.ts";
import { FakeCheckpoints } from "../fixtures/fake-checkpoints.fixture.ts";

describe("CheckpointStore", () => {
  const top = path.resolve("work", "project");
  const id = "01928f6e-7a3b-7c4d-8e5f-0a1b2c3d4e5f";
  const failed = (message: string) => (error: unknown): boolean =>
    error instanceof CheckpointFailedException && error.code === FailureCode.Unavailable && error.message === message;

  test("takes nothing and can't put anything back while the checkpoints module is missing or off", async () => {
    const store = new CheckpointStore(() => null);

    assert.equal(await store.captureAsync(top, "Before"), null);
    await assert.rejects(store.restoreAsync(top, id, ["a.txt"]), UndoNotPossibleException);
  });

  test("takes a checkpoint of the working folder under an identity of its path, and answers its id", async () => {
    const checkpoints = new FakeCheckpoints();
    const other = new FakeCheckpoints();

    const taken = await new CheckpointStore(() => checkpoints).captureAsync(top, "Before discarding 1 file in Git");
    await new CheckpointStore(() => other).captureAsync(path.resolve("work", "other"), "Before");

    const [request] = checkpoints.captures;
    assert.equal(taken, FakeCheckpoints.id);
    assert.ok(request instanceof CaptureRequest);
    assert.deepEqual([request.folder.path, request.label, request.folder.identity.startsWith("git-"), request.folder.identity.length], [top, "Before discarding 1 file in Git", true, 44]);
    assert.notEqual(other.captures[0]?.folder.identity, request.folder.identity);
  });

  test("fails, naming why, when the module couldn't take the checkpoint", async () => {
    const checkpoints = new FakeCheckpoints();
    checkpoints.capture = new CaptureResult(CaptureOutcome.LowDiskSpace, null, 1, 2);

    await assert.rejects(new CheckpointStore(() => checkpoints).captureAsync(top, "Before"),
      failed("The checkpoint before the discard couldn't be taken (LowDiskSpace), so nothing was discarded."));
  });

  test("puts only the given paths back, restoring the plan its preview made for them", async () => {
    const checkpoints = new FakeCheckpoints();

    await new CheckpointStore(() => checkpoints).restoreAsync(top, id, ["a.txt", "src/b.ts"]);

    const [preview] = checkpoints.previews;
    assert.ok(preview instanceof PreviewRequest);
    assert.deepEqual([preview.folder.path, preview.checkpoint, preview.paths], [top, id, ["a.txt", "src/b.ts"]]);
    assert.ok(checkpoints.restores[0] instanceof RestoreRequest);
    assert.equal(checkpoints.restores[0]?.plan, checkpoints.preview.plan);
    assert.equal(checkpoints.restores[0]?.folder.identity, preview.folder.identity);
  });

  test("fails, naming why, when the module can't plan the restore or carry it out", async () => {
    const planless = new FakeCheckpoints();
    planless.preview = new PreviewResult(PreviewOutcome.CheckpointMissing, null);
    const unrestored = new FakeCheckpoints();
    unrestored.restore = new RestoreResult(RestoreOutcome.MovedOn, null, null);

    await assert.rejects(new CheckpointStore(() => planless).restoreAsync(top, id, ["a.txt"]),
      failed("The discarded files couldn't be put back from their checkpoint (CheckpointMissing)."));
    await assert.rejects(new CheckpointStore(() => unrestored).restoreAsync(top, id, ["a.txt"]),
      failed("The discarded files couldn't be put back from their checkpoint (MovedOn)."));
    assert.deepEqual([planless.restores, unrestored.restores.length], [[], 1]);
  });

  test("knows the checkpoints module's service by its methods", () => {
    assert.deepEqual([
      CheckpointStore.isCheckpoints(new FakeCheckpoints()),
      CheckpointStore.isCheckpoints({ captureAsync: () => null, previewRestoreAsync: () => null }),
      CheckpointStore.isCheckpoints({ captureAsync: () => null, previewRestoreAsync: () => null, restoreAsync: 1 })
    ], [true, false, false]);
  });
});

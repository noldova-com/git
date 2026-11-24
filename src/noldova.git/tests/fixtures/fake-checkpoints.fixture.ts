/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  CaptureMode, CaptureOutcome, type CaptureRequest, CaptureResult, Checkpoint, PreviewOutcome, type PreviewRequest, PreviewResult, RestoreOutcome,
  RestorePlan, type RestoreRequest, RestoreResult
} from "@noldova/checkpoints.protocol";

import type { ICheckpoints } from "../../src/interfaces/i-checkpoints.ts";

/**
 * The checkpoints module's service as a discard and its undo see it: it keeps each request and answers with the result a test sets, a taken
 * checkpoint and a planned and carried-out restore by default. `onRestore` runs as a restore is carried out, for a test to put files back.
 */
export class FakeCheckpoints implements ICheckpoints {
  public static readonly id: string = "01928f6e-7a3b-7c4d-8e5f-0a1b2c3d4e5f";
  private static readonly STATE: string = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  public readonly captures: CaptureRequest[] = [];
  public readonly previews: PreviewRequest[] = [];
  public readonly restores: RestoreRequest[] = [];
  private static readonly CHECKPOINT: Checkpoint = new Checkpoint(FakeCheckpoints.id, new Date("2026-11-22T12:00:00.000Z"), CaptureMode.EveryFile, null, []);

  public capture: CaptureResult = new CaptureResult(CaptureOutcome.Captured, FakeCheckpoints.CHECKPOINT, null, null);
  public preview: PreviewResult = new PreviewResult(PreviewOutcome.Planned, new RestorePlan(FakeCheckpoints.id, [], [], 0, 0, FakeCheckpoints.STATE, null));
  public restore: RestoreResult = new RestoreResult(RestoreOutcome.Restored, FakeCheckpoints.CHECKPOINT, null);
  public onCapture: () => Promise<void> = () => Promise.resolve();
  public onRestore: (request: RestoreRequest) => Promise<void> = () => Promise.resolve();

  public async captureAsync(request: CaptureRequest): Promise<CaptureResult> {
    this.captures.push(request);
    await this.onCapture();
    return this.capture;
  }

  public previewRestoreAsync(request: PreviewRequest): Promise<PreviewResult> {
    this.previews.push(request);
    return Promise.resolve(this.preview);
  }

  public async restoreAsync(request: RestoreRequest): Promise<RestoreResult> {
    this.restores.push(request);
    await this.onRestore(request);
    return this.restore;
  }
}

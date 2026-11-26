/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";

import { CaptureRequest, FolderReference, PreviewRequest, RestoreRequest } from "@noldova/checkpoints.protocol";

import { CheckpointFailedException } from "../exceptions/checkpoint-failed.exception.ts";
import { UndoNotPossibleException } from "../exceptions/undo-not-possible.exception.ts";
import type { ICheckpoints } from "../interfaces/i-checkpoints.ts";
import { Resources } from "../resources.ts";

export class CheckpointStore {
  private readonly find: () => ICheckpoints | null;

  public constructor(find: () => ICheckpoints | null) {
    this.find = find;
  }

  public get isAvailable(): boolean {
    return this.find() !== null;
  }

  public static isCheckpoints(service: object): service is ICheckpoints {
    return Resources.checkpointsMethods.every(t => typeof Reflect.get(service, t) === "function");
  }

  public async captureAsync(top: string, label: string, signal?: AbortSignal): Promise<string | null> {
    const checkpoints = this.find();
    if (checkpoints === null)
      return null;
    const result = await checkpoints.captureAsync(new CaptureRequest(CheckpointStore.folderOf(top), label), signal);
    if (!result.outcome.isCaptured || result.checkpoint === null)
      throw new CheckpointFailedException(Resources.formatCaptureFailed(result.outcome.value));
    return result.checkpoint.id;
  }

  public async restoreAsync(top: string, checkpoint: string, paths: readonly string[], signal?: AbortSignal): Promise<void> {
    const checkpoints = this.find();
    if (checkpoints === null)
      throw new UndoNotPossibleException();
    const folder = CheckpointStore.folderOf(top);
    const preview = await checkpoints.previewRestoreAsync(new PreviewRequest(folder, checkpoint, paths), signal);
    if (!preview.outcome.isPlanned || preview.plan === null)
      throw new CheckpointFailedException(Resources.formatRestoreFailed(preview.outcome.value));
    const restore = await checkpoints.restoreAsync(new RestoreRequest(folder, preview.plan), signal);
    if (!restore.outcome.isRestored)
      throw new CheckpointFailedException(Resources.formatRestoreFailed(restore.outcome.value));
  }

  private static folderOf(top: string): FolderReference {
    return new FolderReference(Resources.checkpointIdentityPrefix + createHash(Resources.checkpointIdentityHash).update(top).digest("hex").slice(0, Resources.checkpointIdentityLength), top);
  }
}

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

/**
 * Takes a working folder's checkpoints through the checkpoints module, when the app includes it and it is on, and puts paths back from one.
 * The folder's checkpoints are kept under an identity of its path, so Git's never mix with the app's own.
 */
export class CheckpointStore {
  private readonly find: () => ICheckpoints | null;

  public constructor(find: () => ICheckpoints | null) {
    this.find = find;
  }

  /** Whether a discard now takes a checkpoint first: the app includes the checkpoints module and it is on. */
  public get isAvailable(): boolean {
    return this.find() !== null;
  }

  /** Whether a service is the checkpoints module's, by the methods a discard and its undo call. */
  public static isCheckpoints(service: object): service is ICheckpoints {
    return Resources.checkpointsMethods.every(t => typeof Reflect.get(service, t) === "function");
  }

  /**
   * Takes a checkpoint of the working folder.
   * @returns The checkpoint's id, or null when the checkpoints module is missing or off.
   * @throws {CheckpointFailedException} When the module couldn't take it.
   */
  public async captureAsync(top: string, label: string, signal?: AbortSignal): Promise<string | null> {
    const checkpoints = this.find();
    if (checkpoints === null)
      return null;
    const result = await checkpoints.captureAsync(new CaptureRequest(CheckpointStore.folderOf(top), label), signal);
    if (!result.outcome.isCaptured || result.checkpoint === null)
      throw new CheckpointFailedException(Resources.formatCaptureFailed(result.outcome.value));
    return result.checkpoint.id;
  }

  /**
   * Puts paths back from a checkpoint, leaving every other path as it is.
   * @throws {UndoNotPossibleException} When the checkpoints module is missing or off.
   * @throws {CheckpointFailedException} When the module couldn't plan or carry out the restore.
   */
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

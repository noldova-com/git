/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CaptureRequest, CaptureResult, PreviewRequest, PreviewResult, RestoreRequest, RestoreResult } from "@noldova/checkpoints.protocol";

export interface ICheckpoints {
  captureAsync(request: CaptureRequest, signal?: AbortSignal): Promise<CaptureResult>;

  previewRestoreAsync(request: PreviewRequest, signal?: AbortSignal): Promise<PreviewResult>;

  restoreAsync(request: RestoreRequest, signal?: AbortSignal): Promise<RestoreResult>;
}

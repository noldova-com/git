/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitRemote } from "./git-remote.ts";
import type { GitStatus } from "./git-status.ts";

export abstract class GitRepositories {
  public abstract readStatusAsync(folder: string, signal: AbortSignal): Promise<GitStatus>;

  public abstract readRemoteAsync(folder: string, name: string, signal: AbortSignal): Promise<GitRemote | null>;

  public abstract readRemoteUserAsync(folder: string, name: string, signal: AbortSignal): Promise<string | null>;
}

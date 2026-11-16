/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WorktreeOutcomeUnknownException } from "../exceptions/worktree-outcome-unknown.exception.ts";
import { WorktreeWithdrawnException } from "../exceptions/worktree-withdrawn.exception.ts";

export class CallProgress {
  private readonly signal: AbortSignal | null;
  private isWriting: boolean = false;
  private isAsking: boolean = false;

  public constructor(signal: AbortSignal | null = null) {
    this.signal = signal;
  }

  public startWriting(): void {
    if (this.isWriting)
      return;
    this.signal?.throwIfAborted();
    this.isWriting = true;
  }

  public async askAsync(ask: () => Promise<void>): Promise<void> {
    this.signal?.throwIfAborted();
    this.isAsking = true;
    try {
      await ask();
    } finally {
      this.isAsking = false;
    }
  }

  public cancelFailure(reason: unknown): unknown {
    if (this.isWriting)
      return new WorktreeOutcomeUnknownException(reason);
    if (this.isAsking)
      return new WorktreeWithdrawnException(reason);
    return reason;
  }
}

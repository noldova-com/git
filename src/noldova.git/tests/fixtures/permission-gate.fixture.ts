/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";

import type { GitFailureException } from "../../src/exceptions/git-failure.exception.ts";
import { RequestWithdrawnException } from "../../src/exceptions/request-withdrawn.exception.ts";
import type { IPermissionGate } from "../../src/interfaces/i-permission-gate.ts";
import type { RemoveWorktreeRequest } from "../../src/models/remove-worktree-request.ts";

export class PermissionGateFixture implements IPermissionGate {
  public readonly requests: RemoveWorktreeRequest[] = [];
  private readonly answers: (GitFailureException | null)[] = [];
  public beforeAnswerAsync: () => Promise<void> = async () => {};
  public waitsForWithdrawal: boolean = false;
  public readonly asked: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public async requestAsync(request: RemoveWorktreeRequest, signal?: AbortSignal): Promise<void> {
    this.requests.push(request);
    this.asked.resolve();
    if (this.waitsForWithdrawal)
      await new Promise<void>((_, reject) => signal?.addEventListener("abort", () => reject(new RequestWithdrawnException()), { once: true }));
    await this.beforeAnswerAsync();
    const answer = this.answers.shift();
    if (Object.isUndefined(answer))
      throw new UnansweredCallException("requestAsync");
    if (!Object.isNull(answer))
      throw answer;
  }

  public answerNext(...answers: readonly (GitFailureException | null)[]): void {
    this.answers.push(...answers);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException, PermissionDecision, ToolFailure, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export class GitHubToolFailures {
  private static readonly DECISIONS: ReadonlyMap<PermissionDecision, ToolFailureCode> = new Map<PermissionDecision, ToolFailureCode>([
    [PermissionDecision.Expired, ToolFailureCode.Expired],
    [PermissionDecision.Withdrawn, ToolFailureCode.Withdrawn]
  ]);

  public static fail(code: ToolFailureCode, message: string, moduleCode: string | null): ToolFailureException {
    return new ToolFailureException(new ToolFailure(code, message, moduleCode));
  }

  public static signedOut(): ToolFailureException {
    return GitHubToolFailures.fail(ToolFailureCode.Unavailable, Resources.signedOutToolMessage, Resources.signedOutToolCode);
  }

  public static notGranted(decision: PermissionDecision): ToolFailureException {
    return GitHubToolFailures.fail(GitHubToolFailures.DECISIONS.get(decision) ?? ToolFailureCode.Denied, Resources.formatNotGranted(decision), null);
  }

  public static fromGitHub(error: unknown): unknown {
    if (!(error instanceof MethodFailureException))
      return error;
    switch (error.failure.code) {
      case FailureCode.Unauthorized:
        return GitHubToolFailures.signedOut();
      case FailureCode.DeadlineExceeded:
        return GitHubToolFailures.fail(ToolFailureCode.TimedOut, error.failure.message, null);
      case FailureCode.Conflict:
        return GitHubToolFailures.fail(ToolFailureCode.Refused, error.failure.message, Resources.refusedToolCode);
      default:
        return GitHubToolFailures.fail(ToolFailureCode.Unavailable, error.failure.message, Resources.unavailableToolCode);
    }
  }

  public static fromGit(error: unknown): unknown {
    if (!(error instanceof MethodFailureException))
      return error;
    return error.failure.code === FailureCode.NotFound
      ? GitHubToolFailures.fail(ToolFailureCode.Refused, error.failure.message, Resources.notRepositoryToolCode)
      : GitHubToolFailures.fail(ToolFailureCode.Unavailable, error.failure.message, Resources.gitUnavailableToolCode);
  }
}

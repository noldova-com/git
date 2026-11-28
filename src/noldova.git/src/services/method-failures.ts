/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { Failure, FailureCode as DesktopCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitFailure, ProtocolException } from "@noldova/git.protocol";

import { GitFailureException } from "../exceptions/git-failure.exception.ts";
import { GitTooOldException } from "../exceptions/git-too-old.exception.ts";
import { Resources } from "../resources.ts";

export class MethodFailures {
  private static readonly DESKTOP_CODES: ReadonlyMap<FailureCode, DesktopCode> = new Map([
    [FailureCode.Stale, DesktopCode.Conflict],
    [FailureCode.NotRepository, DesktopCode.NotFound],
    [FailureCode.Unavailable, DesktopCode.Unavailable],
    [FailureCode.Refused, DesktopCode.InvalidParams]
  ]);
  private static readonly MISSING_GIT: readonly GitCode[] = [GitCode.GitMissing, GitCode.GitTooOld];

  public static toMethodFailure(error: unknown): unknown {
    if (error instanceof ProtocolException)
      return MethodFailures.fail(new GitFailure(FailureCode.Refused, null, MethodFailures.stripUserinfo(error.message), null));
    if (!(error instanceof GitFailureException))
      return error;
    const code = !Object.isNull(error.gitCode) && MethodFailures.MISSING_GIT.includes(error.gitCode) ? FailureCode.Unavailable : error.code;
    const gitVersion = error instanceof GitTooOldException ? error.gitVersion : null;
    return MethodFailures.fail(new GitFailure(code, error.gitCode, MethodFailures.stripUserinfo(error.message), gitVersion));
  }

  public static stripUserinfo(text: string): string {
    return text.replaceAll(Resources.userinfoPattern, "").replaceAll(Resources.scpUserinfoPattern, "");
  }

  private static fail(failure: GitFailure): MethodFailureException {
    return new MethodFailureException(new Failure(MethodFailures.DESKTOP_CODES.get(failure.code) ?? DesktopCode.Internal, failure.message, failure.toJson()));
  }
}

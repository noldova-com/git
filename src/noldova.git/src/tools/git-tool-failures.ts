/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { RuntimeException, ToolContent, ToolFailure, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
import { FailureCode, GitCode, GitNames, ProtocolException } from "@noldova/git.protocol";

import { GitFailureException } from "../exceptions/git-failure.exception.ts";
import { Resources } from "../resources.ts";
import { MethodFailures } from "../services/method-failures.ts";

export class GitToolFailures {
  private static readonly CODES: Readonly<Record<FailureCode, ToolFailureCode>> = {
    [FailureCode.Refused]: ToolFailureCode.Refused,
    [FailureCode.Denied]: ToolFailureCode.Denied,
    [FailureCode.Expired]: ToolFailureCode.Expired,
    [FailureCode.Withdrawn]: ToolFailureCode.Withdrawn,
    [FailureCode.Stale]: ToolFailureCode.Stale,
    [FailureCode.TimedOut]: ToolFailureCode.TimedOut,
    [FailureCode.TooLarge]: ToolFailureCode.TooLarge,
    [FailureCode.Unavailable]: ToolFailureCode.Unavailable,
    [FailureCode.NotRepository]: ToolFailureCode.Refused,
    [FailureCode.Git]: ToolFailureCode.Refused
  };
  private static readonly UNAVAILABLE: readonly GitCode[] =
    [GitCode.IndexLocked, GitCode.LockedElsewhere, GitCode.UnreadableOutput, GitCode.GitMissing, GitCode.GitTooOld];

  public static fail(code: ToolFailureCode, message: string, moduleCode: string, content: readonly ToolContent[] = []): ToolFailureException {
    return new ToolFailureException(new ToolFailure(code, message, moduleCode, content));
  }

  public static fromError(error: unknown, isSent: boolean, isStopped: boolean): unknown {
    if (error instanceof ProtocolException)
      return GitToolFailures.fail(ToolFailureCode.Refused, MethodFailures.stripUserinfo(error.message), Resources.invalidArgumentToolCode);
    if (!(error instanceof GitFailureException))
      return isSent && (isStopped || error instanceof RuntimeException)
        ? GitToolFailures.fail(ToolFailureCode.OutcomeUncertain, Resources.outcomeUnknown, GitToolFailures.moduleCodeOf(GitCode.OutcomeUnknown))
        : error;
    const content = error.output === null ? [] : [ToolContent.fromText(GitToolFailures.cut(MethodFailures.stripUserinfo(error.output.text)), GitToolFailures.originOf(error.output.source))];
    return GitToolFailures.fail(isSent ? ToolFailureCode.OutcomeUncertain : GitToolFailures.codeOf(error), MethodFailures.stripUserinfo(error.message),
      GitToolFailures.moduleCodeOf(error.gitCode ?? error.code), content);
  }

  public static originOf(source: string): string {
    return Resources.formatSourceId(GitNames.moduleId, source.toLowerCase());
  }

  private static codeOf(error: GitFailureException): ToolFailureCode {
    return error.gitCode !== null && GitToolFailures.UNAVAILABLE.includes(error.gitCode) ? ToolFailureCode.Unavailable : GitToolFailures.CODES[error.code];
  }

  private static moduleCodeOf(code: string): string {
    return Resources.formatFailureId(GitNames.moduleId, Resources.formatLowerFirst(code));
  }

  private static cut(text: string): string {
    return text.length <= Resources.toolOutputCharacters ? text : Resources.formatCutOutput(text);
  }
}

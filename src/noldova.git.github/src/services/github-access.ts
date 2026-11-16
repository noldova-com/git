/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SignInState } from "@noldova/git.hosting.protocol";
import { GitHubAccessGrant, GitHubAccessRefusal, type IGitHubAccess } from "@noldova/git.github.protocol";

import { Resources } from "../resources.ts";
import type { GitHubSignIn } from "./github-sign-in.ts";

export class GitHubAccess implements IGitHubAccess {
  private readonly signIn: Pick<GitHubSignIn, "current" | "token" | "keptUnreadable">;

  public constructor(signIn: Pick<GitHubSignIn, "current" | "token" | "keptUnreadable">) {
    this.signIn = signIn;
  }

  public accessAsync(signal: AbortSignal): Promise<GitHubAccessGrant | GitHubAccessRefusal> {
    return signal.aborted ? Promise.reject(signal.reason) : Promise.resolve(this.answer());
  }

  private answer(): GitHubAccessGrant | GitHubAccessRefusal {
    const current = this.signIn.current;
    const token = this.signIn.token;
    if (current.account !== null && token !== null)
      return new GitHubAccessGrant(token, current.account.login);
    if (current.state === SignInState.Waiting)
      return new GitHubAccessRefusal(Resources.accessWaitingReason);
    return new GitHubAccessRefusal(this.signIn.keptUnreadable ? Resources.accessUnreadableReason : Resources.accessSignedOutReason);
  }
}

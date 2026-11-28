/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Fake, UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { type IPermissionAnswerer, type IPermissionRequest, type PermissionDecision, PermissionQuestion } from "@noldova/desktop.runtime";
import { GitRemote, GitRepositories, GitStatus, RemoteTransport } from "@noldova/git.protocol";

export const HEAD: string = "6dcb09b5b57875f334f61aebed695e2e4193db5e";

export function statusOf(branch: string | null, host: string | null = "github.com", path: string | null = "octocat/hello-world.git"): GitStatus {
  const remote: GitRemote | null = Object.isNull(host) && Object.isNull(path) ? null : new GitRemote("origin", host, path, RemoteTransport.Https);
  return new GitStatus(branch, HEAD, null, [], false, "f1", null, remote);
}

export class FakeRepositories extends GitRepositories {
  public answer: GitStatus | Error = statusOf("fix-bug");
  public readonly folders: string[] = [];
  public readonly remotes: Map<string, GitRemote> = new Map();
  public readonly remoteReads: (readonly [string, string])[] = [];

  public readStatusAsync(folder: string): Promise<GitStatus> {
    this.folders.push(folder);
    return this.answer instanceof Error ? Promise.reject(this.answer) : Promise.resolve(this.answer);
  }

  public readRemoteAsync(folder: string, name: string): Promise<GitRemote | null> {
    this.remoteReads.push([folder, name]);
    return this.answer instanceof Error ? Promise.reject(this.answer) : Promise.resolve(this.remotes.get(name) ?? this.answer.remote);
  }
}

export class FakeAnswerer extends Fake<IPermissionAnswerer> implements IPermissionAnswerer {
  private readonly decisions: PermissionDecision[] = [];
  private asked: (() => void) | null = null;

  public readonly answerAsync: IPermissionAnswerer["answerAsync"] = (...args) => this.respondAsync("answerAsync", args, this.answers.answerAsync);

  public constructor() {
    super();
    this.answer("answerAsync", () => {
      if (!Object.isNull(this.asked)) {
        this.asked();
        return new Promise<PermissionDecision>(() => undefined);
      }
      const decision: PermissionDecision | undefined = this.decisions.shift();
      return Object.isUndefined(decision) ? Promise.reject(new UnansweredCallException("answerAsync")) : Promise.resolve(decision);
    });
  }

  public get requests(): readonly IPermissionRequest[] {
    return this.callsOf("answerAsync").flatMap(([question]) => question instanceof PermissionQuestion ? [question.request] : []);
  }

  public hold(): Promise<void> {
    return new Promise<void>(resolve => {
      this.asked = resolve;
    });
  }

  public answerNext(...decisions: readonly PermissionDecision[]): void {
    this.decisions.push(...decisions);
  }
}

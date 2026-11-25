/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type EffectRef, effect, type EnvironmentProviders, Injector, type Provider, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { WindowException, WindowPartTokens } from "@noldova/desktop.window";
import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import {
  type ConflictKind, DiffFile, DiffHunk, DiffLine, FileChange, type FailureCode, FileState, GitBranches, type GitBranchTrack, type GitCode, GitCommandLog, GitCommitSignature, GitCommitSigning, GitDiff, GitFailure, type GitOperation, GitPrediction,
  type GitRemote, GitStatus, LineCounts, LineKind, PredictionOutcome, SignatureState, SigningFormat, StatusEntry, type StatusUpstream
} from "@noldova/git.protocol";
import { onTestFinished } from "vitest";

import { GitFolder } from "../../src/app/services/git-folder.ts";
import { GitPendingSwitch } from "../../src/app/services/git-pending-switch.ts";
import { GitRecentRepositories } from "../../src/app/services/git-recent-repositories.ts";

export class FailedRequest extends WindowException {
  public override readonly name: string = "FailedRequest";
  public readonly details: JsonValue;

  public constructor(message: string, details: JsonValue = null) {
    super(message);
    this.details = details;
  }
}

/** A diff line a fixture diff holds: its kind and its text. */
export class FixtureLine {
  public readonly kind: LineKind;
  public readonly text: string;

  public constructor(kind: LineKind, text: string) {
    this.kind = kind;
    this.text = text;
  }
}

/** What a fixture status holds apart from its entries and upstream; each part left out takes the fixture's usual value. */
export interface IFixtureStatusOptions {
  readonly branch?: string | null;
  readonly head?: string | null;
  readonly operation?: GitOperation | null;
  readonly remote?: GitRemote | null;
  readonly truncated?: boolean;
  readonly fingerprint?: string;
  readonly uncheckedLfsFiles?: number;
  readonly fetchedAt?: string | null;
}

export class GitFixtures {
  public static readonly folder: string = "/work/project";
  public static readonly watching: Readonly<Record<string, JsonValue>> = {
    "git.watch": null, "git.unwatch": null, "git.predict": new GitPrediction(PredictionOutcome.Unavailable, []).toJson(), "git.commandLog": new GitCommandLog([]).toJson(),
    "git.commitSignature": new GitCommitSignature("0".repeat(40), SignatureState.None, null, null).toJson(),
    "git.commitSigning": new GitCommitSigning(false, SigningFormat.OpenPgp).toJson()
  };

  public static entry(path: string, index: FileState, worktree: FileState, counts: LineCounts | null = new LineCounts(2, 1),
    conflict: ConflictKind | null = null): StatusEntry {
    return new StatusEntry(path, undefined, null, undefined, Object.isNull(conflict) ? index : FileState.Unmodified, Object.isNull(conflict) ? worktree : FileState.Unmodified, conflict,
      null, Object.isNull(conflict) && index !== FileState.Unmodified && index !== FileState.Untracked ? counts : null,
      Object.isNull(conflict) && worktree !== FileState.Unmodified ? counts : null);
  }

  public static status(entries: readonly StatusEntry[] = [], upstream: StatusUpstream | null = null, options: IFixtureStatusOptions = {}): GitStatus {
    return new GitStatus(Object.isUndefined(options.branch) ? "main" : options.branch,
      Object.isUndefined(options.head) ? "0123456789abcdef0123456789abcdef01234567" : options.head, upstream, entries,
      options.truncated ?? false, options.fingerprint ?? "f1", options.operation ?? null, options.remote ?? null,
      options.uncheckedLfsFiles ?? 0, options.fetchedAt ?? null);
  }

  public static branches(current: string | null, branches: readonly string[], remoteBranches: readonly string[] = [], tracks: readonly GitBranchTrack[] = []): GitBranches {
    return new GitBranches(current, branches, remoteBranches.map(t => t.slice(0, t.indexOf("/"))).filter((t, i, all) => all.indexOf(t) === i), remoteBranches, tracks);
  }

  public static diff(path: string, ...lines: readonly FixtureLine[]): GitDiff {
    const hunk: DiffHunk = new DiffHunk(1, 1, 1, 2, "", lines.map(({ kind, text }) =>
      new DiffLine(kind, kind === LineKind.Context || kind === LineKind.Removed ? 1 : null, kind === LineKind.Context || kind === LineKind.Added ? 1 : null, text)));
    return new GitDiff([new DiffFile(path, undefined, path, undefined, FileChange.Modified, null, null, false, null, [hunk], false)], 0, 0, false);
  }

  public static failure(code: FailureCode, gitCode: GitCode | null = null, message: string = "Git refused.", gitVersion: string | null = null): FailedRequest {
    const failure: GitFailure = new GitFailure(code, gitCode, message, gitVersion);
    return new FailedRequest(failure.message, failure.toJson());
  }

  public static lost(message: string): FailedRequest {
    return new FailedRequest(message);
  }

  public static setUp(context: FakeWindowPartContext, providers: readonly (Provider | EnvironmentProviders)[] = []): WritableSignal<string | null> {
    const folder: WritableSignal<string | null> = signal(GitFixtures.folder);
    const unregister: () => void = GitFolder.provide(context, folder);
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: WindowPartTokens.activeDocument, useValue: signal(true) }, ...providers]
    });
    onTestFinished(unregister);
    onTestFinished(() => GitPendingSwitch.target.set(null));
    const recent: readonly string[] = GitRecentRepositories.recent();
    onTestFinished(() => GitRecentRepositories.forget(new Set(GitRecentRepositories.recent().filter(t => !recent.includes(t)))));
    return folder;
  }

  public static answerWith(context: FakeWindowPartContext, answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>): void {
    context.answer("requestAsync", async method => GitFixtures.answerFor(answers, method));
  }

  public static answerFor(answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>, method: string): JsonValue {
    const found: JsonValue | Error | (() => JsonValue | Error) | undefined = answers[method];
    if (Object.isUndefined(found))
      throw new UnansweredCallException(`requestAsync ${method}`);
    const answer: JsonValue | Error = Object.isFunction(found) ? found() : found;
    if (answer instanceof Error)
      throw answer;
    return answer;
  }

  public static untilAsync(done: () => boolean): Promise<void> {
    const injector: Injector = TestBed.inject(Injector);
    return new Promise(resolve => {
      const watch: EffectRef = effect(() => {
        if (!done())
          return;
        watch.destroy();
        resolve();
      }, { injector });
    });
  }

  public static loggedAsync(context: FakeWindowPartContext, count: number): Promise<void> {
    return new Promise(resolve => context.answer("log", () => {
      if (context.callsOf("log").length === count)
        resolve();
    }));
  }
}

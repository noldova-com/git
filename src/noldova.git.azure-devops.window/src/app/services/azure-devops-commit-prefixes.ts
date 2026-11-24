/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { JsonException, JsonReader, type JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { GitBranches, GitChanged, GitFolderParams, GitNames, ProtocolException } from "@noldova/git.protocol";
import { GitCommitPrefixes, type IGitCommitPrefixes } from "@noldova/git.window";

import { CommitPrefixChoice } from "../models/commit-prefix-choice.ts";
import { Resources } from "../../resources.ts";

export class AzureDevOpsCommitPrefixes implements IGitCommitPrefixes {
  private static readonly kept: WritableSignal<readonly CommitPrefixChoice[]> = signal<readonly CommitPrefixChoice[]>([]);

  public prefixFor(folder: string, branch: string): string | null {
    const choice: CommitPrefixChoice | undefined = AzureDevOpsCommitPrefixes.kept().find(t => t.isFor(folder, branch));
    return choice === undefined ? null : Resources.formatCommitPrefix(choice.id);
  }

  public static provide(context: IWindowPartContext): () => void {
    AzureDevOpsCommitPrefixes.restore();
    const withdraw = GitCommitPrefixes.provide(context, new AzureDevOpsCommitPrefixes());
    const unfollow = context.onEvent(GitNames.changedEvent, payload => {
      let folder: string;
      try {
        folder = GitChanged.fromJson(payload).folder;
      }
      catch (error) {
        if (!(error instanceof JsonException || error instanceof ProtocolException))
          throw error;
        context.log(Resources.formatEventUnread(GitNames.changedEvent, String(error)));
        return;
      }
      void AzureDevOpsCommitPrefixes.pruneAsync(context, folder);
    });
    return () => {
      withdraw();
      unfollow();
      AzureDevOpsCommitPrefixes.kept.set([]);
    };
  }

  public static restore(): void {
    AzureDevOpsCommitPrefixes.kept.set(AzureDevOpsCommitPrefixes.stored().flatMap(t => {
      try {
        return [CommitPrefixChoice.fromJson(JsonReader.fromValue(t))];
      }
      catch (error) {
        if (!(error instanceof JsonException))
          throw error;
        return [];
      }
    }));
  }

  public static keep(folder: string, branch: string, id: number): void {
    AzureDevOpsCommitPrefixes.save([...AzureDevOpsCommitPrefixes.kept().filter(t => !t.isFor(folder, branch)), new CommitPrefixChoice(folder, branch, id)]);
  }

  public static drop(folder: string, branch: string): void {
    if (AzureDevOpsCommitPrefixes.kept().some(t => t.isFor(folder, branch)))
      AzureDevOpsCommitPrefixes.save(AzureDevOpsCommitPrefixes.kept().filter(t => !t.isFor(folder, branch)));
  }

  public static async pruneAsync(context: IWindowPartContext, folder: string): Promise<void> {
    if (!AzureDevOpsCommitPrefixes.kept().some(t => t.folder === folder))
      return;
    let branches: readonly string[];
    try {
      branches = GitBranches.fromJson(await context.requestAsync(GitNames.branchesMethod, new GitFolderParams(folder).toJson())).branches;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitNames.branchesMethod, String(error)));
      return;
    }
    const kept: readonly CommitPrefixChoice[] = AzureDevOpsCommitPrefixes.kept();
    const left: readonly CommitPrefixChoice[] = kept.filter(t => t.folder !== folder || branches.includes(t.branch));
    if (left.length < kept.length)
      AzureDevOpsCommitPrefixes.save(left);
  }

  private static save(choices: readonly CommitPrefixChoice[]): void {
    AzureDevOpsCommitPrefixes.kept.set(choices);
    try {
      localStorage.setItem(Resources.commitPrefixesKey, JSON.stringify(choices.map(t => t.toJson())));
    }
    catch (error) {
      if (!(error instanceof DOMException))
        throw error;
    }
  }

  private static stored(): readonly JsonValue[] {
    try {
      const value: JsonValue = JsonReader.parseValue(localStorage.getItem(Resources.commitPrefixesKey) ?? Resources.emptyList);
      return Array.isArray(value) ? value : [];
    }
    catch (error) {
      if (!(error instanceof JsonException || error instanceof DOMException))
        throw error;
      return [];
    }
  }
}

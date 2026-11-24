/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { AuthorQuery, HostAvatar } from "@noldova/git.hosting.protocol";
import type { IGitAvatars } from "@noldova/git.window";

import { Resources } from "../../resources.ts";
import type { GitHubReferenceSource } from "./github-reference-source.ts";

/**
 * Commit authors' GitHub pictures in the Git view, read once per repository and email through the runtime part, and read again after the
 * sign-in changes.
 */
export class GitHubAuthorAvatars implements IGitAvatars {
  private readonly context: IWindowPartContext;
  private readonly references: () => GitHubReferenceSource;
  private readonly kept: Map<string, WritableSignal<string | null | undefined>> = new Map();
  private readonly signIns: WritableSignal<number> = signal(0);
  private readonly stopListening: () => void;

  public constructor(context: IWindowPartContext, references: () => GitHubReferenceSource) {
    this.context = context;
    this.references = references;
    this.stopListening = context.onEvent(GitHubNames.signInChangedEvent, () => {
      this.kept.clear();
      this.signIns.update(t => t + 1);
    });
  }

  public avatarOf(folder: string, email: string, commitId: string): string | null | undefined {
    this.signIns();
    const home: string | null | undefined = this.references().knownHomeOf(folder);
    if (home === null || home === undefined)
      return home;
    const key: string = Resources.formatAvatarKey(home, email.trim().toLowerCase());
    let avatar: WritableSignal<string | null | undefined> | undefined = this.kept.get(key);
    if (avatar === undefined) {
      const reading: WritableSignal<string | null | undefined> = signal(undefined);
      avatar = reading;
      this.kept.set(key, reading);
      this.context.requestAsync(GitHubNames.readAuthorAvatarMethod, new AuthorQuery(Resources.gitHubHost, home, email, commitId).toJson())
        .then(t => reading.set(HostAvatar.fromJson(t).avatar), () => reading.set(null));
    }
    return avatar();
  }

  public stop(): void {
    this.stopListening();
    this.kept.clear();
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { HostItem, HostSignIn, ReferenceState, SignInState } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitNames, GitStatus } from "@noldova/git.protocol";
import type { ILinkReferenceSource, LinkReference, LinkReferenceMatch } from "@noldova/ui.components.angular";

import { Resources } from "../../resources.ts";
import type { IGitHubHome } from "../interfaces/i-github-home.ts";
import { GitHubReferenceRead } from "../models/github-reference-read.ts";
import { GitHubHomeReferences } from "./github-home-references.ts";
import { GitHubLooks } from "./github-looks.ts";
import { GitHubReferenceLinks } from "./github-reference-links.ts";
import { GitHubReferenceLooks } from "./github-reference-looks.ts";

export class GitHubReferenceSource implements ILinkReferenceSource {
  private static readonly sources: WeakMap<IWindowPartContext, GitHubReferenceSource> = new WeakMap();
  private static readonly noHome: Signal<string | null> = signal(null).asReadonly();

  private readonly context: IWindowPartContext;
  private readonly reads: Map<string, GitHubReferenceRead> = new Map();
  private readonly waiting: GitHubReferenceRead[] = [];
  private readonly homes: Map<string, IGitHubHome> = new Map();
  private readonly homeReaders: Map<string, GitHubHomeReferences> = new Map();
  private readonly homeReads: Map<string, number> = new Map();
  private readonly stopListening: readonly (() => void)[];
  private running: number = 0;
  private signedIn: boolean = false;
  private heard: number = 0;
  private homeRead: number = 0;

  private constructor(context: IWindowPartContext) {
    this.context = context;
    this.stopListening = [
      context.onEvent(GitHubNames.signInChangedEvent, t => this.follow(HostSignIn.fromJson(t).state)),
      context.onDependencyChanged((moduleId, isActive) => {
        if (moduleId === GitNames.moduleId)
          this.followGit(isActive);
        if (moduleId !== GitHubNames.moduleId)
          return;
        if (isActive)
          void this.readSignInAsync();
        else
          this.follow(SignInState.SignedOut);
      })
    ];
    void this.readSignInAsync();
  }

  public static register(context: IWindowPartContext): GitHubReferenceSource {
    const source = new GitHubReferenceSource(context);
    GitHubReferenceSource.sources.set(context, source);
    return source;
  }

  public static of(context: IWindowPartContext): GitHubReferenceSource | null {
    return GitHubReferenceSource.sources.get(context) ?? null;
  }

  public static release(context: IWindowPartContext): void {
    GitHubReferenceSource.sources.get(context)?.stop();
    GitHubReferenceSource.sources.delete(context);
  }

  public find(url: string): Signal<LinkReference | null> | null {
    const link = GitHubReferenceLinks.of(url);
    const look = Object.isNull(link) ? null : GitHubLooks.of(link.kind, ReferenceState.Open);
    if (Object.isNull(link) || Object.isNull(look))
      return null;
    const known = this.reads.get(link.key);
    if (!Object.isUndefined(known)) {
      this.reads.delete(link.key);
      this.reads.set(link.key, known);
      return known.item;
    }
    const read = new GitHubReferenceRead(link.reference, GitHubReferenceLooks.pendingOf(link, look), this.signedIn);
    this.reads.set(link.key, read);
    this.forgetOldest();
    if (this.signedIn)
      this.queue(read);
    return read.item;
  }

  public findText(text: string): readonly LinkReferenceMatch[] {
    return GitHubReferenceLinks.inText(text);
  }

  public homeOf(folder: string | null): Signal<string | null> {
    if (Object.isNull(folder))
      return GitHubReferenceSource.noHome;
    return this.homeFor(folder).shown;
  }

  public knownHomeOf(folder: string): string | null | undefined {
    return this.homeFor(folder).read();
  }

  public readHomeAgain(folder: string | null): void {
    if (Object.isNull(folder))
      return;
    const home = this.homes.get(folder);
    if (!Object.isUndefined(home) && !this.homeReads.has(folder))
      void this.readHomeAsync(folder, home.read);
  }

  public readerFor(home: string | null): ILinkReferenceSource {
    if (Object.isNull(home))
      return this;
    const known = this.homeReaders.get(home);
    if (!Object.isUndefined(known))
      return known;
    const reader = new GitHubHomeReferences(this, home);
    this.homeReaders.set(home, reader);
    return reader;
  }

  private follow(state: SignInState): void {
    if (state === SignInState.Waiting)
      return;
    this.heard++;
    this.signedIn = state === SignInState.SignedIn;
    this.waiting.length = 0;
    for (const read of this.reads.values()) {
      if (state === SignInState.SignedIn)
        this.queue(read);
      else
        read.stop();
    }
  }

  private followGit(isActive: boolean): void {
    this.homeReads.clear();
    for (const [folder, home] of this.homes) {
      if (isActive)
        void this.readHomeAsync(folder, home.read);
      else
        home.read.set(null);
    }
  }

  private homeFor(folder: string): IGitHubHome {
    const known = this.homes.get(folder);
    if (!Object.isUndefined(known))
      return known;
    const read = signal<string | null | undefined>(undefined);
    const home: IGitHubHome = { read, shown: computed(() => read() ?? null) };
    this.homes.set(folder, home);
    void this.readHomeAsync(folder, read);
    return home;
  }

  private async readHomeAsync(folder: string, home: WritableSignal<string | null | undefined>): Promise<void> {
    const read = ++this.homeRead;
    this.homeReads.set(folder, read);
    const path = await this.readRemotePathAsync(folder).catch(() => null);
    if (this.homeReads.get(folder) !== read)
      return;
    this.homeReads.delete(folder);
    home.set(path);
  }

  private async readRemotePathAsync(folder: string): Promise<string | null> {
    const status = await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson());
    return GitHubReferenceLinks.homeOf(GitStatus.fromJson(status).remote);
  }

  private async readSignInAsync(): Promise<void> {
    const heard = ++this.heard;
    const state = await this.context.requestAsync(GitHubNames.readSignInMethod, null).then(t => HostSignIn.fromJson(t).state).catch(() => SignInState.SignedOut);
    if (heard === this.heard)
      this.follow(state);
  }

  private stop(): void {
    for (const unfollow of this.stopListening)
      unfollow();
    this.follow(SignInState.SignedOut);
    this.reads.clear();
  }

  private forgetOldest(): void {
    const oldest = this.reads.size > Resources.gitHubReferenceMemoryLimit ? this.reads.keys().next() : null;
    if (!Object.isNull(oldest) && oldest.done !== true)
      this.reads.delete(oldest.value);
  }

  private queue(read: GitHubReferenceRead): void {
    const attempt = read.start();
    if (this.running < Resources.gitHubReferenceReadLimit)
      void this.readAsync(read, attempt);
    else
      this.waiting.push(read);
  }

  private async readAsync(read: GitHubReferenceRead, attempt: number): Promise<void> {
    this.running++;
    try {
      const answer = await this.context.requestAsync(GitHubNames.readReferenceMethod, read.reference.toJson());
      const item = Object.isNull(answer) ? null : HostItem.fromJson(answer);
      const look = Object.isNull(item) ? null : GitHubLooks.of(item.kind, item.state);
      read.show(attempt, Object.isNull(item) || Object.isNull(look) ? null : GitHubReferenceLooks.of(item, look));
    }
    catch (error) {
      if (read.show(attempt, null))
        this.context.log(Resources.formatGitHubReferenceReadFailed(error instanceof Error ? error.name : typeof error));
    }
    finally {
      this.running--;
      this.next();
    }
  }

  private next(): void {
    const read = this.waiting.shift();
    if (!Object.isUndefined(read))
      void this.readAsync(read, read.start());
  }
}

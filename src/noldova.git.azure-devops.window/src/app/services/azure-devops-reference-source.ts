/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAvatar, HostChanges, type HostPerson, type HostReference, HostItem, HostPullRequestFiles, HostSignIn, HostWorkItem, PersonQuery, SignInState, WorkItemQuery }
  from "@noldova/git.hosting.protocol";
import { DiffScope, DiffScopeKind, DiffTotals, GitDiffParams, GitFolderParams, GitNames, type GitRemote, GitStatus } from "@noldova/git.protocol";
import type { ILinkReferenceSource, LinkReference, LinkReferenceMatch } from "@noldova/ui.components.angular";

import { Resources } from "../../resources.ts";
import type { AzureDevOpsReferenceLink } from "../models/azure-devops-reference-link.ts";
import { AzureDevOpsReferenceRead } from "../models/azure-devops-reference-read.ts";
import { WorkItemsPlace } from "../models/work-items-place.ts";
import { AzureDevOpsHomeReferences } from "./azure-devops-home-references.ts";
import { AzureDevOpsLocalFolder } from "./azure-devops-local-folder.ts";
import { AzureDevOpsReferenceLinks } from "./azure-devops-reference-links.ts";
import { AzureDevOpsReferenceLooks } from "./azure-devops-reference-looks.ts";

export class AzureDevOpsReferenceSource implements ILinkReferenceSource {
  private static readonly sources: WeakMap<IWindowPartContext, AzureDevOpsReferenceSource> = new WeakMap();
  private static readonly noHome: Signal<string | null> = signal(null).asReadonly();

  private readonly context: IWindowPartContext;
  private readonly reads: Map<string, AzureDevOpsReferenceRead> = new Map();
  private readonly waiting: AzureDevOpsReferenceRead[] = [];
  private readonly homes: Map<string, WritableSignal<string | null>> = new Map();
  private readonly places: Map<string, WorkItemsPlace | null> = new Map();
  private readonly homeReaders: Map<string, AzureDevOpsHomeReferences> = new Map();
  private readonly pages: Map<string, AzureDevOpsReferenceLink> = new Map();
  private readonly homeReads: Map<string, number> = new Map();
  private readonly stopListening: readonly (() => void)[];
  private running: number = 0;
  private signedIn: boolean = false;
  private heard: number = 0;
  private homeRead: number = 0;

  private constructor(context: IWindowPartContext) {
    this.context = context;
    this.stopListening = [
      context.onEvent(AzureDevOpsNames.signInChangedEvent, t => this.follow(HostSignIn.fromJson(t).state)),
      context.onDependencyChanged((moduleId, isActive) => {
        if (moduleId === GitNames.moduleId)
          this.followGit(isActive);
        if (moduleId !== AzureDevOpsNames.moduleId)
          return;
        if (isActive)
          void this.readSignInAsync();
        else
          this.follow(SignInState.SignedOut);
      })
    ];
    void this.readSignInAsync();
  }

  /** The context's source, made and registered the first time a context asks for it. */
  public static register(context: IWindowPartContext): AzureDevOpsReferenceSource {
    const known = AzureDevOpsReferenceSource.sources.get(context);
    if (!Object.isUndefined(known))
      return known;
    const source = new AzureDevOpsReferenceSource(context);
    AzureDevOpsReferenceSource.sources.set(context, source);
    return source;
  }

  public static release(context: IWindowPartContext): void {
    AzureDevOpsReferenceSource.sources.get(context)?.stop();
    AzureDevOpsReferenceSource.sources.delete(context);
  }

  /** Remembers a pull request's page address, which names its repository, so a link to it shows the pull request its reference names by the repository's id. */
  public rememberPage(url: string, reference: HostReference): void {
    this.pages.delete(url);
    this.pages.set(url, AzureDevOpsReferenceLinks.ofPullRequest(reference));
    AzureDevOpsReferenceSource.forgetOldest(this.pages);
  }

  public find(url: string): Signal<LinkReference | null> | null {
    const link = this.pages.get(url) ?? AzureDevOpsReferenceLinks.of(url);
    if (Object.isNull(link))
      return null;
    const known = this.reads.get(link.key);
    if (!Object.isUndefined(known)) {
      this.reads.delete(link.key);
      this.reads.set(link.key, known);
      return known.item;
    }
    const read = new AzureDevOpsReferenceRead(link, AzureDevOpsReferenceLooks.pendingOf(link));
    this.reads.set(link.key, read);
    AzureDevOpsReferenceSource.forgetOldest(this.reads);
    if (this.signedIn)
      this.queue(read);
    return read.item;
  }

  public findText(text: string): readonly LinkReferenceMatch[] {
    return AzureDevOpsReferenceLinks.inText(text, null);
  }

  public homeOf(folder: string | null): Signal<string | null> {
    if (Object.isNull(folder))
      return AzureDevOpsReferenceSource.noHome;
    const known = this.homes.get(folder);
    if (!Object.isUndefined(known))
      return known;
    const home = signal<string | null>(null);
    this.homes.set(folder, home);
    void this.readHomeAsync(folder, home);
    return home;
  }

  /** The organization and project of a folder's remote, once its organization is read; null before, or when its remote names no project. */
  public placeOf(folder: string): WorkItemsPlace | null {
    return this.places.get(folder) ?? null;
  }

  public readerFor(home: string | null): ILinkReferenceSource {
    if (Object.isNull(home))
      return this;
    const known = this.homeReaders.get(home);
    if (!Object.isUndefined(known))
      return known;
    const reader = new AzureDevOpsHomeReferences(this, home);
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
      this.places.delete(folder);
      if (isActive)
        void this.readHomeAsync(folder, home);
      else
        home.set(null);
    }
  }

  private async readHomeAsync(folder: string, home: WritableSignal<string | null>): Promise<void> {
    const read = ++this.homeRead;
    this.homeReads.set(folder, read);
    const remote = await this.readRemoteAsync(folder).catch(() => null);
    if (this.homeReads.get(folder) !== read)
      return;
    this.homeReads.delete(folder);
    this.places.set(folder, WorkItemsPlace.ofRemote(remote));
    home.set(AzureDevOpsReferenceLinks.homeOf(remote));
  }

  private async readRemoteAsync(folder: string): Promise<GitRemote | null> {
    const status = await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson());
    return GitStatus.fromJson(status).remote;
  }

  private async readSignInAsync(): Promise<void> {
    const heard = ++this.heard;
    const state = await this.context.requestAsync(AzureDevOpsNames.readSignInMethod, null).then(t => HostSignIn.fromJson(t).state).catch(() => SignInState.SignedOut);
    if (heard === this.heard)
      this.follow(state);
  }

  private stop(): void {
    for (const unfollow of this.stopListening)
      unfollow();
    this.follow(SignInState.SignedOut);
    this.reads.clear();
  }

  private static forgetOldest(entries: Map<string, unknown>): void {
    const oldest = entries.size > Resources.referenceMemoryLimit ? entries.keys().next() : null;
    if (!Object.isNull(oldest) && oldest.done !== true)
      entries.delete(oldest.value);
  }

  private queue(read: AzureDevOpsReferenceRead): void {
    const attempt = read.start();
    if (this.running < Resources.referenceReadLimit)
      void this.readAsync(read, attempt);
    else
      this.waiting.push(read);
  }

  private async readAsync(read: AzureDevOpsReferenceRead, attempt: number): Promise<void> {
    this.running++;
    try {
      read.show(attempt, await this.readItemAsync(read.link.query));
    }
    catch (error) {
      if (read.show(attempt, null))
        this.context.log(Resources.formatReferenceReadFailed(error instanceof Error ? error.name : typeof error));
    }
    finally {
      this.running--;
      this.next();
    }
  }

  private async readItemAsync(query: WorkItemQuery | HostReference): Promise<LinkReference | null> {
    if (query instanceof WorkItemQuery) {
      const workItem = await this.context.requestAsync(AzureDevOpsNames.readWorkItemMethod, query.toJson());
      if (Object.isNull(workItem))
        return null;
      const read = HostWorkItem.fromJson(workItem);
      return AzureDevOpsReferenceLooks.workItemOf(read, await this.avatarOfAsync(read.organization, read.assignee));
    }
    const item = await this.context.requestAsync(AzureDevOpsNames.readReferenceMethod, query.toJson());
    if (Object.isNull(item))
      return null;
    const read = await this.countedLocallyAsync(HostItem.fromJson(item));
    return AzureDevOpsReferenceLooks.pullRequestOf(read, await this.avatarOfAsync(read.reference.owner, read.author));
  }

  /**
   * The pull request with the counts local Git gives for its latest push, when the open repository is its own and has the push's commits, as the Files tab
   * shows them: Azure DevOps miscounts the lines of a large file's diff. Otherwise, or when a read fails, which it logs, it keeps Azure DevOps' counts.
   */
  private async countedLocallyAsync(item: HostItem): Promise<HostItem> {
    const { changes } = item;
    if (Object.isNull(changes))
      return item;
    const folder: string | null = await AzureDevOpsLocalFolder.readAsync(this.context, item.url);
    if (Object.isNull(folder))
      return item;
    let method: string = AzureDevOpsNames.readPullRequestChangesMethod;
    try {
      const files = HostPullRequestFiles.fromJson(await this.context.requestAsync(method, item.reference.toJson()));
      if (Object.isNull(files.commonCommit) || Object.isNull(files.sourceCommit))
        return item;
      method = GitNames.diffTotalsMethod;
      const totals = DiffTotals.fromJson(await this.context.requestAsync(method,
        new GitDiffParams(folder, new DiffScope(DiffScopeKind.Range, files.commonCommit, files.sourceCommit)).toJson()));
      return HostItem.fromJson({ ...item.toJson(),
        [Resources.changesField]: new HostChanges(totals.added, totals.removed, totals.files, changes.headBranch, changes.baseBranch, changes.headCommit).toJson() });
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      return item;
    }
  }

  /** A person's picture in an organization, as the card shows it with them; none for no one, for a group, or when it can't be read. */
  private async avatarOfAsync(organization: string, person: HostPerson | null): Promise<string | null> {
    if (Object.isNull(person) || !Object.isNull(person.avatar) || Resources.isGroupLogin(person.login))
      return person?.avatar ?? null;
    return this.context.requestAsync(AzureDevOpsNames.readPersonAvatarMethod, new PersonQuery(Resources.azureHost, organization, person.login).toJson())
      .then(t => HostAvatar.fromJson(t).avatar, () => null);
  }

  private next(): void {
    const read = this.waiting.shift();
    if (!Object.isUndefined(read))
      void this.readAsync(read, read.start());
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkVirtualScrollViewport, ScrollingModule } from "@angular/cdk/scrolling";
import {
  afterNextRender, Component, computed, DestroyRef, effect, type ElementRef, ErrorHandler, inject, Injector, input, type InputSignal, signal, type Signal, untracked,
  viewChild, type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { type GitGraph, type GitGraphCommit, type GitPrediction, type GitStatus, PredictionAction } from "@noldova/git.protocol";
import {
  DialogService, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective
} from "@noldova/ui.components.angular";

import { GitHistoryAction } from "../../enums/git-history-action.ts";
import { GitBranchDrop } from "../../models/git-branch-drop.ts";

import { GitBranchView } from "../../models/git-branch-view.ts";
import { GitChipDrag } from "../../models/git-chip-drag.ts";
import { GitCommitView } from "../../models/git-commit-view.ts";
import type { GitHistoryAsk } from "../../models/git-history-ask.ts";
import { GitCommitDetails } from "../../services/git-commit-details.ts";
import type { GitDetailView } from "../../services/git-detail-view.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitPullRequests } from "../../services/git-pull-requests.ts";
import { GitHistoryAsks } from "../../services/git-history-asks.ts";
import { GitNewBranch } from "../../services/git-new-branch.ts";
import { GitPendingSwitch } from "../../services/git-pending-switch.ts";
import { GitRecentRepositories } from "../../services/git-recent-repositories.ts";
import { GitRebaseTarget, GitRebasing } from "../../services/git-rebasing.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitHistoryRows } from "../../services/git-history-rows.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitViewing } from "../../services/git-viewing.ts";
import type { GitGraphLine } from "../../models/git-graph-line.ts";
import type { GitHistoryRow } from "../../models/git-history-row.ts";
import type { GitRefChip } from "../../models/git-ref-chip.ts";
import { GitAvatars } from "../../services/git-avatars.ts";
import { Resources } from "../../../resources.ts";
import { GitBranchDropComponent } from "../git-branch-drop/git-branch-drop.component.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";
import { GitSwitchMergeDialogComponent } from "../git-switch-merge-dialog/git-switch-merge-dialog.component.ts";

interface DroppedBranch {
  readonly drop: GitBranchDrop;
  readonly prediction: GitPrediction | null;
  readonly checking: boolean;
  readonly request: string | null;
  readonly left: number;
  readonly top: number;
}

@Component({
  selector: "nol-git-history",
  imports: [
    GitBranchDropComponent, GitReferenceTextComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, ScrollingModule, ToolbarButtonComponent, ToolbarDirective,
    ToolbarItemDirective, TooltipDirective
  ],
  host: { "[style.--graph-width]": "graphWidth()" },
  templateUrl: "./git-history.component.html",
  styleUrl: "./git-history.component.css"
})
export class GitHistoryComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly commits: WritableSignal<readonly GitGraphCommit[]> = signal<readonly GitGraphCommit[]>([]);
  private readonly loaded: WritableSignal<boolean> = signal(false);
  protected readonly hasMore: WritableSignal<boolean> = signal(false);
  private readonly status: WritableSignal<GitStatus | null> = signal<GitStatus | null>(null);
  private readonly held: WritableSignal<string | null> = signal<string | null>(null);
  private readonly viewport: Signal<CdkVirtualScrollViewport> = viewChild.required(CdkVirtualScrollViewport);
  private readonly row: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("row");
  private readonly actions: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("actions");
  private readonly field: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("field");
  private readonly fitting: WritableSignal<number> = signal(Resources.historyToolbars.length);
  private readonly injector: Injector = inject(Injector);
  private jumped: GitBranchView | null = null;
  private dragged: GitChipDrag | null = null;
  private static lists = 0;
  private reading = 0;
  protected readonly list: number = ++GitHistoryComponent.lists;
  protected readonly activeOption: Signal<string | null> = computed(() => {
    const at: number = this.rows().findIndex(t => t.id === this.selectedId());
    return at < 0 ? null : Resources.formatHistoryOptionId(this.list, at);
  });
  private isPaging = false;

  protected readonly resources: typeof Resources = Resources;
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly actionFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly notLoaded: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly busy: WritableSignal<boolean> = signal(false);
  protected readonly selectedId: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly dropped: WritableSignal<DroppedBranch | null> = signal<DroppedBranch | null>(null);
  protected readonly filter: WritableSignal<string> = signal("");
  protected readonly isWide: WritableSignal<boolean> = signal(true);
  protected readonly chipLimit: WritableSignal<number> = signal(Resources.rowChipLimit);
  protected readonly shownToolbars: Signal<typeof Resources.historyToolbars> = computed(() => Resources.historyToolbars.slice(0, this.fitting()));
  protected readonly hiddenToolbars: Signal<typeof Resources.historyToolbars> = computed(() => Resources.historyToolbars.slice(this.fitting()));
  protected readonly rows: Signal<readonly GitHistoryRow[]> = computed(() =>
    GitHistoryRows.rowsOf(GitHistoryRows.switchedTo(this.commits(), this.held()),
      this.status()?.entries.length ?? 0, this.filter(), new Date()));
  protected readonly lanes: Signal<number> = computed(() => Math.min(Resources.graphMaximumLanes, Math.max(1, ...this.rows().map(t => t.graph.width))));
  protected readonly graphPixels: Signal<number> = computed(() =>
    Math.max(Resources.graphMinimumPixels, Resources.graphLaneOffsetPixels * 2 + (this.lanes() - 1) * Resources.graphLanePixels));
  protected readonly graphWidth: Signal<string> = computed(() => `${this.graphPixels() / 16}rem`);
  protected readonly isLoading: Signal<boolean> = computed(() => !this.loaded() && Object.isNull(this.failure()));
  protected readonly ahead: Signal<number> = computed(() => this.status()?.upstream?.ahead ?? 0);
  protected readonly writable: Signal<GitStatus | null> = computed(() => this.busy() ? null : this.status());

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    effect(onCleanup => {
      const folder: string = this.instance();
      untracked(() => {
        GitRecentRepositories.remember(folder);
        void this.readAsync(folder);
        void this.client.watchAsync(folder).catch((error: unknown) => this.report(error));
      });
      onCleanup(() => void this.client.unwatchAsync(folder).catch((error: unknown) => this.report(error)));
    });
    effect(() => {
      const folder: string = this.instance();
      const branch: string | null = GitPendingSwitch.branchOf(folder);
      untracked(() => {
        if (!Object.isNull(branch))
          this.held.set(branch);
        else if (!Object.isNull(this.held()))
          void this.readAsync(folder);
      });
    });
    effect(() => {
      const view: GitBranchView | null = GitViewing.branchOf(this.instance());
      const commits: readonly GitGraphCommit[] | null = this.loaded() ? this.commits() : null;
      untracked(() => this.jump(view, commits));
    });
    effect(() => {
      const ask: GitHistoryAsk | null = GitHistoryAsks.askedOf(this.instance());
      const commits: readonly GitGraphCommit[] | null = this.loaded() ? this.commits() : null;
      untracked(() => this.reveal(ask, commits));
    });
    effect(() => {
      const shown: GitCommitView | null = GitViewing.commitOf(this.instance());
      untracked(() => {
        if (Object.isNull(shown) && !Object.isNull(this.selectedId()))
          this.selectedId.set(Resources.changesId);
      });
    });
    const destroyed: DestroyRef = inject(DestroyRef);
    destroyed.onDestroy(this.client.onChanged(folder => {
      if (folder === this.instance())
        void this.readAsync(folder);
    }));
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    destroyed.onDestroy(GitFolder.follow(this.instance, active));
    effect(() => {
      if (active())
        untracked(() => this.context.showView(Resources.repositoryViewName));
    });
    const details: GitDetailView<GitCommitView> = GitCommitDetails.of(inject(WindowPartTokens.context));
    const chosen: Signal<GitCommitView | null> = computed(() => GitViewing.commitOf(this.instance()));
    details.follow(chosen, active, inject(Injector));
    afterNextRender(() => {
      const row: HTMLElement = this.row().nativeElement;
      const observer: ResizeObserver = new ResizeObserver(() => this.fit(row));
      observer.observe(row);
      destroyed.onDestroy(() => observer.disconnect());
    });
  }

  protected readonly trackRow = (_index: number, row: GitHistoryRow): string => row.id;

  protected imageOf(row: GitHistoryRow): string | null {
    return GitAvatars.imageOf(this.instance(), row.graph.shown.email, row.graph.commit.id);
  }

  protected select(row: GitHistoryRow): void {
    this.notLoaded.set(null);
    GitViewing.branch.set(null);
    this.show(row.id);
    const shown: GitCommitView | null = GitViewing.commitOf(this.instance());
    if (Object.isNull(shown))
      this.context.showView(Resources.viewName);
    else
      GitCommitDetails.of(this.context).showInFront(shown);
  }

  protected move(event: KeyboardEvent): void {
    const rows: readonly GitHistoryRow[] = this.rows();
    const at: number = rows.findIndex(t => t.id === this.selectedId());
    const step: number = event.key === Resources.arrowDownKey ? 1 : event.key === Resources.arrowUpKey ? -1 : 0;
    const next: GitHistoryRow | undefined = rows[Math.min(rows.length - 1, Math.max(0, at + step))];
    if (step === 0 || Object.isUndefined(next))
      return;
    event.preventDefault();
    GitViewing.branch.set(null);
    this.show(next.id);
    this.keepInView(rows.indexOf(next));
  }

  private keepInView(index: number): void {
    const viewport: CdkVirtualScrollViewport = this.viewport();
    const shown: number = Math.max(1, Math.floor(viewport.getViewportSize() / Resources.graphRowPixels));
    const first: number = Math.ceil(viewport.measureScrollOffset() / Resources.graphRowPixels);
    if (index < first)
      viewport.scrollToIndex(index);
    else if (index >= first + shown)
      viewport.scrollToIndex(index - shown + 1);
    this.scrolled(index);
  }

  protected scrolled(index: number): void {
    if (this.hasMore() && !this.isPaging && index + Resources.graphLoadAhead >= this.rows().length)
      void this.pageAsync(this.instance());
  }

  protected labelOf(action: GitHistoryAction): string {
    return action === GitHistoryAction.Push ? Resources.formatPush(this.ahead()) : Resources.historyActionLabels[action];
  }

  protected canRun(action: GitHistoryAction): boolean {
    if (action === GitHistoryAction.Terminal)
      return true;
    const status: GitStatus | null = this.writable();
    return !Object.isNull(status) && (action !== GitHistoryAction.Stash || status.entries.length > 0);
  }

  protected run(action: GitHistoryAction): void {
    if (action === GitHistoryAction.Terminal) {
      this.context.runCommandAsync(Resources.newTerminalCommand, { [Resources.terminalFolderArgument]: this.instance() })
        .catch((error: unknown) => this.errors.handleError(error));
      return;
    }
    if (action === GitHistoryAction.Branch) {
      void this.newBranchAsync();
      return;
    }
    void this.writeAsync((folder, basedOn) => {
      if (action === GitHistoryAction.UndoCommit)
        return this.client.undoCommitAsync(folder, basedOn);
      if (action === GitHistoryAction.Fetch)
        return this.client.fetchAsync(folder, basedOn);
      if (action === GitHistoryAction.Stash)
        return this.client.stashAsync(folder, null, true, basedOn);
      return action === GitHistoryAction.Pull ? this.client.pullAsync(folder, basedOn) : this.client.pushAsync(folder, basedOn);
    });
  }

  protected moreTitle(chips: readonly GitRefChip[]): string {
    return Resources.formatMoreChipsTitle(chips.map(t => t.title));
  }

  protected dragBranch(chip: GitRefChip, row: GitHistoryRow): void {
    this.dragged = Object.isNull(chip.branch) ? null : new GitChipDrag(chip, row.chips, chip.branch, row.id);
  }

  protected overBranch(event: DragEvent, chip: GitRefChip): void {
    if (!Object.isNull(this.dragged) && !Object.isNull(chip.branch) && chip.branch !== this.dragged.branch)
      event.preventDefault();
  }

  protected dropBranch(event: DragEvent, chip: GitRefChip, row: GitHistoryRow): void {
    const dragged = this.dragged;
    this.dragged = null;
    const status = this.status();
    if (Object.isNull(dragged) || Object.isNull(chip.branch) || chip.branch === dragged.branch || Object.isNull(status))
      return;
    event.preventDefault();
    const drop = new GitBranchDrop(dragged.branch, dragged.id, chip.branch, row.id, status.branch, chip.isLocalBranch);
    const predicted = drop.predicted;
    const request: string | null = GitPullRequests.newPullRequestUrlOf(status.remote, dragged.chip, dragged.labels, chip);
    this.dropped.set({ drop, prediction: null, checking: !Object.isNull(predicted), request, left: event.clientX, top: event.clientY });
    if (!Object.isNull(predicted))
      void this.predictDropAsync(drop, predicted);
  }

  protected endDrag(): void {
    this.dragged = null;
  }

  protected mergeDropped(drop: GitBranchDrop): void {
    this.dropped.set(null);
    void this.writeAsync((folder, basedOn) => this.client.mergeAsync(folder, drop.sourceId, basedOn));
  }

  protected switchMergeDropped(drop: GitBranchDrop): void {
    this.dropped.set(null);
    const status: GitStatus | null = this.writable();
    if (!Object.isNull(status) && status.entries.length > 0) {
      this.actionFailure.set(Resources.formatSwitchMergeChanges(drop.target));
      return;
    }
    const dialog = this.dialogs.open(GitSwitchMergeDialogComponent, ".cancel");
    dialog.componentRef?.setInput("drop", drop);
    dialog.componentInstance?.answered.subscribe(isAccepted => {
      dialog.close();
      if (isAccepted)
        void this.writeAsync(async (folder, basedOn) => {
          await this.client.switchBranchAsync(folder, drop.target, basedOn);
          const switched: GitStatus = await this.client.statusAsync(folder);
          await this.client.mergeAsync(folder, drop.sourceId, switched.fingerprint);
        });
    });
  }

  protected requestDropped(url: string): void {
    this.dropped.set(null);
    void this.context.openLinkAsync(url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  protected rebaseDropped(drop: GitBranchDrop): void {
    const folder: string = this.instance();
    this.dropped.set(null);
    GitRebasing.open(folder, new GitRebaseTarget(drop.targetId, drop.target));
    this.context.openDocument(Resources.rebaseDocumentName, folder, Resources.formatRebaseDocumentTitle(folder));
  }

  protected x(lane: number): number {
    return Resources.graphLaneOffsetPixels + lane * Resources.graphLanePixels;
  }

  protected path(line: GitGraphLine): string {
    const row: number = Resources.graphRowPixels;
    const [x1, y1] = [this.x(line.fromLane), line.fromMiddle ? row / 2 : 0];
    const [x2, y2] = [this.x(line.toLane), line.toMiddle ? row / 2 : row];
    if (x1 === x2)
      return `M${x1} ${y1}V${y2}`;
    const middle: number = (y1 + y2) / 2;
    return `M${x1} ${y1}C${x1} ${middle} ${x2} ${middle} ${x2} ${y2}`;
  }

  private show(id: string): void {
    const commit: GitGraphCommit | undefined = this.commits().find(t => t.commit.id === id);
    this.selectedId.set(id);
    if (Object.isUndefined(commit))
      GitViewing.showChanges(this.instance());
    else
      GitViewing.show(new GitCommitView(this.instance(), commit));
  }

  private jump(view: GitBranchView | null, commits: readonly GitGraphCommit[] | null): void {
    if (Object.isNull(view) || view === this.jumped || Object.isNull(commits))
      return;
    const commit: GitGraphCommit | undefined = commits.find(t => view.isAt(t));
    if (Object.isUndefined(commit)) {
      if (!this.hasMore())
        this.jumped = view;
      else if (!this.isPaging)
        void this.pageAsync(view.folder);
      return;
    }
    this.jumped = view;
    this.showCentred(commit.commit.id);
  }

  private reveal(ask: GitHistoryAsk | null, commits: readonly GitGraphCommit[] | null): void {
    if (Object.isNull(ask) || Object.isNull(commits))
      return;
    GitHistoryAsks.take(ask);
    if (!commits.some(t => t.commit.id === ask.commitId)) {
      this.notLoaded.set(Resources.formatCommitNotLoaded(ask.commitId));
      return;
    }
    this.notLoaded.set(null);
    GitViewing.branch.set(null);
    this.showCentred(ask.commitId);
  }

  private showCentred(id: string): void {
    this.show(id);
    this.centre(id, Resources.centringRenders);
  }

  private centre(id: string, renders: number): void {
    afterNextRender(() => {
      const viewport: CdkVirtualScrollViewport = this.viewport();
      const rows: readonly GitHistoryRow[] = this.rows();
      if (viewport.elementRef.nativeElement.scrollHeight < rows.length * Resources.graphRowPixels) {
        if (renders > 1)
          queueMicrotask(() => this.centre(id, renders - 1));
        return;
      }
      const index: number = rows.findIndex(t => t.id === id);
      const shown: number = Math.floor(viewport.getViewportSize() / Resources.graphRowPixels);
      viewport.scrollToIndex(Math.max(0, index - Math.floor(shown / 2)));
    }, { injector: this.injector });
  }

  private async readAsync(folder: string): Promise<void> {
    const reading: number = ++this.reading;
    const switched: boolean = Object.isNull(GitPendingSwitch.branchOf(folder));
    const limit: number = Math.min(Math.max(Resources.graphPageSize, this.commits().length), 5000);
    const status: Promise<GitStatus> = this.client.statusAsync(folder);
    void status.catch(() => undefined);
    try {
      const graph: GitGraph = await this.client.graphAsync(folder, limit, 0);
      if (reading !== this.reading)
        return;
      this.commits.set(graph.commits);
      this.loaded.set(true);
      this.hasMore.set(graph.truncated);
      this.failure.set(null);
      if (switched)
        this.held.set(null);
      if (Object.isNull(this.selectedId()))
        this.selectedId.set(this.rows()[0]?.id ?? null);
      const read: GitStatus = await status;
      if (reading !== this.reading)
        return;
      this.status.set(read);
    }
    catch (error) {
      if (reading !== this.reading)
        return;
      if (switched)
        this.held.set(null);
      this.report(error);
      if (GitRuntimeClient.isFailure(error))
        this.failure.set(GitRuntimeClient.failureOf(error)?.message ?? Resources.historyFailed);
    }
  }

  private async pageAsync(folder: string): Promise<void> {
    const reading: number = this.reading;
    const loaded: readonly GitGraphCommit[] = this.commits();
    this.isPaging = true;
    try {
      const graph: GitGraph = await this.client.graphAsync(folder, Resources.graphPageSize, loaded.length);
      if (reading !== this.reading)
        return;
      this.commits.set([...loaded, ...graph.commits]);
      this.hasMore.set(graph.truncated);
    }
    catch (error) {
      this.report(error);
    }
    finally {
      this.isPaging = false;
    }
  }

  private async newBranchAsync(): Promise<void> {
    const name: string | null = await GitNewBranch.askAsync(this.dialogs, Resources.formatHistoryTitle(this.instance()));
    if (!Object.isNull(name))
      await this.writeAsync((folder, basedOn) => this.client.createBranchAsync(folder, name, basedOn));
  }

  private async writeAsync(write: (folder: string, basedOn: string) => Promise<void>): Promise<void> {
    const status: GitStatus | null = this.writable();
    if (Object.isNull(status))
      return;
    this.busy.set(true);
    this.actionFailure.set(null);
    try {
      await write(this.instance(), status.fingerprint);
    }
    catch (error) {
      this.report(error);
      if (GitRuntimeClient.isFailure(error))
        this.actionFailure.set(GitViewStateService.messageOf(error));
    }
    finally {
      this.busy.set(false);
      void this.readAsync(this.instance());
    }
  }

  private fit(row: HTMLElement): void {
    const rem: number = parseFloat(getComputedStyle(row).fontSize);
    this.isWide.set(row.getBoundingClientRect().width >= Resources.historyLabelsRem * rem);
    this.chipLimit.set(row.getBoundingClientRect().width < Resources.historyOneChipRem * rem ? 1 : Resources.rowChipLimit);
    this.fitting.set(Resources.historyToolbars.length);
    afterNextRender(() => {
      const style: CSSStyleDeclaration = getComputedStyle(row);
      const end: number = row.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(getComputedStyle(this.field().nativeElement).minWidth)
        - Resources.historyToolbarGapRem * rem;
      const ends: readonly number[] = [...this.actions().nativeElement.querySelectorAll(".group")].map(t => t.getBoundingClientRect().right);
      this.fitting.set(ends.every(t => t <= end) ? ends.length : ends.filter(t => t <= end - Resources.historyMoreRem * rem).length);
    }, { injector: this.injector });
  }

  private async predictDropAsync(drop: GitBranchDrop, id: string): Promise<void> {
    let prediction: GitPrediction | null = null;
    try {
      prediction = await this.client.predictAsync(this.instance(), id, PredictionAction.Merge);
    }
    catch (error) {
      this.report(error);
    }
    const shown = this.dropped();
    if (!Object.isNull(shown) && shown.drop === drop)
      this.dropped.set({ ...shown, prediction, checking: false });
  }

  private report(error: unknown): void {
    if (!GitRuntimeClient.isFailure(error))
      this.errors.handleError(error);
  }
}

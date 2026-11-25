/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ElementRef, ErrorHandler, inject, Injector, input, type InputSignal, signal, type Signal, untracked, viewChild,
  type WritableSignal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import "@noldova/context.core";
import { type IWindowPartContext, LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { ButtonComponent, CheckboxComponent, DialogService, IconButtonComponent, TextFieldComponent, ToolbarButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitAgentState } from "../../enums/git-agent-state.ts";
import { GitWorkspaceView } from "../../enums/git-workspace-view.ts";
import type { IGitWorkspaceAcrossPage } from "../../interfaces/i-git-workspace-across-page.ts";
import type { GitAgentRow } from "../../models/git-agent-row.ts";
import type { GitBulkResult } from "../../models/git-bulk-result.ts";
import type { GitBulkTarget } from "../../models/git-bulk-target.ts";
import type { GitPullRequestList } from "../../models/git-pull-request-list.ts";
import type { GitPullRequestRow } from "../../models/git-pull-request-row.ts";
import { GitReferencePart } from "../../models/git-reference-part.ts";
import type { GitRepositorySummary } from "../../models/git-repository-summary.ts";
import type { GitWorkspace } from "../../models/git-workspace.ts";
import { GitWorkspaceAcross } from "../../models/git-workspace-across.ts";
import { GitWorkspaceHost } from "../../models/git-workspace-host.ts";
import { GitWorkspaceOverview } from "../../models/git-workspace-overview.ts";
import type { GitWorkspaceReview } from "../../models/git-workspace-review.ts";
import type { GitWorkspaceReviews } from "../../models/git-workspace-reviews.ts";
import { GitWorkspaceRow } from "../../models/git-workspace-row.ts";
import { GitWorkspaceRun } from "../../models/git-workspace-run.ts";
import { GitWorkspaceSide } from "../../models/git-workspace-side.ts";
import { GitAgents } from "../../services/git-agents.ts";
import type { GitDetailView } from "../../services/git-detail-view.ts";
import { GitPullRequests } from "../../services/git-pull-requests.ts";
import { GitRecentRepositories } from "../../services/git-recent-repositories.ts";
import { GitRepositorySummaries } from "../../services/git-repository-summaries.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitWorkspaceAcrossViews } from "../../services/git-workspace-across-views.ts";
import { GitWorkspaceBulk } from "../../services/git-workspace-bulk.ts";
import { GitWorkspacePages } from "../../services/git-workspace-pages.ts";
import { GitWorkspacePullRequests } from "../../services/git-workspace-pull-requests.ts";
import { GitWorkspaces } from "../../services/git-workspaces.ts";
import { GitWorkspaceSides } from "../../services/git-workspace-sides.ts";
import { GitBulkBranchDialogComponent } from "../git-bulk-branch-dialog/git-bulk-branch-dialog.component.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";
import { GitVisibleDirective } from "./git-visible.directive.ts";
import { GitWorkspaceViewCount } from "../../models/git-workspace-view-count.ts";

/**
 * A workspace's page: its repositories in rows, each with its branch, how far it is from its upstream, its changes and its branch's pull
 * request with its checks, with what spans them in the Across repositories view. Each repository has one row, kept while it is listed, so its
 * reads are made once and held, and the table and the view share them. The page reads every repository once when it opens and again when the window
 * takes the focus, with each one's pull request; only the rows on screen follow their repositories' changes in between. The side panel's views
 * show only the repositories behind, changed, waiting for review or with agents at work, and its hosts the hosts of their remotes and whether
 * someone is signed in. The toolbar pulls the chosen repositories that are only behind, and creates one branch in every chosen one.
 */
@Component({
  selector: "nol-git-workspace",
  imports: [ButtonComponent, CheckboxComponent, FormsModule, GitReferenceTextComponent, GitVisibleDirective, IconButtonComponent, TextFieldComponent, ToolbarButtonComponent],
  templateUrl: "./git-workspace.component.html",
  styleUrl: "./git-workspace.component.css"
})
export class GitWorkspaceComponent {
  /** A workspace's id, or {@link Resources.openRepositoriesInstance} for the repositories opened lately; the document's instance. */
  public readonly instance: InputSignal<string> = input.required<string>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly around: typeof GitReferencePart.around = GitReferencePart.around;
  protected readonly filter: WritableSignal<string> = signal("");
  protected readonly selected: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  protected readonly isFetching: WritableSignal<boolean> = signal(false);
  protected readonly isWriting: WritableSignal<boolean> = signal(false);
  /** How the toolbar's last pull or new branch ended, a line each. */
  protected readonly result: WritableSignal<readonly string[]> = signal<readonly string[]>([]);
  protected readonly renaming: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly workspace: Signal<GitWorkspace | null> = computed(() => GitWorkspaces.find(this.instance()));
  protected readonly title: Signal<string> = computed(() => this.workspace()?.name ?? Resources.dashboardTitle);
  protected readonly folders: Signal<readonly string[]> = computed(() => this.workspace()?.folders ?? GitRecentRepositories.recent());
  protected readonly chosen: Signal<ReadonlySet<string>> = computed(() => new Set(this.folders().filter(t => this.selected().has(t))));
  /** Every listed repository's row, made once for each folder and kept while it is listed. */
  protected readonly allRows: Signal<readonly GitWorkspaceRow[]> = computed(() => {
    const kept: Map<string, GitWorkspaceRow> = new Map();
    for (const folder of this.folders())
      kept.set(folder, this.made.get(folder) ?? this.rowOf(folder));
    this.made = kept;
    return [...kept.values()];
  });
  protected readonly chosenRows: Signal<readonly GitWorkspaceRow[]> = computed(() => this.allRows().filter(t => this.chosen().has(t.folder)));
  /** The chosen repositories a pull would fast-forward, as the rows read them last. */
  protected readonly chosenBehind: Signal<readonly GitWorkspaceRow[]> = computed(() => GitWorkspaceOverview.behindOf(this.chosenRows()));
  /** The side panel's view whose repositories the table shows, or null for all of them. */
  protected readonly view: WritableSignal<GitWorkspaceView | null> = signal<GitWorkspaceView | null>(null);
  /** The rows the filter and the view let through, which the table shows. */
  protected readonly rows: Signal<readonly GitWorkspaceRow[]> = computed(() => {
    const filter: string = this.filter().trim().toLowerCase();
    const view: GitWorkspaceView | null = this.view();
    return this.allRows().filter(t => (filter.length === 0 || t.folder.toLowerCase().includes(filter)) && (Object.isNull(view) || t.views().has(view)));
  });
  /** Each view with how many of the repositories read so far it shows. */
  protected readonly views: Signal<readonly GitWorkspaceViewCount[]> = computed(() =>
    Object.values(GitWorkspaceView).map(view => new GitWorkspaceViewCount(view, this.allRows().filter(t => t.views().has(view)).length)));
  protected readonly hosts: Signal<readonly GitWorkspaceHost[]> = computed(() => GitWorkspaceHost.listOf(this.allRows(), t => GitPullRequests.of(t)));
  /** What the Workspaces view shows of the page while it is in front. */
  protected readonly side: Signal<GitWorkspaceSide> = computed(() => new GitWorkspaceSide(this.workspace()?.id ?? null, this.view, this.views, this.hosts,
    view => this.chooseView(view)));
  /** The agents' runs in every listed repository, from every module that runs agents. */
  protected readonly runs: Signal<readonly GitWorkspaceRun[]> = computed(() => GitAgents.all().flatMap(provider => this.allRows().flatMap(row =>
    this.attempt(() => provider.listFor(row.folder)() ?? [], []).map(t => new GitWorkspaceRun(row.folder, row.name, provider, t)))));

  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly summaries: GitRepositorySummaries = new GitRepositorySummaries(this.context);
  private readonly pullRequests: GitWorkspacePullRequests = new GitWorkspacePullRequests(this.errors);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly bulk: GitWorkspaceBulk = new GitWorkspaceBulk(new GitRuntimeClient(this.context), this.errors);
  private readonly watched: Set<string> = new Set();
  private made: ReadonlyMap<string, GitWorkspaceRow> = new Map();
  /** Counts the times the window took the focus, so every row reads its pull request again. */
  private readonly focused: WritableSignal<number> = signal(0);
  /** The page as the Across repositories view acts on it. */
  private readonly page: IGitWorkspaceAcrossPage = {
    open: folder => this.open(folder),
    openPullRequest: (row, pullRequest) => this.openPullRequest(row, pullRequest),
    openReview: review => this.openReview(review),
    readWritten: folders => this.readWritten(folders)
  };
  /** The pull requests across every listed repository that ask the person for a review, which Needs you lists. */
  protected readonly reviews: Signal<GitWorkspaceReviews> = this.pullRequests.reviewsOf(this.allRows);
  /** What the page asks the Across repositories view to show: every listed repository, the agents' runs, the reviews, and the page itself. */
  protected readonly across: Signal<GitWorkspaceAcross> = computed(() => new GitWorkspaceAcross(this.instance(), this.allRows(), this.runs(), this.reviews(), this.page));
  private readonly nameField: Signal<ElementRef<HTMLInputElement> | undefined> = viewChild("nameField", { read: ElementRef<HTMLInputElement> });

  public constructor() {
    effect(() => {
      const field: HTMLInputElement | undefined = this.nameField()?.nativeElement;
      field?.focus();
      field?.select();
    });
    effect(() => {
      const shown: ReadonlySet<string> = new Set(this.rows().map(t => t.folder));
      untracked(() => {
        for (const folder of [...this.watched].filter(t => !shown.has(t)))
          this.unwatch(folder);
      });
    });
    effect(() => {
      this.focused();
      for (const row of this.allRows()) {
        const summary: GitRepositorySummary | null = row.summary();
        untracked(() => this.pullRequests.refreshOnce(row.folder, summary));
      }
    });
    effect(() => {
      const folders: readonly string[] = this.folders();
      untracked(() => void this.summaries.readMissingAsync(folders));
    });
    effect(() => {
      this.focused();
      const summaries: readonly (GitRepositorySummary | null)[] = this.allRows().map(t => t.summary());
      untracked(() => this.pullRequests.refreshReviewsOnce(summaries));
    });
    const refresh = (): void => {
      void this.summaries.refreshAllAsync(this.folders());
      this.pullRequests.forget();
      this.focused.update(t => t + 1);
    };
    window.addEventListener("focus", refresh);
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    const acrossViews: GitDetailView<GitWorkspaceAcross> = GitWorkspaceAcrossViews.of(this.context);
    acrossViews.follow(this.across, active, inject(Injector));
    GitWorkspaceSides.of(this.context).follow(this.side, active, inject(Injector));
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener("focus", refresh);
      this.summaries.dispose();
    });
  }

  protected async fetchAllAsync(): Promise<void> {
    this.isFetching.set(true);
    try {
      await this.summaries.fetchAllAsync(this.folders());
    }
    finally {
      this.isFetching.set(false);
    }
  }

  /** Pulls the chosen repositories that are only behind, which needs no confirm: a pull only fast-forwards, and each is checked again first. */
  protected pullChosenAsync(): Promise<void> {
    const targets: readonly GitBulkTarget[] = GitWorkspaceOverview.pullTargetsOf(this.chosenBehind());
    return this.writeAsync(Resources.pulledVerb, targets, () => this.bulk.pullAsync(targets));
  }

  /** Asks for the name, naming the chosen repositories, and creates the branch in each on Create; a local write, so nothing else is asked. */
  protected newBranchInChosen(): void {
    const targets: readonly GitBulkTarget[] = GitWorkspaceOverview.pullTargetsOf(this.chosenRows());
    const dialog = this.dialogs.open(GitBulkBranchDialogComponent, ".name");
    dialog.componentRef?.setInput("repositories", targets.map(t => t.repository));
    dialog.componentInstance?.answered.subscribe(name => {
      dialog.close();
      if (!Object.isNull(name))
        void this.writeAsync(Resources.formatBranchedVerb(name), targets, () => this.bulk.createBranchAsync(targets, name));
    });
  }

  protected async addRepositoryAsync(): Promise<void> {
    const folder: string | null = await this.context.chooseFolderAsync();
    const workspace: GitWorkspace | null = this.workspace();
    if (Object.isNull(folder))
      return;
    if (Object.isNull(workspace))
      GitRecentRepositories.remember(folder);
    else
      GitWorkspaces.addFolder(workspace.id, folder);
  }

  protected select(folder: string, isSelected: boolean): void {
    const selected: Set<string> = new Set(this.selected());
    if (isSelected)
      selected.add(folder);
    else
      selected.delete(folder);
    this.selected.set(selected);
  }

  protected removeChosen(): void {
    const workspace: GitWorkspace | null = this.workspace();
    if (Object.isNull(workspace))
      GitRecentRepositories.forget(this.chosen());
    else
      GitWorkspaces.removeFolders(workspace.id, this.chosen());
    this.selected.set(new Set());
  }

  protected moveChosen(workspace: GitWorkspace, by: -1 | 1): void {
    GitWorkspaces.moveFolders(workspace.id, this.chosen(), by);
  }

  protected open(folder: string): void {
    GitWorkspacePages.openRepository(this.context, folder);
  }

  /** Opens the branch's pull request in its host's own page when it has one, else its page in the browser. */
  protected openPullRequest(row: GitWorkspaceRow, pullRequest: GitPullRequestRow): void {
    if (this.pullRequests.open(row.folder, row.summary(), pullRequest))
      return;
    void this.context.openLinkAsync(pullRequest.url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  /** Opens a pull request that asks for the person's review in its host's own page when it has one, else its page in the browser. */
  protected openReview(review: GitWorkspaceReview): void {
    if (this.pullRequests.openReview(review))
      return;
    void this.context.openLinkAsync(review.row.url, { place: LinkPlace.System }).catch((error: unknown) => this.errors.handleError(error));
  }

  /**
   * Shows a view of the page's repositories, reading every one first, or all of them for null.
   * @param view The view, or null.
   */
  protected chooseView(view: GitWorkspaceView | null): void {
    this.view.set(view);
    if (!Object.isNull(view))
      void this.summaries.refreshAllAsync(this.folders());
  }

  /**
   * Keeps the name typed, on Enter or when the field loses focus; a blank or unchanged name leaves the workspace as it is. The field going
   * away after Enter or Escape may blur it, which then finds nothing being renamed.
   */
  protected rename(workspace: GitWorkspace): void {
    const name: string | null = this.renaming();
    if (Object.isNull(name))
      return;
    this.renaming.set(null);
    const trimmed: string = name.trim();
    if (trimmed.length === 0 || trimmed === workspace.name)
      return;
    GitWorkspaces.rename(workspace.id, trimmed);
    this.context.updateDocument(Resources.workspaceDocumentName, workspace.id, { title: trimmed });
  }

  protected removeWorkspace(workspace: GitWorkspace): void {
    GitWorkspaces.remove(workspace.id);
    GitWorkspacePages.open(this.context, null);
    this.context.closeDocument(Resources.workspaceDocumentName, workspace.id);
  }

  /** Reads again the repositories a push or pull of the Across repositories view wrote to. */
  protected readWritten(folders: readonly string[]): void {
    void this.summaries.refreshAllAsync(folders);
  }

  /** Runs a toolbar write, then shows how it ended and reads again every repository it wrote to or tried to. */
  private async writeAsync(verb: string, targets: readonly GitBulkTarget[], write: () => Promise<GitBulkResult>): Promise<void> {
    this.isWriting.set(true);
    this.result.set([]);
    const result: GitBulkResult = await write();
    this.result.set(GitWorkspaceOverview.resultLinesOf(verb, result));
    this.isWriting.set(false);
    void this.summaries.refreshAllAsync(targets.map(t => t.folder));
  }

  /** Follows a row's repository while the row is on screen. */
  protected follow(folder: string, isVisible: boolean): void {
    if (!isVisible)
      this.unwatch(folder);
    else if (!this.watched.has(folder)) {
      this.watched.add(folder);
      this.summaries.watch(folder);
    }
  }

  /** Whether any agent provider has a run working or waiting for the person in the folder, reporting a provider whose list throws. */
  private hasAgentsAtWork(folder: string): boolean {
    return GitAgents.all().some(provider => {
      let runs: readonly GitAgentRow[];
      try {
        runs = provider.listFor(folder)() ?? [];
      }
      catch (error) {
        this.errors.handleError(error);
        return false;
      }
      return runs.some(t => t.state === GitAgentState.Working || t.state === GitAgentState.WaitingForYou);
    });
  }

  private unwatch(folder: string): void {
    if (!this.watched.delete(folder))
      return;
    this.summaries.unwatch(folder);
  }

  private rowOf(folder: string): GitWorkspaceRow {
    const summary: Signal<GitRepositorySummary | null> = this.summaries.summaryOf(folder);
    const list: Signal<GitPullRequestList | null | undefined> = this.pullRequests.listOf(folder, summary);
    return new GitWorkspaceRow(folder, summary, this.pullRequests.branchOf(folder, summary, list), computed(() => this.hasAgentsAtWork(folder)),
      this.pullRequests.stackListOf(folder, summary, list), this.pullRequests.openListOf(folder, summary));
  }

  /** Runs a module's member, reporting what it throws and answering the fallback instead. */
  private attempt<T>(run: () => T, fallback: T): T {
    try {
      return run();
    }
    catch (error) {
      this.errors.handleError(error);
      return fallback;
    }
  }
}

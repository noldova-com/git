/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ErrorHandler, inject, Injector, input, type InputSignal, type Signal, signal, untracked, viewChild, type WritableSignal } from "@angular/core";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  ConflictKind, ConflictResolution, FileState, type GitConflict, type GitMarkerCheck, type GitOperation, type GitPrediction, type GitStatus, OperationKind, PredictionAction
} from "@noldova/git.protocol";
import { type ActiveConflict, CodeTextComponent, ConflictState, MergeEditorComponent, type ShikiLineTokenizer } from "@noldova/editor.angular";
import { ButtonComponent, ButtonVariant, ToolbarButtonComponent } from "@noldova/ui.components.angular";

import { GitResolvedBy } from "../../enums/git-resolved-by.ts";
import { GitConflictDetail } from "../../models/git-conflict-detail.ts";
import { GitOperationName } from "../../models/git-operation-name.ts";
import { Resources } from "../../../resources.ts";
import { GitCodeColors } from "../../services/git-code-colors.ts";
import { GitConflictDetails } from "../../services/git-conflict-details.ts";
import type { GitDetailView } from "../../services/git-detail-view.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitResolving } from "../../services/git-resolving.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

/** A folder's merge, rebase, cherry-pick or revert as a document: its header with abort and continue, its files by conflict, resolved and merged cleanly, and the open file's sides. */
@Component({
  selector: "nol-git-conflicts",
  imports: [ButtonComponent, CodeTextComponent, MergeEditorComponent, ToolbarButtonComponent],
  providers: [GitViewStateService],
  templateUrl: "./git-conflicts.component.html",
  styleUrl: "./git-conflicts.component.css"
})
export class GitConflictsComponent {
  private static readonly NO_OURS: ReadonlySet<ConflictKind> = new Set([ConflictKind.BothDeleted, ConflictKind.AddedByThem, ConflictKind.DeletedByUs]);
  private static readonly NO_THEIRS: ReadonlySet<ConflictKind> = new Set([ConflictKind.BothDeleted, ConflictKind.AddedByUs, ConflictKind.DeletedByThem]);
  private static readonly WHOLE_FILE: Readonly<Record<Exclude<ConflictResolution, typeof ConflictResolution.Text>, GitResolvedBy>> = {
    Ours: GitResolvedBy.Ours, Theirs: GitResolvedBy.Theirs, Delete: GitResolvedBy.Deleted
  };

  /** The write whose prediction names the files an operation conflicted on; a rebase has none, since its operation names the branch, not the commit it applies. */
  private static readonly PREDICTIONS: Readonly<Partial<Record<OperationKind, PredictionAction>>> = {
    [OperationKind.Merge]: PredictionAction.Merge, [OperationKind.CherryPick]: PredictionAction.CherryPick, [OperationKind.Revert]: PredictionAction.Revert
  };

  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly colors: GitCodeColors = inject(GitCodeColors);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(inject(WindowPartTokens.context));
  private reads = 0;
  private markerReads = 0;
  /** The operation whose first conflicts the screen read last, as its action and commit, or `null` when none was read. */
  private firstConflictsKey: string | null = null;
  /**
   * The files the operation conflicted on when it began, worked out again from HEAD and the commit it applies, so a file resolved before
   * the screen opened, outside it or before a restart still counts as resolved; none for a rebase, before the answer, or after it fails.
   */
  private readonly firstConflicts: WritableSignal<readonly string[]> = signal<readonly string[]>([]);

  protected readonly resources: typeof Resources = Resources;
  protected readonly resolutions: typeof ConflictResolution = ConflictResolution;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  /** The status, while the Git panel follows this document's folder; writes go to the panel's folder, so another folder's screen offers none. */
  protected readonly status: Signal<GitStatus | null> = computed(() => this.state.folder() === this.instance() ? this.state.status() : null);
  protected readonly conflicted: Signal<readonly string[]> = computed(() => this.status()?.entries.filter(t => t.conflict !== null).map(t => t.path) ?? []);
  /** The files out of conflict that the operation conflicted on, each with how this screen resolved it, or no note when it was resolved elsewhere. */
  protected readonly resolved: Signal<readonly (readonly [string, string])[]> = computed(() => {
    const conflicted: ReadonlySet<string> = new Set(this.conflicted());
    const recorded: ReadonlyMap<string, GitResolvedBy> = GitResolving.resolutionsOf(this.instance());
    return [...new Set([...this.firstConflicts(), ...recorded.keys()])].filter(path => !conflicted.has(path)).map(path => {
      const by: GitResolvedBy | undefined = recorded.get(path);
      return [path, by === undefined ? "" : Resources.resolutionNotes[by]];
    });
  });
  protected readonly selected: WritableSignal<string | null> = signal<string | null>(null);
  /** The file the screen shows: the one picked while it is still conflicted, else the first conflicted file. */
  protected readonly current: Signal<string | null> = computed(() => {
    const picked: string | null = this.selected() ?? GitResolving.pathOf(this.instance());
    return picked !== null && this.conflicted().includes(picked) ? picked : this.conflicted()[0] ?? null;
  });
  protected readonly conflict: WritableSignal<GitConflict | null> = signal<GitConflict | null>(null);
  protected readonly readFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly hasOurs: Signal<boolean> = computed(() => !GitConflictsComponent.lacks(this.conflict(), GitConflictsComponent.NO_OURS));
  protected readonly hasTheirs: Signal<boolean> = computed(() => !GitConflictsComponent.lacks(this.conflict(), GitConflictsComponent.NO_THEIRS));
  /** Whether the open file is text on both sides, which the merge editor resolves line by line. */
  protected readonly merges: Signal<boolean> = computed(() => {
    const conflict: GitConflict | null = this.conflict();
    return conflict !== null && conflict.ours !== null && conflict.theirs !== null;
  });
  /** The merge editor's open conflicts, or `null` while its markers don't parse. */
  protected readonly unresolved: WritableSignal<number | null> = signal<number | null>(null);
  /** The state of each conflict the merge editor found in the open file, in order. */
  protected readonly conflictStates: WritableSignal<readonly ConflictState[]> = signal<readonly ConflictState[]>([]);
  /** The result pane's note, such as "editable · conflict 1 resolved, conflict 2 open". */
  protected readonly resultNote: Signal<string> = computed(() => Resources.formatResultNote(this.conflictStates().map(t => t !== ConflictState.Unresolved)));
  /** The open file's tokenizer, which colors its code, or `null` while it loads, when no language fits the file, or when no file is open. */
  protected readonly tokenizer: Signal<ShikiLineTokenizer | null> = computed(() => this.colors.tokenizerOf(this.current()));
  /** Whether the merge editor shows the base between ours and theirs. */
  protected readonly showsBase: WritableSignal<boolean> = signal(false);
  /** How many conflicts the merge editor found in the open file. */
  protected readonly conflictCount: WritableSignal<number> = signal(0);
  /** The open file's resolved conflicts out of all of them, such as "1 of 2"; empty until the merge editor counts them. */
  protected readonly fileProgress: Signal<string> = computed(() => {
    const unresolved: number | null = this.unresolved();
    const count: number = this.conflictCount();
    return unresolved === null || count === 0 ? "" : Resources.formatConflictProgress(count - unresolved, count);
  });
  private readonly editor: Signal<MergeEditorComponent | undefined> = viewChild(MergeEditorComponent);
  /** Whether the merge editor couldn't read the open file's conflict markers, so it shows no panes and none of their heads. */
  protected readonly markersUnreadable: Signal<boolean> = computed(() => this.editor()?.result() === null);
  /** The merge editor's active conflict, with its base and its lines in the result, or `null` while none is. */
  private readonly activeConflict: Signal<ActiveConflict | null> = computed(() => this.editor()?.activeConflict() ?? null);
  /** The files out of conflict that still have a conflict marker line, or `null` until the check answers or after it fails. */
  private readonly leftoverMarkers: WritableSignal<readonly string[] | null> = signal<readonly string[] | null>(null);
  private readonly markerFailure: WritableSignal<string | null> = signal<string | null>(null);
  /** What the Conflict view shows of this document while it is in front: the open file's active conflict and the check before the commit; `null` with no file open. */
  private readonly detail: Signal<GitConflictDetail | null> = computed(() => this.current() === null ? null
    : new GitConflictDetail(this.activeConflict(), this.tokenizer(), this.leftoverMarkers(), this.markerFailure()));
  /** Whether Merged cleanly lists every file, rather than its first few and how many more. */
  protected readonly showsAllClean: WritableSignal<boolean> = signal(false);
  protected readonly progress: Signal<string> = computed(() =>
    Resources.formatResolvedCount(this.resolved().length, this.resolved().length + this.conflicted().length));

  /** The repository's folder; the document's instance. */
  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    effect(() => {
      const path: string | null = this.current();
      this.status();
      untracked(() => void this.readAsync(path));
    });
    effect(() => {
      const status: GitStatus | null = this.status();
      if (status !== null && status.operation === null)
        untracked(() => GitResolving.forget(this.instance()));
    });
    effect(() => {
      const operation: GitOperation | null = this.status()?.operation ?? null;
      untracked(() => void this.readFirstConflictsAsync(operation));
    });
    effect(() => {
      const status: GitStatus | null = this.status();
      const conflicted: ReadonlySet<string> = new Set(this.conflicted());
      if (status?.operation != null)
        untracked(() => void this.checkMarkersAsync(conflicted));
    });
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    inject(DestroyRef).onDestroy(GitFolder.follow(this.instance, active));
    const details: GitDetailView<GitConflictDetail> = GitConflictDetails.of(inject(WindowPartTokens.context));
    details.follow(this.detail, active, inject(Injector));
  }

  /** The staged files that merged without a conflict and weren't resolved here. */
  protected cleanOf(status: GitStatus): readonly string[] {
    const resolved: ReadonlySet<string> = new Set(this.resolved().map(([path]) => path));
    return status.entries.filter(t => t.conflict === null && t.index !== FileState.Unmodified && t.index !== FileState.Untracked && !resolved.has(t.path))
      .map(t => t.path);
  }

  /** How many of the files merged cleanly the list leaves for its "more" row: none once it shows them all. */
  protected hiddenOf(clean: readonly string[]): number {
    return this.showsAllClean() ? 0 : Math.max(clean.length - Resources.shownCleanFiles, 0);
  }

  protected operationText(operation: GitOperation, branch: string | null): string {
    return Resources.formatOperation(Resources.operations[operation.kind], GitOperationName.of(operation), branch);
  }

  /** A path's file name, which its row leads with. */
  protected nameOf(path: string): string {
    return path.slice(path.lastIndexOf(Resources.slash) + 1);
  }

  /** The folder a path's file is in, shown after its name; empty at the repository's top. */
  protected folderOf(path: string): string {
    return path.slice(0, Math.max(path.lastIndexOf(Resources.slash), 0));
  }

  /** Shows a conflicted file; on the file it shows, reads it again after a failed read. */
  protected pick(path: string): void {
    if (path === this.current() && this.readFailure() !== null)
      void this.readAsync(path);
    this.selected.set(path);
  }

  protected resolve(conflict: GitConflict, resolution: ConflictResolution, text: string | null = null): void {
    const by: GitResolvedBy = GitConflictsComponent.resolvedBy(resolution, this.conflictStates());
    void this.state.resolveConflictAsync(conflict.path, resolution, text).then(() => {
      if (this.state.failure() === null)
        GitResolving.record(this.instance(), conflict.path, by);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  /** Which choice a resolution came from: a merge editor's text is both sides when every conflict kept both, and an edit otherwise. */
  private static resolvedBy(resolution: ConflictResolution, states: readonly ConflictState[]): GitResolvedBy {
    if (resolution !== ConflictResolution.Text)
      return GitConflictsComponent.WHOLE_FILE[resolution];
    return states.length > 0 && states.every(t => t === ConflictState.BothOursFirst || t === ConflictState.BothTheirsFirst) ? GitResolvedBy.Both : GitResolvedBy.Edited;
  }

  protected continue(): void {
    void this.state.continueOperationAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  protected abort(): void {
    void this.state.abortOperationAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  private async readAsync(path: string | null): Promise<void> {
    const read: number = ++this.reads;
    this.readFailure.set(null);
    if (path === null) {
      this.conflict.set(null);
      return;
    }
    if (this.conflict()?.path !== path) {
      this.conflict.set(null);
      this.conflictCount.set(0);
      this.conflictStates.set([]);
    }
    try {
      const conflict: GitConflict = await this.state.conflictAsync(path);
      if (read === this.reads)
        this.conflict.set(conflict);
    }
    catch (error) {
      if (read === this.reads)
        this.readFailure.set(GitViewStateService.messageOf(error));
    }
  }

  /** Reads which files out of conflict still have a marker line, keeping only the newest read's answer. */
  private async checkMarkersAsync(conflicted: ReadonlySet<string>): Promise<void> {
    const read: number = ++this.markerReads;
    try {
      const check: GitMarkerCheck = await this.state.markerCheckAsync();
      if (read !== this.markerReads)
        return;
      this.leftoverMarkers.set(check.paths.filter(t => !conflicted.has(t)));
      this.markerFailure.set(null);
    }
    catch (error) {
      if (read !== this.markerReads)
        return;
      this.leftoverMarkers.set(null);
      this.markerFailure.set(GitViewStateService.messageOf(error));
    }
  }

  /**
   * Reads which files the operation conflicted on when it began, once per operation, keeping only the newest operation's answer; a
   * failed read leaves Resolved to the files resolved on this screen.
   */
  private async readFirstConflictsAsync(operation: GitOperation | null): Promise<void> {
    const action: PredictionAction | undefined = operation === null ? undefined : GitConflictsComponent.PREDICTIONS[operation.kind];
    const from: string = operation?.from ?? "";
    const read: { readonly action: PredictionAction; readonly key: string } | null =
      action !== undefined && Resources.objectIdPattern.test(from) ? { action, key: `${action} ${from}` } : null;
    if ((read?.key ?? null) === this.firstConflictsKey)
      return;
    this.firstConflictsKey = read?.key ?? null;
    this.firstConflicts.set([]);
    if (read === null)
      return;
    try {
      const prediction: GitPrediction = await this.client.predictAsync(this.instance(), from, read.action);
      if (read.key === this.firstConflictsKey)
        this.firstConflicts.set(prediction.paths);
    }
    catch {
      // A failed read leaves Resolved to the files resolved on this screen.
    }
  }

  private static lacks(conflict: GitConflict | null, kinds: ReadonlySet<ConflictKind>): boolean {
    return conflict === null || kinds.has(conflict.kind);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ErrorHandler, inject, Injector, input, type InputSignal, type Signal, signal, untracked, viewChild, type WritableSignal } from "@angular/core";
import { CodeTextComponent } from "@noldova/code.editor.angular";
import { type ActiveConflict, ConflictState, MergeEditorComponent } from "@noldova/code.editor.merge.angular";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  ConflictKind, ConflictResolution, FileState, type GitConflict, type GitMarkerCheck, type GitOperation, type GitPrediction, type GitStatus, OperationKind, PredictionAction
} from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, ToolbarButtonComponent } from "@noldova/ui.components.angular";

import { GitResolvedBy } from "../../enums/git-resolved-by.ts";
import { GitConflictDetail } from "../../models/git-conflict-detail.ts";
import { GitFirstConflictsRead } from "../../models/git-first-conflicts-read.ts";
import { GitOperationName } from "../../models/git-operation-name.ts";
import { Resources } from "../../../resources.ts";
import { GitCodeColors } from "../../services/git-code-colors.ts";
import { GitConflictDetails } from "../../services/git-conflict-details.ts";
import type { GitDetailView } from "../../services/git-detail-view.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitResolving } from "../../services/git-resolving.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitResolvedFile } from "../../models/git-resolved-file.ts";

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

  private static readonly PREDICTIONS: Readonly<Partial<Record<OperationKind, PredictionAction>>> = {
    [OperationKind.Merge]: PredictionAction.Merge, [OperationKind.CherryPick]: PredictionAction.CherryPick, [OperationKind.Revert]: PredictionAction.Revert
  };

  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly colors: GitCodeColors = inject(GitCodeColors);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(inject(WindowPartTokens.context));
  private reads = 0;
  private markerReads = 0;
  private firstConflictsKey: string | null = null;
  private readonly firstConflicts: WritableSignal<readonly string[]> = signal<readonly string[]>([]);

  protected readonly resources: typeof Resources = Resources;
  protected readonly resolutions: typeof ConflictResolution = ConflictResolution;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly status: Signal<GitStatus | null> = computed(() => this.state.folder() === this.instance() ? this.state.status() : null);
  protected readonly conflicted: Signal<readonly string[]> = computed(() => this.status()?.entries.filter(t => !Object.isNull(t.conflict)).map(t => t.path) ?? []);
  protected readonly resolved: Signal<readonly GitResolvedFile[]> = computed(() => {
    const conflicted: ReadonlySet<string> = new Set(this.conflicted());
    const recorded: ReadonlyMap<string, GitResolvedBy> = GitResolving.resolutionsOf(this.instance());
    return [...new Set([...this.firstConflicts(), ...recorded.keys()])].filter(path => !conflicted.has(path)).map(path => {
      const by: GitResolvedBy | undefined = recorded.get(path);
      return new GitResolvedFile(path, Object.isUndefined(by) ? "" : Resources.resolutionNotes[by]);
    });
  });
  protected readonly selected: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly current: Signal<string | null> = computed(() => {
    const picked: string | null = this.selected() ?? GitResolving.pathOf(this.instance());
    return !Object.isNull(picked) && this.conflicted().includes(picked) ? picked : this.conflicted()[0] ?? null;
  });
  protected readonly conflict: WritableSignal<GitConflict | null> = signal<GitConflict | null>(null);
  protected readonly readFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly hasOurs: Signal<boolean> = computed(() => !GitConflictsComponent.lacks(this.conflict(), GitConflictsComponent.NO_OURS));
  protected readonly hasTheirs: Signal<boolean> = computed(() => !GitConflictsComponent.lacks(this.conflict(), GitConflictsComponent.NO_THEIRS));
  protected readonly merges: Signal<boolean> = computed(() => {
    const conflict: GitConflict | null = this.conflict();
    return !Object.isNull(conflict) && !Object.isNull(conflict.ours) && !Object.isNull(conflict.theirs);
  });
  protected readonly unresolved: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly conflictStates: WritableSignal<readonly ConflictState[]> = signal<readonly ConflictState[]>([]);
  protected readonly resultNote: Signal<string> = computed(() => Resources.formatResultNote(this.conflictStates().map(t => t !== ConflictState.Unresolved)));
  protected readonly language: Signal<string | null> = computed(() => this.colors.languageOf(this.current()));
  protected readonly showsBase: WritableSignal<boolean> = signal(false);
  protected readonly conflictCount: WritableSignal<number> = signal(0);
  protected readonly fileProgress: Signal<string> = computed(() => {
    const unresolved: number | null = this.unresolved();
    const count: number = this.conflictCount();
    return Object.isNull(unresolved) || count === 0 ? "" : Resources.formatConflictProgress(count - unresolved, count);
  });
  private readonly editor: Signal<MergeEditorComponent | undefined> = viewChild(MergeEditorComponent);
  protected readonly markersUnreadable: Signal<boolean> = computed(() => Object.isNull(this.editor()?.result()));
  private readonly activeConflict: Signal<ActiveConflict | null> = computed(() => this.editor()?.activeConflict() ?? null);
  private readonly leftoverMarkers: WritableSignal<readonly string[] | null> = signal<readonly string[] | null>(null);
  private readonly markerFailure: WritableSignal<string | null> = signal<string | null>(null);
  private readonly detail: Signal<GitConflictDetail | null> = computed(() => Object.isNull(this.current()) ? null
    : new GitConflictDetail(this.activeConflict(), this.language(), this.leftoverMarkers(), this.markerFailure()));
  protected readonly showsAllClean: WritableSignal<boolean> = signal(false);
  protected readonly progress: Signal<string> = computed(() =>
    Resources.formatResolvedCount(this.resolved().length, this.resolved().length + this.conflicted().length));

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    effect(() => {
      const path: string | null = this.current();
      this.status();
      untracked(() => void this.readAsync(path));
    });
    effect(() => {
      const status: GitStatus | null = this.status();
      if (!Object.isNull(status) && Object.isNull(status.operation))
        untracked(() => GitResolving.forget(this.instance()));
    });
    effect(() => {
      const operation: GitOperation | null = this.status()?.operation ?? null;
      untracked(() => void this.readFirstConflictsAsync(operation));
    });
    effect(() => {
      const status: GitStatus | null = this.status();
      const conflicted: ReadonlySet<string> = new Set(this.conflicted());
      if (!Object.isNullOrUndefined(status?.operation))
        untracked(() => void this.checkMarkersAsync(conflicted));
    });
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    inject(DestroyRef).onDestroy(GitFolder.follow(this.instance, active));
    const details: GitDetailView<GitConflictDetail> = GitConflictDetails.of(inject(WindowPartTokens.context));
    details.follow(this.detail, active, inject(Injector));
  }

  protected cleanOf(status: GitStatus): readonly string[] {
    const resolved: ReadonlySet<string> = new Set(this.resolved().map(t => t.path));
    return status.entries.filter(t => Object.isNull(t.conflict) && t.index !== FileState.Unmodified && t.index !== FileState.Untracked && !resolved.has(t.path))
      .map(t => t.path);
  }

  protected hiddenOf(clean: readonly string[]): number {
    return this.showsAllClean() ? 0 : Math.max(clean.length - Resources.shownCleanFiles, 0);
  }

  protected operationText(operation: GitOperation, branch: string | null): string {
    return Resources.formatOperation(Resources.operations[operation.kind], GitOperationName.of(operation), branch);
  }

  protected nameOf(path: string): string {
    return path.slice(path.lastIndexOf(Resources.slash) + 1);
  }

  protected folderOf(path: string): string {
    return path.slice(0, Math.max(path.lastIndexOf(Resources.slash), 0));
  }

  protected pick(path: string): void {
    if (path === this.current() && !Object.isNull(this.readFailure()))
      void this.readAsync(path);
    this.selected.set(path);
  }

  protected resolve(conflict: GitConflict, resolution: ConflictResolution, text: string | null = null): void {
    const by: GitResolvedBy = GitConflictsComponent.resolvedBy(resolution, this.conflictStates());
    void this.state.resolveConflictAsync(conflict.path, resolution, text).then(() => {
      if (Object.isNull(this.state.failure()))
        GitResolving.record(this.instance(), conflict.path, by);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

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
    if (Object.isNull(path)) {
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

  private async readFirstConflictsAsync(operation: GitOperation | null): Promise<void> {
    const action: PredictionAction | undefined = Object.isNull(operation) ? undefined : GitConflictsComponent.PREDICTIONS[operation.kind];
    const from: string = operation?.from ?? "";
    const read: GitFirstConflictsRead | null =
      !Object.isUndefined(action) && Resources.objectIdPattern.test(from) ? new GitFirstConflictsRead(action, `${action} ${from}`) : null;
    if ((read?.key ?? null) === this.firstConflictsKey)
      return;
    this.firstConflictsKey = read?.key ?? null;
    this.firstConflicts.set([]);
    if (Object.isNull(read))
      return;
    try {
      const prediction: GitPrediction = await this.client.predictAsync(this.instance(), from, read.action);
      if (read.key === this.firstConflictsKey)
        this.firstConflicts.set(prediction.paths);
    }
    catch {
    }
  }

  private static lacks(conflict: GitConflict | null, kinds: ReadonlySet<ConflictKind>): boolean {
    return Object.isNull(conflict) || kinds.has(conflict.kind);
  }
}

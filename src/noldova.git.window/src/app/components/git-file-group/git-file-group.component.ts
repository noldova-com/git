/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, DestroyRef, effect, ElementRef, ErrorHandler, inject, input, type InputSignal, output, type OutputEmitterRef, type Signal, signal,
  untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { DiffFile, GitDiff } from "@noldova/git.protocol";
import { DialogService, FileBadgeComponent, IconButtonComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { GitDiffRowKind } from "../../enums/git-diff-row-kind.ts";
import { GitFileGroupKind } from "../../enums/git-file-group-kind.ts";
import { GitFileTone } from "../../enums/git-file-tone.ts";
import { GitCodeSpan } from "../../models/git-code-span.ts";
import { GitDiffRow } from "../../models/git-diff-row.ts";
import type { GitFileItem } from "../../models/git-file-item.ts";
import type { GitFileGroup } from "../../models/git-file-group.ts";
import type { GitFileRow } from "../../models/git-file-row.ts";
import { Resources } from "../../../resources.ts";
import { GitDiscardDialogComponent } from "../git-discard-dialog/git-discard-dialog.component.ts";
import { FocusKeeper } from "../../services/focus-keeper.ts";
import { GitCodeColors } from "../../services/git-code-colors.ts";
import { GitFileTree } from "../../services/git-file-tree.ts";
import { GitFileLayoutButtonComponent } from "../git-file-layout-button/git-file-layout-button.component.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

@Component({
  selector: "nol-git-file-group",
  imports: [FileBadgeComponent, GitFileLayoutButtonComponent, IconButtonComponent, NgTemplateOutlet, TooltipDirective],
  templateUrl: "./git-file-group.component.html",
  styleUrl: "./git-file-group.component.css"
})
export class GitFileGroupComponent {
  private static readonly NONE: ReadonlySet<number> = new Set<number>();
  private readonly requests: Map<string, number> = new Map();
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly colors: GitCodeColors = inject(GitCodeColors);

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof GitFileGroupKind = GitFileGroupKind;
  protected readonly lineKinds: typeof GitDiffRowKind = GitDiffRowKind;
  protected readonly tones: typeof GitFileTone = GitFileTone;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly open: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly wrapped: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly diffs: WritableSignal<ReadonlyMap<string, readonly GitDiffRow[]>> = signal(new Map<string, readonly GitDiffRow[]>());
  /** The lines chosen in each open file's diff, by the file's row key, as the diff numbers them. */
  protected readonly chosen: WritableSignal<ReadonlyMap<string, ReadonlySet<number>>> = signal(new Map<string, ReadonlySet<number>>());
  protected readonly showsAll: WritableSignal<boolean> = signal(false);
  protected readonly shownRows: Signal<readonly GitFileRow[]> = computed(() => {
    const rows: readonly GitFileRow[] = this.group().rows;
    return this.showsAll() || rows.length <= Resources.shownFilesMaximum ? rows : rows.slice(0, Resources.shownFilesMaximum - 1);
  });
  protected readonly closed: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly items: Signal<readonly GitFileItem[]> = computed(() => GitFileTree.itemsOf(this.shownRows(), this.state.fileLayout(), this.closed()));
  protected readonly hiddenCount: Signal<number> = computed(() => this.group().rows.length - this.shownRows().length);
  /** Each shown open diff's rows cut into colored runs, by its row's key: a closed diff, or one in a closed folder or past the shown files, isn't read. */
  protected readonly codes: Signal<ReadonlyMap<string, readonly (readonly GitCodeSpan[])[]>> = computed(() => {
    const open: ReadonlySet<string> = this.open();
    const diffs: ReadonlyMap<string, readonly GitDiffRow[]> = this.diffs();
    const codes: Map<string, readonly (readonly GitCodeSpan[])[]> = new Map<string, readonly (readonly GitCodeSpan[])[]>();
    for (const item of this.items()) {
      const rows: readonly GitDiffRow[] | undefined = Object.isNull(item.row) ? undefined : diffs.get(item.row.key);
      if (!Object.isNull(item.row) && !Object.isUndefined(rows) && open.has(item.row.key))
        codes.set(item.row.key, GitCodeSpan.rowsOf(rows, this.colors.tokenizerOf(item.row.path)));
    }
    return codes;
  });

  public readonly group: InputSignal<GitFileGroup> = input.required<GitFileGroup>();
  /** A Conflicts row's path, on its click or Enter, for its owner to open the conflict editor. */
  public readonly openConflict: OutputEmitterRef<string> = output<string>();

  public constructor() {
    inject(DestroyRef).onDestroy(FocusKeeper.keep(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement));
    effect(() => {
      this.state.status();
      const rows: readonly GitFileRow[] = this.group().rows;
      untracked(() => {
        for (const row of rows)
          if (this.open().has(row.key))
            this.load(row);
      });
    });
  }

  protected toggle(row: GitFileRow): void {
    this.open.update(t => GitFileGroupComponent.toggled(t, row.key));
    if (this.open().has(row.key))
      this.load(row);
  }

  /** A line's start inset in rem past the top level: its folder's icon, then a step per level; `null` at the top, which keeps its own. */
  protected insetOf(depth: number): number | null {
    return depth === 0 ? null : Resources.rowStartRem + depth * Resources.groupFileStepRem;
  }

  protected toggleFolder(folder: string): void {
    this.closed.update(t => GitFileGroupComponent.toggled(t, folder));
  }

  protected toggleWrap(row: GitFileRow): void {
    this.wrapped.update(t => GitFileGroupComponent.toggled(t, row.key));
  }

  protected rowsOf(row: GitFileRow): readonly GitDiffRow[] {
    return this.diffs().get(row.key) ?? [new GitDiffRow(GitDiffRowKind.Meta, Resources.loadingDiff)];
  }

  /** The open diff's rows cut into colored runs, or each row plain while its diff loads. */
  protected codesOf(row: GitFileRow): readonly (readonly GitCodeSpan[])[] {
    return this.codes().get(row.key) ?? GitCodeSpan.rowsOf(this.rowsOf(row), null);
  }

  protected chosenOf(row: GitFileRow): ReadonlySet<number> {
    return this.chosen().get(row.key) ?? GitFileGroupComponent.NONE;
  }

  protected choose(row: GitFileRow, line: number): void {
    this.chosen.update(t => new Map([...t, [row.key, GitFileGroupComponent.toggled(this.chosenOf(row), line)]]));
  }

  /** A hunk's chosen lines, or all its added and removed lines when none of them is chosen. */
  protected linesOf(row: GitFileRow, hunk: GitDiffRow): readonly number[] {
    const chosen: ReadonlySet<number> = this.chosenOf(row);
    const lines: readonly number[] = hunk.hunk.filter(t => chosen.has(t));
    return lines.length === 0 ? hunk.hunk : lines;
  }

  protected hunkLabelOf(row: GitFileRow, hunk: GitDiffRow): string {
    const staged: boolean = row.group === GitFileGroupKind.Staged;
    const count: number = hunk.hunk.filter(t => this.chosenOf(row).has(t)).length;
    if (count === 0)
      return staged ? Resources.unstageHunkLabel : Resources.stageHunkLabel;
    return staged ? Resources.formatUnstageLines(count) : Resources.formatStageLines(count);
  }

  protected stageLines(row: GitFileRow, lines: readonly number[]): void {
    void this.state.stageLinesAsync(row.path, lines, row.group === GitFileGroupKind.Staged);
  }

  protected moveAll(): void {
    const paths: readonly string[] = this.group().rows.map(t => t.path);
    void (this.group().kind === GitFileGroupKind.Staged ? this.state.unstageAsync(paths) : this.state.stageAsync(paths));
  }

  protected move(row: GitFileRow): void {
    void (row.group === GitFileGroupKind.Staged ? this.state.unstageAsync([row.path]) : this.state.stageAsync([row.path]));
  }

  /** Asks before a Changes row's working-folder changes are discarded, then discards them on Discard. */
  protected async discardAsync(row: GitFileRow): Promise<void> {
    const undoable: boolean = await this.state.canUndoDiscardAsync();
    const dialog = this.dialogs.open(GitDiscardDialogComponent, ".cancel");
    dialog.componentRef?.setInput("path", row.path);
    dialog.componentRef?.setInput("untracked", row.tone === GitFileTone.Untracked);
    dialog.componentRef?.setInput("undoable", undoable);
    dialog.componentInstance?.answered.subscribe(isDiscarded => {
      dialog.close();
      if (isDiscarded)
        void this.state.discardAsync([row.path]);
    });
  }

  private load(row: GitFileRow): void {
    this.loadAsync(row).catch((error: unknown) => this.errors.handleError(error));
  }

  private async loadAsync(row: GitFileRow): Promise<void> {
    const request: number = (this.requests.get(row.key) ?? 0) + 1;
    this.requests.set(row.key, request);
    let rows: readonly GitDiffRow[];
    try {
      const diff: GitDiff = await this.state.diffAsync(row.scope);
      const file: DiffFile | undefined = diff.files.find(t => t.path === row.path);
      rows = GitDiffRow.rowsOf(file ?? null);
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      rows = [new GitDiffRow(GitDiffRowKind.Meta, GitViewStateService.messageOf(error))];
    }
    if (this.requests.get(row.key) !== request)
      return;
    this.diffs.update(t => new Map([...t, [row.key, rows]]));
    this.chosen.update(t => new Map([...t].filter(([key]) => key !== row.key)));
  }

  private static toggled<T>(current: ReadonlySet<T>, key: T): ReadonlySet<T> {
    const next: Set<T> = new Set(current);
    if (!next.delete(key))
      next.add(key);
    return next;
  }
}

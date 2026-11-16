/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, computed, effect, ErrorHandler, inject, input, type InputSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import type { DiffFile, GitDiff } from "@noldova/git.protocol";
import { FileBadgeComponent, IconButtonComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { GitDiffRowKind } from "../../enums/git-diff-row-kind.ts";
import { GitFileGroupKind } from "../../enums/git-file-group-kind.ts";
import { GitFileTone } from "../../enums/git-file-tone.ts";
import { GitDiffRow } from "../../models/git-diff-row.ts";
import type { GitFileGroup } from "../../models/git-file-group.ts";
import type { GitFileRow } from "../../models/git-file-row.ts";
import { Resources } from "../../../resources.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

@Component({
  selector: "nol-git-file-group",
  imports: [FileBadgeComponent, IconButtonComponent, NgTemplateOutlet, TooltipDirective],
  templateUrl: "./git-file-group.component.html",
  styleUrl: "./git-file-group.component.css"
})
export class GitFileGroupComponent {
  private readonly requests: Map<string, number> = new Map();
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof GitFileGroupKind = GitFileGroupKind;
  protected readonly lineKinds: typeof GitDiffRowKind = GitDiffRowKind;
  protected readonly tones: typeof GitFileTone = GitFileTone;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly open: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly wrapped: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  protected readonly diffs: WritableSignal<ReadonlyMap<string, readonly GitDiffRow[]>> = signal(new Map<string, readonly GitDiffRow[]>());
  protected readonly showsAll: WritableSignal<boolean> = signal(false);
  protected readonly shownRows: Signal<readonly GitFileRow[]> = computed(() => {
    const rows: readonly GitFileRow[] = this.group().rows;
    return this.showsAll() || rows.length <= Resources.shownFilesMaximum ? rows : rows.slice(0, Resources.shownFilesMaximum - 1);
  });
  protected readonly hiddenCount: Signal<number> = computed(() => this.group().rows.length - this.shownRows().length);

  public readonly group: InputSignal<GitFileGroup> = input.required<GitFileGroup>();

  public constructor() {
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

  protected toggleWrap(row: GitFileRow): void {
    this.wrapped.update(t => GitFileGroupComponent.toggled(t, row.key));
  }

  protected rowsOf(row: GitFileRow): readonly GitDiffRow[] {
    return this.diffs().get(row.key) ?? [new GitDiffRow(GitDiffRowKind.Meta, Resources.loadingDiff)];
  }

  protected moveAll(): void {
    const paths: readonly string[] = this.group().rows.map(t => t.path);
    void (this.group().kind === GitFileGroupKind.Staged ? this.state.unstageAsync(paths) : this.state.stageAsync(paths));
  }

  protected move(row: GitFileRow): void {
    void (row.group === GitFileGroupKind.Staged ? this.state.unstageAsync([row.path]) : this.state.stageAsync([row.path]));
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
  }

  private static toggled(current: ReadonlySet<string>, key: string): ReadonlySet<string> {
    const next: Set<string> = new Set(current);
    if (!next.delete(key))
      next.add(key);
    return next;
  }
}

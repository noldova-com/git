/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterNextRender, Component, computed, effect, ElementRef, ErrorHandler, inject, Injector, input, type InputSignal, signal, type Signal, untracked, type WritableSignal
} from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { type DiffFile, type DiffScope, DiffTotals, type GitDiff, LineKind } from "@noldova/git.protocol";
import { FileBadgeComponent } from "@noldova/ui.components.angular";

import { GitDiffRowKind } from "../../enums/git-diff-row-kind.ts";
import { GitFileLayout } from "../../enums/git-file-layout.ts";
import type { GitCommitFileRow } from "../../models/git-commit-file-row.ts";
import { GitCodeSpan } from "../../models/git-code-span.ts";
import { GitDiffRow } from "../../models/git-diff-row.ts";
import { GitCodeColors } from "../../services/git-code-colors.ts";
import { GitCommitFiles } from "../../services/git-commit-files.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { Resources } from "../../../resources.ts";
import { GitFileLayoutButtonComponent } from "../git-file-layout-button/git-file-layout-button.component.ts";
import { GitMarkedLine } from "../../models/git-marked-line.ts";

@Component({
  selector: "nol-git-diff-files",
  imports: [FileBadgeComponent, GitFileLayoutButtonComponent],
  templateUrl: "./git-diff-files.component.html",
  styleUrl: "./git-diff-files.component.css"
})
export class GitDiffFilesComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly colors: GitCodeColors = inject(GitCodeColors);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly state: GitViewStateService | null = inject(GitViewStateService, { optional: true });
  private reading: number = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly lineKinds: typeof GitDiffRowKind = GitDiffRowKind;
  protected readonly chosen: Signal<WritableSignal<GitFileLayout> | null> = computed(() => this.layout() ?? this.state?.fileLayout ?? null);
  protected readonly diff: WritableSignal<GitDiff | null> = signal<GitDiff | null>(null);
  private readonly files: WritableSignal<readonly DiffFile[]> = signal<readonly DiffFile[]>([]);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly closed: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  protected readonly open: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  protected readonly rows: Signal<readonly GitCommitFileRow[]> = computed(() => GitCommitFiles.rowsOf(this.files(), this.chosen()?.() ?? GitFileLayout.Folders, this.closed()));
  protected readonly totals: Signal<DiffTotals> = computed(() => {
    const whole: DiffTotals | null = this.diff()?.totals ?? null;
    if (!Object.isNull(whole))
      return whole;
    const { added, removed } = GitCommitFiles.totalsOf(this.files());
    return new DiffTotals(this.files().length, added, removed);
  });
  protected readonly marked: WritableSignal<GitMarkedLine | null> = signal<GitMarkedLine | null>(null);
  protected readonly openLines: Signal<ReadonlyMap<string, readonly GitDiffRow[]>> = computed(() =>
    new Map(this.files().filter(t => this.open().has(t.path)).map(t => [t.path, GitDiffRow.rowsOf(t)])));
  protected readonly openCodes: Signal<ReadonlyMap<string, readonly (readonly GitCodeSpan[])[]>> = computed(() => {
    const lines: ReadonlyMap<string, readonly GitDiffRow[]> = this.openLines();
    const codes: Map<string, readonly (readonly GitCodeSpan[])[]> = new Map<string, readonly (readonly GitCodeSpan[])[]>();
    for (const row of this.rows()) {
      const rows: readonly GitDiffRow[] | undefined = lines.get(row.key);
      if (!row.isFolder && !Object.isUndefined(rows))
        codes.set(row.key, GitCodeSpan.rowsOf(rows, this.colors.tokenizerOf(row.key), this.colors.tokenTypes));
    }
    return codes;
  });

  public readonly isRead: Signal<boolean> = computed(() => !Object.isNull(this.diff()) || !Object.isNull(this.failure()));

  public readonly folder: InputSignal<string> = input.required<string>();

  public readonly scope: InputSignal<DiffScope> = input.required<DiffScope>();

  public readonly layout: InputSignal<WritableSignal<GitFileLayout> | null> = input<WritableSignal<GitFileLayout> | null>(null);

  public constructor() {
    effect(() => {
      const folder: string = this.folder();
      const scope: DiffScope = this.scope();
      untracked(() => {
        void this.readAsync(folder, scope);
      });
    });
  }

  protected insetOf(depth: number): number | null {
    return depth === 0 ? null : Resources.filledRowStartRem + depth * Resources.commitFileStepRem;
  }

  protected diffInsetOf(depth: number): number | null {
    return depth === 0 ? null : depth * Resources.commitFileStepRem;
  }

  protected nameOf(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1);
  }

  protected titleOf(row: GitCommitFileRow): string {
    return row.from.length > 0 ? `${row.key}${Resources.formatMovedFrom(row.from)}` : row.key;
  }

  protected toggle(folder: string): void {
    const closed: Set<string> = new Set(this.closed());
    if (!closed.delete(folder))
      closed.add(folder);
    this.closed.set(closed);
  }

  public holds(path: string): boolean {
    return this.files().some(t => t.path === path);
  }

  public reveal(path: string, line: number | null = null): void {
    const parts: readonly string[] = path.split(Resources.slash);
    const folders: ReadonlySet<string> = new Set(parts.slice(1).map((_, i) => parts.slice(0, i + 1).join(Resources.slash)));
    this.closed.set(new Set([...this.closed()].filter(t => !folders.has(t))));
    this.open.set(new Set([...this.open(), path]));
    const file: DiffFile | undefined = this.files().find(t => t.path === path);
    const index: number = Object.isNull(line) || Object.isUndefined(file) ? -1 : GitDiffFilesComponent.rowIndexOf(file, line);
    this.marked.set(index < 0 ? null : new GitMarkedLine(path, index));
    afterNextRender(() => {
      const marked: HTMLElement | null = this.host.querySelector<HTMLElement>(".marked-line");
      if (!Object.isNull(marked)) {
        marked.scrollIntoView({ block: "center" });
        return;
      }
      for (const row of this.host.querySelectorAll<HTMLElement>(".file-row:not(.folder)"))
        if (row.title === path)
          row.scrollIntoView({ block: "nearest" });
    }, { injector: this.injector });
  }

  protected isMarked(path: string, index: number): boolean {
    return this.marked()?.isAt(path, index) ?? false;
  }

  private static rowIndexOf(file: DiffFile, line: number): number {
    let index: number = 0;
    for (const hunk of file.hunks) {
      index++;
      const at: number = hunk.lines.findIndex(t => t.kind !== LineKind.Removed && t.newNumber === line);
      if (at >= 0)
        return index + at;
      index += hunk.lines.length;
    }
    return -1;
  }

  protected toggleFile(path: string): void {
    const open: Set<string> = new Set(this.open());
    if (!open.delete(path))
      open.add(path);
    this.open.set(open);
  }

  private async readAsync(folder: string, scope: DiffScope): Promise<void> {
    const reading: number = ++this.reading;
    this.diff.set(null);
    this.files.set([]);
    this.failure.set(null);
    this.open.set(new Set());
    this.marked.set(null);
    try {
      const diff: GitDiff = await this.client.diffAsync(folder, scope);
      if (reading === this.reading) {
        this.diff.set(diff);
        this.files.set(diff.files);
      }
    }
    catch (error) {
      if (reading !== this.reading)
        return;
      if (!GitRuntimeClient.isFailure(error)) {
        this.errors.handleError(error);
        return;
      }
      this.failure.set(GitRuntimeClient.failureOf(error)?.message ?? Resources.historyFailed);
    }
  }
}

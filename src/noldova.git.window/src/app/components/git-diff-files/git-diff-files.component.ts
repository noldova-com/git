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
import { type DiffFile, type DiffScope, type DiffTotals, type GitDiff, LineKind } from "@noldova/git.protocol";
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

/**
 * The files a diff changes, read from the repository: a header with their count and lines added and removed, a folder tree or flat list, and each file's diff under
 * its row once opened. Inside the Git view it follows the view's file layout and offers its layout button; elsewhere it shows folders.
 */
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
  /** The layout the files follow and the layout button sets: the one given, else the Git view's; `null` for folders, with no button, outside both. */
  protected readonly chosen: Signal<WritableSignal<GitFileLayout> | null> = computed(() => this.layout() ?? this.state?.fileLayout ?? null);
  protected readonly diff: WritableSignal<GitDiff | null> = signal<GitDiff | null>(null);
  /** The read diff's files, none until it is read. */
  private readonly files: WritableSignal<readonly DiffFile[]> = signal<readonly DiffFile[]>([]);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly closed: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  /** The files whose diff shows under their row, by path. */
  protected readonly open: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  protected readonly rows: Signal<readonly GitCommitFileRow[]> = computed(() => GitCommitFiles.rowsOf(this.files(), this.chosen()?.() ?? GitFileLayout.Folders, this.closed()));
  /** The header's files and lines added and removed: the whole diff's when its budget cut it and Git counted it, else its files'. */
  protected readonly totals: Signal<readonly [number, number, number]> = computed(() => {
    const whole: DiffTotals | null = this.diff()?.totals ?? null;
    if (!Object.isNull(whole))
      return [whole.files, whole.added, whole.removed];
    const [added, removed] = GitCommitFiles.totalsOf(this.files());
    return [this.files().length, added, removed];
  });
  /** The line a reveal marked, by its file's path and its row in the file's diff lines. */
  protected readonly marked: WritableSignal<readonly [string, number] | null> = signal<readonly [string, number] | null>(null);
  /** The diff lines of each open file, by path. */
  protected readonly openLines: Signal<ReadonlyMap<string, readonly GitDiffRow[]>> = computed(() =>
    new Map(this.files().filter(t => this.open().has(t.path)).map(t => [t.path, GitDiffRow.rowsOf(t)])));
  /** Each shown open file's diff lines cut into colored runs, by path: a file in a closed folder isn't read. */
  protected readonly openCodes: Signal<ReadonlyMap<string, readonly (readonly GitCodeSpan[])[]>> = computed(() => {
    const lines: ReadonlyMap<string, readonly GitDiffRow[]> = this.openLines();
    const codes: Map<string, readonly (readonly GitCodeSpan[])[]> = new Map<string, readonly (readonly GitCodeSpan[])[]>();
    for (const row of this.rows()) {
      const rows: readonly GitDiffRow[] | undefined = lines.get(row.key);
      if (!row.isFolder && !Object.isUndefined(rows))
        codes.set(row.key, GitCodeSpan.rowsOf(rows, this.colors.tokenizerOf(row.key)));
    }
    return codes;
  });

  /** Whether the diff's read ended, with its files or a failure, so another part can tell whether it `holds` a file. */
  public readonly isRead: Signal<boolean> = computed(() => !Object.isNull(this.diff()) || !Object.isNull(this.failure()));

  /** The repository's folder, an absolute path. */
  public readonly folder: InputSignal<string> = input.required<string>();

  /** The changes to read, such as a range between two commits. */
  public readonly scope: InputSignal<DiffScope> = input.required<DiffScope>();

  /** The layout the files follow, such as a pull request page's own; `null` follows the Git view's. */
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

  /** A row's start inset in rem past the top level: its folder's icon, then a step per level; `null` at the top, which keeps its own. */
  protected insetOf(depth: number): number | null {
    return depth === 0 ? null : Resources.rowStartRem + depth * Resources.commitFileStepRem;
  }

  /** A path's file name, which a renamed file's row says it came from. */
  protected nameOf(path: string): string {
    return path.slice(path.lastIndexOf("/") + 1);
  }

  /** A file row's title: its path, and the whole path a renamed or copied file had before. */
  protected titleOf(row: GitCommitFileRow): string {
    return row.from.length > 0 ? `${row.key}${Resources.formatMovedFrom(row.from)}` : row.key;
  }

  protected toggle(folder: string): void {
    const closed: Set<string> = new Set(this.closed());
    if (!closed.delete(folder))
      closed.add(folder);
    this.closed.set(closed);
  }

  /** Whether the diff holds a file, so another part can open it with `reveal`. */
  public holds(path: string): boolean {
    return this.files().some(t => t.path === path);
  }

  /**
   * Opens a file's diff and the folders it is in, and scrolls its row into view once it shows; given a line of the file as the diff leaves it, it marks that line
   * and scrolls it into view instead, or the row when no hunk shows the line.
   */
  public reveal(path: string, line: number | null = null): void {
    const parts: readonly string[] = path.split(Resources.slash);
    const folders: ReadonlySet<string> = new Set(parts.slice(1).map((_, i) => parts.slice(0, i + 1).join(Resources.slash)));
    this.closed.set(new Set([...this.closed()].filter(t => !folders.has(t))));
    this.open.set(new Set([...this.open(), path]));
    const file: DiffFile | undefined = this.files().find(t => t.path === path);
    const index: number = Object.isNull(line) || Object.isUndefined(file) ? -1 : GitDiffFilesComponent.rowIndexOf(file, line);
    this.marked.set(index < 0 ? null : [path, index]);
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

  /** Whether a line of an open file's diff is the one a reveal marked. */
  protected isMarked(path: string, index: number): boolean {
    const marked: readonly [string, number] | null = this.marked();
    return !Object.isNull(marked) && marked[0] === path && marked[1] === index;
  }

  /** The row of a file's diff lines that shows a line of the file as the diff leaves it, counting each hunk's header row as the lines do; -1 when none does. */
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

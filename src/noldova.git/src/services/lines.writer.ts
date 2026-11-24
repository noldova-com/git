/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionRequest } from "@noldova/desktop.runtime";
import { FileChange, GitNames, type GitStatus, UndoMode, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { LinesRefusedException } from "../exceptions/lines-refused.exception.ts";
import type { IGitWrite } from "../interfaces/i-git-write.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import type { RepositoryFolders } from "../models/repository-folders.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";
import { DiffParser } from "./diff.parser.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { ProgramRunner } from "./program-runner.ts";

/** One hunk of the patch being made: its starts from git's header, the lines it keeps and whether a chosen change is among them. */
interface IPatchHunk {
  readonly oldStart: string;
  readonly newStart: string;
  readonly lines: Buffer[];
  oldCount: number;
  newCount: number;
  changes: boolean;
  kept: boolean;
}

/**
 * Stages chosen lines of one file's worktree changes, or unstages chosen lines of its staged ones, for the person's own click.
 * It reads the file's diff again as git's own bytes, keeps the chosen added and removed lines, turns the others into context or drops
 * them, and gives the patch to `git apply --cached`, reversed for unstaging, so the worktree stays as it is.
 * A line is named by its place in the diff, counting every hunk's lines in order from 0, as the Git view shows them.
 */
export class LinesWriter implements IGitWrite {
  private static readonly READ_LIMITS: ProgramLimits = new ProgramLimits(Resources.diffOutputBytes, Resources.gitReadMilliseconds);
  private static readonly WRITE_LIMITS: ProgramLimits = new ProgramLimits(Resources.writeOutputBytes, Resources.indexWriteMilliseconds);
  public readonly method: string;
  public readonly undo: UndoMode = UndoMode.Index;
  private readonly runner: ProgramRunner;
  private readonly filters: FilterOptionsReader;
  private readonly path: string;
  private readonly lines: ReadonlySet<number>;
  private readonly staged: boolean;

  public constructor(runner: ProgramRunner, filters: FilterOptionsReader, path: string, lines: readonly number[], staged: boolean) {
    this.runner = runner;
    this.filters = filters;
    this.path = path;
    this.lines = new Set(lines);
    this.staged = staged;
    this.method = staged ? GitNames.unstageLinesMethod : GitNames.stageLinesMethod;
  }

  public refuse(): void {}

  /** Never asks: only the person's own click makes one, and no agent tool offers it. */
  public async requestAsync(): Promise<IPermissionRequest | null> {
    return null;
  }

  public async runAsync(folders: RepositoryFolders, _status: GitStatus, signal?: AbortSignal): Promise<void> {
    const patch = this.patchOf(await this.readDiffAsync(folders.top, signal));
    const options = this.staged ? [...Resources.applyCachedArguments, Resources.reverseOption] : Resources.applyCachedArguments;
    const run = ProgramRun.writeGit(new GitArguments([...options, Resources.standardInput]), folders.top, folders.gitFolder, folders.commonGitFolder, LinesWriter.WRITE_LIMITS, signal);
    const result = await this.runner.runAsync(run.withInput(patch));
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.applyCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
  }

  private async readDiffAsync(top: string, signal?: AbortSignal): Promise<Buffer> {
    const filters = await this.filters.readAsync(top, signal);
    const options = this.staged ? [...Resources.trackedDiffArguments, Resources.cachedOption] : Resources.trackedDiffArguments;
    const read = ProgramRun.readGit(new GitArguments([...filters, ...options], [], [this.path]), top, LinesWriter.READ_LIMITS, signal);
    const result = await this.runner.runAsync(read);
    if (result.exit.code !== 0)
      throw new GitFailedException(Resources.diffCommand, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    const files = DiffParser.parse(result.output, result.isTruncated).files;
    const file = files[0];
    if (files.length !== 1 || file === undefined || file.change !== FileChange.Modified || file.binary || file.truncated || file.submodule !== null
      || file.pathBytes !== undefined || file.oldMode !== file.newMode)
      throw new LinesRefusedException(Resources.linesUnsupported);
    return result.output;
  }

  /** The patch of the chosen lines, from the diff's own bytes; refused when it would change nothing. */
  private patchOf(output: Buffer): Buffer {
    const body = output.subarray(output.indexOf(Resources.firstHunkMark, output.indexOf(Resources.patchStartMark)) + 1);
    const hunks: IPatchHunk[] = [];
    let index = 0;
    for (const line of LinesWriter.split(body)) {
      const header = Resources.hunkPattern.exec(line.toString(Resources.latin1Encoding));
      if (header === null)
        this.add(Required.at(hunks, hunks.length - 1, Resources.applyCommand, Resources.unknownLinePart), line, this.lines.has(index++));
      else
        hunks.push({
          oldStart: Required.at(header, 1, Resources.applyCommand, Resources.shortHunkPart), newStart: Required.at(header, 3, Resources.applyCommand, Resources.shortHunkPart),
          lines: [], oldCount: 0, newCount: 0, changes: false, kept: false
        });
    }
    const chosen = hunks.filter(t => t.changes);
    if (chosen.length === 0)
      throw new LinesRefusedException(Resources.linesNotChosen);
    const name = Buffer.from(this.path, Resources.utf8Encoding);
    const [oldName, newName] = [DiffParser.quote(Resources.oldPathPrefix, name), DiffParser.quote(Resources.newPathPrefix, name)];
    const end = Buffer.from(Resources.lineEnd);
    return Buffer.concat([
      Buffer.from(Resources.diffHeader), oldName, Buffer.from(Resources.wordSeparator), newName, end,
      Buffer.from(Resources.oldFileMark), oldName, end, Buffer.from(Resources.newFileMark), newName, end,
      ...chosen.flatMap(t => [Buffer.from(Resources.formatHunkHeader(t.oldStart, t.oldCount, t.newStart, t.newCount)), ...t.lines.flatMap(u => [u, end])])
    ]);
  }

  /**
   * Adds one diff line to the hunk: a chosen change stays, an added line not chosen is dropped when staging and becomes context when
   * unstaging, a removed one the other way round, and a "No newline at end of file" line follows the line before it.
   */
  private add(hunk: IPatchHunk, line: Buffer, isChosen: boolean): void {
    const mark = line[0];
    if (mark === Resources.backslashByte) {
      if (hunk.kept)
        hunk.lines.push(line);
      return;
    }
    const isChange = mark === Resources.addedByte || mark === Resources.removedByte;
    hunk.kept = !isChange || isChosen || (mark === Resources.addedByte) === this.staged;
    if (!hunk.kept)
      return;
    const shown = isChange && !isChosen ? Buffer.concat([Buffer.from(Resources.wordSeparator), line.subarray(1)]) : line;
    hunk.changes ||= isChange && isChosen;
    hunk.lines.push(shown);
    hunk.oldCount += Number(shown[0] !== Resources.addedByte);
    hunk.newCount += Number(shown[0] !== Resources.removedByte);
  }

  private static split(bytes: Buffer): Buffer[] {
    const lines: Buffer[] = [];
    let start = 0;
    for (let end = bytes.indexOf(Resources.lineEndByte); end >= 0; end = bytes.indexOf(Resources.lineEndByte, start)) {
      lines.push(bytes.subarray(start, end));
      start = end + 1;
    }
    return lines;
  }
}

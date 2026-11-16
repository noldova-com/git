/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffFile, DiffHunk, type DiffLine, GitDiff } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import type { ParsedDiff } from "./parsed-diff.ts";

export class DiffBudget {
  private readonly fileLimit: number;
  private readonly totalLimit: number;
  private readonly files: DiffFile[] = [];
  private totalBytes: number = 0;
  private omittedFiles: number = 0;
  private truncated: boolean = false;
  private full: boolean = false;

  public constructor(fileLimit: number, totalLimit: number) {
    this.fileLimit = fileLimit;
    this.totalLimit = totalLimit;
  }

  public get isFull(): boolean {
    return this.full;
  }

  public addParsed(parsed: ParsedDiff): void {
    for (const file of parsed.files)
      this.add(file);
    this.omit(parsed.omittedFiles);
    this.truncated = this.truncated || parsed.isCut;
  }

  public add(file: DiffFile): void {
    if (this.full) {
      this.omit(1);
      return;
    }
    const limit = Math.min(this.fileLimit, this.totalLimit - this.totalBytes);
    let used = 0;
    const fits = (bytes: number): boolean => {
      if (used + bytes > limit)
        return false;
      used += bytes;
      return true;
    };
    if (!fits(DiffBudget.sizeOf(DiffBudget.withHunks(file, [], false)))) {
      this.full = true;
      this.omit(1);
      return;
    }
    const hunks: DiffHunk[] = [];
    let isCut = false;
    for (const hunk of file.hunks) {
      if (!fits(DiffBudget.sizeOf(DiffBudget.withLines(hunk, [])) + Resources.diffSeparatorBytes)) {
        isCut = true;
        break;
      }
      const lines: DiffLine[] = [];
      for (const line of hunk.lines) {
        if (!fits(DiffBudget.sizeOf(line) + Resources.diffSeparatorBytes)) {
          isCut = true;
          break;
        }
        lines.push(line);
      }
      hunks.push(DiffBudget.withLines(hunk, lines));
      if (isCut)
        break;
    }
    this.files.push(isCut ? DiffBudget.withHunks(file, hunks, true) : file);
    this.totalBytes += used;
    if (isCut && limit < this.fileLimit) {
      this.full = true;
      this.truncated = true;
    }
  }

  public omit(count: number): void {
    if (count > 0) {
      this.omittedFiles += count;
      this.truncated = true;
    }
  }

  public toDiff(): GitDiff {
    return new GitDiff(this.files, this.totalBytes, this.omittedFiles, this.truncated);
  }

  private static sizeOf(value: { toJson(): unknown }): number {
    return Buffer.byteLength(JSON.stringify(value.toJson()));
  }

  private static withHunks(file: DiffFile, hunks: readonly DiffHunk[], truncated: boolean): DiffFile {
    return new DiffFile(file.path, file.pathBytes, file.oldPath, file.oldPathBytes, file.change, file.oldMode, file.newMode, file.binary, file.submodule, hunks, truncated);
  }

  private static withLines(hunk: DiffHunk, lines: readonly DiffLine[]): DiffHunk {
    return new DiffHunk(hunk.oldStart, hunk.oldCount, hunk.newStart, hunk.newCount, hunk.header, lines);
  }
}

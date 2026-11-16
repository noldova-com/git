/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffFile, DiffHunk, DiffLine, FileChange, LineKind, ProtocolException, SubmoduleChange } from "@noldova/git.protocol";

import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import type { IRawDiffEntry } from "../interfaces/i-raw-diff-entry.ts";
import { GitPath } from "../models/git-path.ts";
import { ParsedDiff } from "../models/parsed-diff.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";

export class DiffParser {
  private static readonly MOVED: readonly FileChange[] = [FileChange.Renamed, FileChange.Copied];
  private static readonly WITH_OLD_NUMBER: readonly LineKind[] = [LineKind.Context, LineKind.Removed];
  private static readonly WITH_NEW_NUMBER: readonly LineKind[] = [LineKind.Context, LineKind.Added];
  private static readonly COMBINED_HEADERS: readonly Buffer[] = Resources.combinedDiffHeaders.map(t => Buffer.from(t));

  public static parse(output: Buffer, isCut: boolean): ParsedDiff {
    try {
      const [entries, patch] = DiffParser.readEntries(output, isCut);
      const patched = entries.filter(t => !t.isCombined);
      const sections = DiffParser.findSections(patch, patched, isCut);
      const files: DiffFile[] = [];
      let index = 0;
      for (const entry of entries) {
        if (entry.isCombined)
          files.push(DiffParser.readFile(entry, Buffer.alloc(0), false));
        else if (index < sections.length) {
          files.push(DiffParser.readFile(entry, Required.at(sections, index, Resources.diffCommand, Resources.missingPatchPart), isCut && index === sections.length - 1));
          index++;
        }
      }
      return new ParsedDiff(files, patched.length - sections.length, isCut);
    } catch (error) {
      if (error instanceof ProtocolException)
        throw DiffParser.unreadable(Resources.refusedValuesPart, error);
      throw error;
    }
  }

  private static readEntries(output: Buffer, isCut: boolean): [IRawDiffEntry[], Buffer] {
    const entries: IRawDiffEntry[] = [];
    let start = 0;
    while (output[start] === Resources.colonByte) {
      const [fields, pathsStart] = DiffParser.readToken(output, start);
      if (fields === null)
        return DiffParser.incomplete(entries, isCut);
      const text = fields.toString(Resources.latin1Encoding);
      const entry = text.startsWith(Resources.combinedEntryPrefix) ? DiffParser.readCombined(text) : DiffParser.readRaw(text);
      const paths: Buffer[] = [];
      start = pathsStart;
      while (paths.length < (DiffParser.MOVED.includes(entry.change) ? 2 : 1)) {
        const [path, next] = DiffParser.readToken(output, start);
        if (path === null)
          return DiffParser.incomplete(entries, isCut);
        paths.push(path);
        start = next;
      }
      entries.push({ ...entry, oldPath: Required.at(paths, 0, Resources.diffCommand, Resources.incompleteEntryPart), path: Required.at(paths, paths.length - 1, Resources.diffCommand, Resources.incompleteEntryPart) });
    }
    if (start === output.length)
      return [entries, Buffer.alloc(0)];
    if (output[start] !== Resources.nulByte)
      throw DiffParser.unreadable(Resources.unknownEntryPart);
    return [entries, output.subarray(start + 1)];
  }

  private static readToken(output: Buffer, start: number): [Buffer | null, number] {
    const end = output.indexOf(Resources.nulByte, start);
    return end < 0 ? [null, output.length] : [output.subarray(start, end), end + 1];
  }

  private static incomplete(entries: IRawDiffEntry[], isCut: boolean): [IRawDiffEntry[], Buffer] {
    if (!isCut)
      throw DiffParser.unreadable(Resources.incompleteEntryPart);
    return [entries, Buffer.alloc(0)];
  }

  private static readRaw(fields: string): Omit<IRawDiffEntry, "oldPath" | "path"> {
    const match = Resources.rawEntryPattern.exec(fields);
    if (match === null)
      throw DiffParser.unreadable(Resources.unknownEntryPart);
    const change = Resources.diffChanges.get(Required.at(match, 5, Resources.diffCommand, Resources.unknownEntryPart));
    if (change === undefined)
      throw DiffParser.unreadable(Resources.unknownChangePart);
    return {
      isCombined: false,
      change,
      oldMode: DiffParser.readMode(Required.at(match, 1, Resources.diffCommand, Resources.unknownEntryPart)),
      newMode: DiffParser.readMode(Required.at(match, 2, Resources.diffCommand, Resources.unknownEntryPart)),
      oldId: DiffParser.readId(Required.at(match, 3, Resources.diffCommand, Resources.unknownEntryPart)),
      newId: DiffParser.readId(Required.at(match, 4, Resources.diffCommand, Resources.unknownEntryPart))
    };
  }

  private static readCombined(fields: string): Omit<IRawDiffEntry, "oldPath" | "path"> {
    const match = Resources.combinedEntryPattern.exec(fields);
    if (match === null)
      throw DiffParser.unreadable(Resources.unknownEntryPart);
    return {
      isCombined: true,
      change: FileChange.Conflict,
      oldMode: DiffParser.readMode(Required.at(match, 1, Resources.diffCommand, Resources.unknownEntryPart)),
      newMode: DiffParser.readMode(Required.at(match, 2, Resources.diffCommand, Resources.unknownEntryPart)),
      oldId: null,
      newId: null
    };
  }

  private static readMode(mode: string): string | null {
    return mode === Resources.noMode ? null : mode;
  }

  private static readId(id: string): string | null {
    return Resources.zeroIdPattern.test(id) ? null : id;
  }

  private static findSections(patch: Buffer, entries: readonly IRawDiffEntry[], isCut: boolean): Buffer[] {
    const starts: number[] = [];
    for (const entry of entries) {
      const start = DiffParser.findLine(patch, DiffParser.header(entry), (starts.at(-1) ?? -1) + 1);
      if (start < 0)
        break;
      starts.push(start);
    }
    if (entries.length === 1 && starts.length === 0)
      starts.push(0);
    if (starts.length < entries.length && !isCut)
      throw DiffParser.unreadable(Resources.missingPatchPart);
    return starts.map((start, index) => patch.subarray(start, DiffParser.findEnd(patch, start, starts[index + 1] ?? patch.length)));
  }

  private static findEnd(patch: Buffer, start: number, next: number): number {
    const combined = DiffParser.COMBINED_HEADERS.map(t => DiffParser.findLine(patch, t, start + 1)).filter(t => t >= 0 && t < next);
    return Math.min(next, ...combined);
  }

  private static findLine(buffer: Buffer, line: Buffer, from: number): number {
    let at = buffer.indexOf(line, from);
    while (at > 0 && buffer[at - 1] !== Resources.lineEndByte)
      at = buffer.indexOf(line, at + 1);
    return at;
  }

  private static header(entry: IRawDiffEntry): Buffer {
    if (entry.change === FileChange.Conflict)
      return Buffer.concat([Buffer.from(Resources.unmergedHeader), entry.path, Buffer.from(Resources.lineEnd)]);
    return Buffer.concat([
      Buffer.from(Resources.diffHeader),
      DiffParser.quote(Resources.oldPathPrefix, entry.oldPath),
      Buffer.from(Resources.wordSeparator),
      DiffParser.quote(Resources.newPathPrefix, entry.path),
      Buffer.from(Resources.lineEnd)
    ]);
  }

  private static quote(prefix: string, path: Buffer): Buffer {
    const name = Buffer.concat([Buffer.from(prefix), path]);
    if (!name.some(t => DiffParser.isUnprintable(t) || Resources.cEscapes.has(t)))
      return name;
    return Buffer.from(Resources.formatQuoted([...name].map(t => DiffParser.escape(t)).join("")), Resources.latin1Encoding);
  }

  private static escape(byte: number): string {
    const letter = Resources.cEscapes.get(byte);
    if (letter !== undefined)
      return Resources.formatEscape(letter);
    return DiffParser.isUnprintable(byte) ? Resources.formatOctalEscape(byte) : String.fromCharCode(byte);
  }

  private static isUnprintable(byte: number): boolean {
    return byte < Resources.spaceByte || byte >= Resources.deleteByte;
  }

  private static readFile(entry: IRawDiffEntry, section: Buffer, isCut: boolean): DiffFile {
    const path = GitPath.fromBytes(entry.path);
    const oldPath = GitPath.fromBytes(entry.oldPath);
    const lines = DiffParser.splitLines(section);
    const binary = lines.some(t => t.toString(Resources.latin1Encoding, 0, Resources.binaryFilesPrefix.length) === Resources.binaryFilesPrefix);
    const hunks = binary ? [] : DiffParser.readHunks(lines, isCut);
    if (entry.oldMode !== Resources.submoduleMode && entry.newMode !== Resources.submoduleMode)
      return new DiffFile(path.text, path.bytes, oldPath.text, oldPath.bytes, entry.change, entry.oldMode, entry.newMode, binary, null, hunks, isCut);
    const submodule = new SubmoduleChange(DiffParser.readCommit(hunks, LineKind.Removed, entry.oldId), DiffParser.readCommit(hunks, LineKind.Added, entry.newId));
    return new DiffFile(path.text, path.bytes, oldPath.text, oldPath.bytes, entry.change, entry.oldMode, entry.newMode, false, submodule, [], isCut);
  }

  private static splitLines(section: Buffer): Buffer[] {
    const lines: Buffer[] = [];
    let start = 0;
    for (let end = section.indexOf(Resources.lineEndByte); end >= 0; end = section.indexOf(Resources.lineEndByte, start)) {
      lines.push(section.subarray(start, end));
      start = end + 1;
    }
    return lines;
  }

  private static readHunks(lines: readonly Buffer[], isCut: boolean): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let index = 0;
    while (index < lines.length) {
      const match = Resources.hunkPattern.exec(DiffParser.lineAt(lines, index++).toString(Resources.utf8Encoding));
      if (match === null)
        continue;
      const oldStart = Number(match[1]);
      const oldCount = Number(match[2] ?? Resources.defaultHunkCount);
      const newStart = Number(match[3]);
      const newCount = Number(match[4] ?? Resources.defaultHunkCount);
      let [oldNumber, newNumber, oldLeft, newLeft] = [oldStart, newStart, oldCount, newCount];
      const body: DiffLine[] = [];
      while (index < lines.length && (oldLeft > 0 || newLeft > 0 || DiffParser.lineAt(lines, index)[0] === Resources.backslashByte)) {
        const line = DiffParser.lineAt(lines, index++);
        const kind = Resources.lineKindBytes.get(Required.at(line, 0, Resources.diffCommand, Resources.unknownLinePart));
        if (kind === undefined)
          throw DiffParser.unreadable(Resources.unknownLinePart);
        const hasOld = DiffParser.WITH_OLD_NUMBER.includes(kind);
        const hasNew = DiffParser.WITH_NEW_NUMBER.includes(kind);
        body.push(new DiffLine(kind, hasOld ? oldNumber++ : null, hasNew ? newNumber++ : null, kind === LineKind.NoNewlineAtEnd ? "" : line.toString(Resources.utf8Encoding, 1)));
        oldLeft -= Number(hasOld);
        newLeft -= Number(hasNew);
      }
      if ((oldLeft > 0 || newLeft > 0) && !isCut)
        throw DiffParser.unreadable(Resources.shortHunkPart);
      hunks.push(new DiffHunk(oldStart, oldCount, newStart, newCount, Required.at(match, 5, Resources.diffCommand, Resources.shortHunkPart), body));
    }
    return hunks;
  }

  private static readCommit(hunks: readonly DiffHunk[], kind: LineKind, fallback: string | null): string | null {
    const text = hunks.flatMap(t => t.lines).find(t => t.kind === kind)?.text ?? "";
    return Resources.subprojectPattern.exec(text)?.[1] ?? fallback;
  }

  private static lineAt(lines: readonly Buffer[], index: number): Buffer {
    return Required.at(lines, index, Resources.diffCommand, Resources.shortHunkPart);
  }

  private static unreadable(part: string, cause?: unknown): UnreadableOutputException {
    return new UnreadableOutputException(Resources.diffCommand, part, cause);
  }
}

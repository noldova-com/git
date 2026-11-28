/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FileState, ProtocolException, StatusEntry, StatusUpstream, SubmoduleStatus } from "@noldova/git.protocol";

import { UnreadableOutputException } from "../exceptions/unreadable-output.exception.ts";
import { AheadBehind } from "../models/ahead-behind.ts";
import { GitPath } from "../models/git-path.ts";
import { ParsedStatus } from "../models/parsed-status.ts";
import { Required } from "../models/required.ts";
import { Resources } from "../resources.ts";

export class StatusParser {
  public static parse(output: Buffer, isCut: boolean, limit: number): ParsedStatus {
    const records = StatusParser.split(isCut ? output.subarray(0, output.lastIndexOf(Resources.nulByte) + 1) : output);
    let head: string | null = null;
    let branch: string | null = null;
    let upstream: string | null = null;
    let aheadBehind: AheadBehind | null = null;
    const entries: StatusEntry[] = [];
    let truncated = isCut;
    try {
      for (let index = 0; index < records.length; index++) {
        const record = Required.at(records, index, Resources.statusCommand, Resources.unknownKindPart);
        if (record.toString(Resources.latin1Encoding, 0, 1) === Resources.statusHeader) {
          const [, key, ...rest] = record.toString(Resources.utf8Encoding).split(Resources.wordSeparator);
          const value = rest.join(Resources.wordSeparator);
          if (key === Resources.oidHeader)
            head = value === Resources.initialHead ? null : value;
          else if (key === Resources.headHeader)
            branch = value === Resources.detachedHead ? null : value;
          else if (key === Resources.upstreamHeader)
            upstream = value;
          else if (key === Resources.aheadBehindHeader)
            aheadBehind = StatusParser.readAheadBehind(value);
          continue;
        }
        if (entries.length === limit) {
          truncated = true;
          break;
        }
        const isRenamed = record.toString(Resources.latin1Encoding, 0, 1) === Resources.renamedEntryKind;
        if (isRenamed && index + 1 === records.length) {
          if (isCut)
            break;
          throw StatusParser.unreadable(Resources.missingOriginalPart);
        }
        entries.push(StatusParser.readEntry(record, isRenamed ? Required.at(records, ++index, Resources.statusCommand, Resources.missingOriginalPart) : null));
      }
      if ((!Object.isNull(head) && !Resources.objectIdPattern.test(head)) || branch === "")
        throw StatusParser.unreadable(Resources.statusRefusedValuesPart);
      const tracking = Object.isNull(upstream) ? null : new StatusUpstream(upstream, aheadBehind?.ahead ?? 0, aheadBehind?.behind ?? 0, Object.isNull(aheadBehind));
      return new ParsedStatus(branch, head, tracking, entries, truncated);
    } catch (error) {
      if (error instanceof ProtocolException)
        throw StatusParser.unreadable(Resources.statusRefusedValuesPart, error);
      throw error;
    }
  }

  private static split(output: Buffer): Buffer[] {
    const records: Buffer[] = [];
    let start = 0;
    while (start < output.length) {
      const end = output.indexOf(Resources.nulByte, start);
      records.push(output.subarray(start, end < 0 ? output.length : end));
      start = end < 0 ? output.length : end + 1;
    }
    return records;
  }

  private static readAheadBehind(value: string): AheadBehind {
    const match = Resources.aheadBehindValuePattern.exec(value);
    if (Object.isNull(match))
      throw StatusParser.unreadable(Resources.aheadBehindCountsPart);
    return new AheadBehind(Number(match[1]), Number(match[2]));
  }

  private static readEntry(record: Buffer, original: Buffer | null): StatusEntry {
    const kind = record.toString(Resources.latin1Encoding, 0, 1);
    const count = Resources.statusFieldCounts.get(kind);
    if (Object.isUndefined(count))
      throw StatusParser.unreadable(Resources.unknownKindPart);
    const start = StatusParser.pathStart(record, count);
    const fields = record.toString(Resources.latin1Encoding, 0, start - 1).split(Resources.wordSeparator);
    const path = GitPath.fromBytes(record.subarray(start));
    const originalPath = Object.isNull(original) ? null : GitPath.fromBytes(original);
    if (kind === Resources.untrackedEntryKind || kind === Resources.ignoredEntryKind) {
      const state = kind === Resources.untrackedEntryKind ? FileState.Untracked : FileState.Ignored;
      return new StatusEntry(path.text, path.bytes, null, undefined, state, state, null, null, null, null);
    }
    const states = Required.at(fields, 1, Resources.statusCommand, Resources.unknownStatePart);
    const submoduleStatus = StatusParser.readSubmodule(Required.at(fields, 2, Resources.statusCommand, Resources.unknownSubmodulePart));
    if (kind === Resources.unmergedEntryKind) {
      const conflict = Resources.conflictKinds.get(states);
      if (Object.isUndefined(conflict))
        throw StatusParser.unreadable(Resources.unknownConflictPart);
      return new StatusEntry(path.text, path.bytes, null, undefined, FileState.Unmodified, FileState.Unmodified, conflict, submoduleStatus, null, null);
    }
    const index = Resources.statusStates.get(states.charAt(0));
    const worktree = Resources.statusStates.get(states.charAt(1));
    if (Object.isUndefined(index) || Object.isUndefined(worktree))
      throw StatusParser.unreadable(Resources.unknownStatePart);
    return new StatusEntry(path.text, path.bytes, originalPath?.text ?? null, originalPath?.bytes, index, worktree, null, submoduleStatus, null, null);
  }

  private static pathStart(record: Buffer, count: number): number {
    let start = 0;
    for (let field = 0; field < count; field++) {
      const space = record.indexOf(Resources.wordSeparator, start);
      if (space < 0)
        throw StatusParser.unreadable(Resources.incompleteEntryPart);
      start = space + 1;
    }
    return start;
  }

  private static readSubmodule(value: string): SubmoduleStatus | null {
    if (value === Resources.notSubmodule)
      return null;
    const match = Resources.submodulePattern.exec(value);
    if (Object.isNull(match))
      throw StatusParser.unreadable(Resources.unknownSubmodulePart);
    return new SubmoduleStatus(match[1] === Resources.submoduleCommitChanged, match[2] === Resources.submoduleModified, match[3] === Resources.submoduleUntracked);
  }

  private static unreadable(part: string, cause?: unknown): UnreadableOutputException {
    return new UnreadableOutputException(Resources.statusCommand, part, cause);
  }
}

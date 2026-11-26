/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createHash } from "node:crypto";
import { type BigIntStats, createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import path from "node:path";

import { FileState, StatusEntry, UntrustedSource } from "@noldova/git.protocol";

import { GitFailedException } from "../exceptions/git-failed.exception.ts";
import { GitArguments } from "../models/git-arguments.ts";
import { HashBudget } from "../models/hash-budget.ts";
import { IndexBlob } from "../models/index-blob.ts";
import { LfsCheck } from "../models/lfs-check.ts";
import { LfsPointer } from "../models/lfs-pointer.ts";
import { ProgramLimits } from "../models/program-limits.ts";
import { ProgramRun } from "../models/program-run.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";
import type { ProgramRunner } from "./program-runner.ts";

export class LfsPointerReader {
  private static readonly LIMITS: ProgramLimits = new ProgramLimits(Resources.listOutputBytes, Resources.gitReadMilliseconds);
  private static readonly ATTRIBUTES: GitArguments = new GitArguments(Resources.lfsAttributeArguments);
  private static readonly INDEX: GitArguments = new GitArguments(Resources.lfsIndexArguments);
  private static readonly BLOBS: GitArguments = new GitArguments(Resources.lfsBlobsArguments);
  private readonly runner: ProgramRunner;
  private readonly pointers: Map<string, LfsPointer | null> = new Map();
  private readonly answers: Map<string, boolean> = new Map();

  public constructor(runner: ProgramRunner) {
    this.runner = runner;
  }

  public async cleanAsync(top: string, entries: readonly StatusEntry[], signal?: AbortSignal): Promise<LfsCheck> {
    const candidates = entries.filter(t => t.worktree === FileState.Modified && t.conflict === null && t.submodule === null && t.pathBytes === undefined)
      .map(t => t.path);
    if (candidates.length === 0)
      return new LfsCheck([...entries], 0);
    const tracked = await this.trackedAsync(top, candidates, signal);
    if (tracked.length === 0)
      return new LfsCheck([...entries], 0);
    const named = tracked.filter(t => !t.includes(Resources.lineEnd));
    const blobs = await this.blobsAsync(top, named, signal);
    const unread = new Set([...blobs.values()].filter(t => t.size <= Resources.lfsPointerBytes && !this.pointers.has(t.id)).map(t => t.id));
    await this.readPointersAsync(top, [...unread], signal);
    const budget = new HashBudget(Resources.lfsHashBytes);
    const unchanged = new Set<string>();
    let unchecked = tracked.length - named.length;
    for (const [file, blob] of blobs) {
      const pointer = this.pointers.get(blob.id);
      if (pointer === undefined && blob.size <= Resources.lfsPointerBytes)
        unchecked++;
      if (pointer === undefined || pointer === null)
        continue;
      const matches = await this.matchesAsync(path.join(top, file), blob.id, pointer, budget, signal);
      if (matches === null)
        unchecked++;
      else if (matches)
        unchanged.add(file);
    }
    return new LfsCheck(entries.flatMap(entry => !unchanged.has(entry.path) ? [entry] : entry.index === FileState.Unmodified ? [] : [
      new StatusEntry(entry.path, entry.pathBytes, entry.originalPath, entry.originalPathBytes, entry.index, FileState.Unmodified, entry.conflict,
        entry.submodule, entry.indexCounts, null)
    ]), unchecked);
  }

  private async trackedAsync(top: string, files: readonly string[], signal?: AbortSignal): Promise<string[]> {
    const output = await this.runAsync(top, LfsPointerReader.ATTRIBUTES, LfsPointerReader.joined(files), Resources.checkAttrCommand, signal);
    const fields = LfsPointerReader.fields(output);
    const tracked: string[] = [];
    for (let index = 0; index + 2 < fields.length; index += 3) {
      const file = fields[index];
      if (file !== undefined && fields[index + 2] === Resources.lfsFilterName)
        tracked.push(file);
    }
    return tracked;
  }

  private async blobsAsync(top: string, files: readonly string[], signal?: AbortSignal): Promise<Map<string, IndexBlob>> {
    const names = LfsPointerReader.joined(files.map(t => Resources.indexEntryPrefix + t));
    const lines = (await this.runAsync(top, LfsPointerReader.INDEX, names, Resources.catFileCommand, signal)).toString(Resources.utf8Encoding).split(Resources.lineEnd);
    const blobs = new Map<string, IndexBlob>();
    files.forEach((file, index) => {
      const match = Resources.indexRecordPattern.exec(lines[index] ?? "");
      if (match?.[1] !== undefined && match[2] !== undefined)
        blobs.set(file, new IndexBlob(match[1], Number(match[2])));
    });
    return blobs;
  }

  private async readPointersAsync(top: string, blobs: readonly string[], signal?: AbortSignal): Promise<void> {
    if (blobs.length === 0)
      return;
    const input = Buffer.from(blobs.map(t => t + Resources.lineEnd).join(""), Resources.utf8Encoding);
    const output = await this.runAsync(top, LfsPointerReader.BLOBS, input, Resources.catFileCommand, signal);
    let offset = 0;
    while (offset < output.length) {
      const headerEnd = output.indexOf(Resources.lineEnd, offset);
      const match = headerEnd < 0 ? null : Resources.blobHeaderPattern.exec(output.toString(Resources.utf8Encoding, offset, headerEnd));
      if (match?.[1] === undefined || match[2] === undefined)
        return;
      const size = Number(match[2]);
      LfsPointerReader.remember(this.pointers, match[1], LfsPointer.parse(output.subarray(headerEnd + 1, headerEnd + 1 + size)));
      offset = headerEnd + 1 + size + 1;
    }
  }

  private async matchesAsync(file: string, blob: string, pointer: LfsPointer, budget: HashBudget, signal?: AbortSignal): Promise<boolean | null> {
    let stats: BigIntStats;
    try {
      stats = await lstat(file, { bigint: true });
    } catch (error) {
      if (FilePresence.isUnreadable(error))
        return false;
      throw error;
    }
    if (!stats.isFile())
      return false;
    const key = [file, blob, stats.size, stats.mtimeNs, stats.ctimeNs].join(Resources.nulCharacter);
    const known = this.answers.get(key);
    if (known !== undefined)
      return known;
    const size = Number(stats.size);
    if (size !== pointer.size)
      return false;
    if (!budget.take(size))
      return null;
    const matches = await LfsPointerReader.hashAsync(file, signal) === pointer.oid;
    LfsPointerReader.remember(this.answers, key, matches);
    return matches;
  }

  private static async hashAsync(file: string, signal?: AbortSignal): Promise<string> {
    const hash = createHash(Resources.digestAlgorithm);
    const parts: AsyncIterable<Buffer> = createReadStream(file, { signal });
    for await (const part of parts)
      hash.update(part);
    return hash.digest(Resources.hexEncoding);
  }

  private async runAsync(top: string, gitArguments: GitArguments, input: Buffer, command: string, signal?: AbortSignal): Promise<Buffer> {
    const result = await this.runner.runAsync(ProgramRun.readGit(gitArguments, top, LfsPointerReader.LIMITS, signal).withInput(input));
    if (result.exit.code !== 0 || result.isTruncated)
      throw new GitFailedException(command, { text: result.errors.toString(Resources.utf8Encoding), source: UntrustedSource.Repository });
    return result.output;
  }

  private static fields(output: Buffer): string[] {
    const text = output.toString(Resources.utf8Encoding);
    return (text.endsWith(Resources.nulCharacter) ? text.slice(0, -1) : text).split(Resources.nulCharacter).filter(t => t.length > 0);
  }

  private static joined(values: readonly string[]): Buffer {
    return Buffer.from(values.map(t => t + Resources.nulCharacter).join(""), Resources.utf8Encoding);
  }

  private static remember<T>(cache: Map<string, T>, key: string, value: T): void {
    if (cache.size >= Resources.lfsCacheEntries)
      cache.clear();
    cache.set(key, value);
  }
}

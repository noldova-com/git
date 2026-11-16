/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, type Hash } from "node:crypto";
import { lstat, open, readlink } from "node:fs/promises";
import path from "node:path";
import timers from "node:timers";

import { ChangesTooLargeException } from "../exceptions/changes-too-large.exception.ts";
import { ChangesTooSlowException } from "../exceptions/changes-too-slow.exception.ts";
import { ChangesUnreadableException } from "../exceptions/changes-unreadable.exception.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";

export class ChangesDigest {
  private static readonly MISSING: Buffer = Buffer.from(Resources.missingDigestToken);
  private static readonly OTHER: Buffer = Buffer.from(Resources.otherDigestToken);
  private static readonly LINK: Buffer = Buffer.from(Resources.linkDigestPrefix);
  private static readonly FILE: Buffer = Buffer.from(Resources.fileDigestPrefix);
  private readonly limitBytes: number;

  public constructor(limitBytes: number) {
    this.limitBytes = limitBytes;
  }

  public async readAsync(folder: string, status: Buffer, paths: readonly Buffer[]): Promise<string> {
    const deadline = new AbortController();
    const timer: NodeJS.Timeout = timers.setTimeout(() => deadline.abort(), Resources.changesDigestMilliseconds);
    try {
      const digest = createHash(Resources.digestAlgorithm);
      ChangesDigest.add(digest, status);
      const root = Buffer.from(Resources.formatFolderPrefix(folder, path.sep));
      const budget = { remainingBytes: this.limitBytes };
      for (const relative of paths) {
        ChangesDigest.add(digest, relative);
        ChangesDigest.add(digest, await ChangesDigest.readContentAsync(Buffer.concat([root, relative]), deadline.signal, budget));
      }
      return digest.digest(Resources.hexEncoding);
    } finally {
      timers.clearTimeout(timer);
    }
  }

  private static add(digest: Hash, part: Buffer): void {
    const length = Buffer.alloc(Resources.digestLengthBytes);
    length.writeBigUInt64BE(BigInt(part.length));
    digest.update(length).update(part);
  }

  private static async readContentAsync(file: Buffer, signal: AbortSignal, budget: { remainingBytes: number }): Promise<Buffer> {
    try {
      signal.throwIfAborted();
      const stats = await lstat(file);
      if (stats.isSymbolicLink())
        return Buffer.concat([ChangesDigest.LINK, await readlink(file, { encoding: Resources.bufferEncoding })]);
      if (!stats.isFile())
        return ChangesDigest.OTHER;
      const content = createHash(Resources.digestAlgorithm);
      const handle = await open(file);
      try {
        for (let read = await handle.read(); read.bytesRead > 0; read = await handle.read()) {
          signal.throwIfAborted();
          budget.remainingBytes -= read.bytesRead;
          if (budget.remainingBytes < 0)
            throw new ChangesTooLargeException();
          content.update(read.buffer.subarray(0, read.bytesRead));
        }
      } finally {
        await handle.close();
      }
      return Buffer.concat([ChangesDigest.FILE, content.digest()]);
    } catch (error) {
      if (error instanceof ChangesTooLargeException)
        throw error;
      if (signal.aborted)
        throw new ChangesTooSlowException(error);
      if (FilePresence.isGone(error))
        return ChangesDigest.MISSING;
      if (FilePresence.isUnreadable(error))
        throw new ChangesUnreadableException(error);
      throw error;
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import path from "node:path";

import type { StatusEntry } from "@noldova/git.protocol";

import { GitPath } from "../models/git-path.ts";
import type { ParsedStatus } from "../models/parsed-status.ts";
import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";

export class StatusFingerprint {
  public static async readAsync(top: string, gitFolder: string, output: Buffer, status: ParsedStatus): Promise<string> {
    const hash = createHash(Resources.digestAlgorithm).update(output).update(String(status.truncated));
    hash.update(await StatusFingerprint.statAsync(Buffer.from(path.join(gitFolder, Resources.indexFile))));
    const root = Buffer.from(Resources.formatFolderPrefix(top, path.sep));
    for (const entry of status.entries)
      hash.update(await StatusFingerprint.statAsync(Buffer.concat([root, StatusFingerprint.bytesOf(entry)])));
    return hash.digest(Resources.hexEncoding);
  }

  private static bytesOf(entry: StatusEntry): Buffer {
    return GitPath.toBytes(entry.path, entry.pathBytes);
  }

  private static async statAsync(file: Buffer): Promise<string> {
    try {
      const stats = await lstat(file, { bigint: true });
      return Resources.formatFingerprint(stats.size, stats.mtimeNs, stats.ctimeNs, stats.mode);
    } catch (error) {
      if (FilePresence.isGone(error))
        return Resources.missingFingerprint;
      throw error;
    }
  }
}

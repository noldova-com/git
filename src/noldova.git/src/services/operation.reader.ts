/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { GitOperation, OperationKind } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import { FilePresence } from "./file-presence.ts";

export class OperationReader {
  public static async readAsync(gitFolder: string): Promise<GitOperation | null> {
    for (const folder of Resources.rebaseFolders) {
      const headName = await OperationReader.readLineAsync(path.join(gitFolder, folder, Resources.headNameFile));
      if (headName !== null)
        return new GitOperation(OperationKind.Rebase, OperationReader.branchOf(headName), null);
    }
    for (const head of Resources.operationHeads) {
      const from = await OperationReader.readLineAsync(path.join(gitFolder, head.file));
      if (from !== null)
        return new GitOperation(head.kind, from, await OperationReader.readLineAsync(path.join(gitFolder, Resources.mergeMessageFile)));
    }
    return null;
  }

  public static async readLineAsync(file: string): Promise<string | null> {
    try {
      const [line] = (await readFile(file, Resources.utf8Encoding)).split(Resources.linePattern);
      return line === undefined || line.trim().length === 0 ? null : line.trim();
    } catch (error) {
      if (FilePresence.isGone(error))
        return null;
      throw error;
    }
  }

  private static branchOf(headName: string): string | null {
    if (!headName.startsWith(Resources.branchRefsPrefix))
      return null;
    const branch = headName.slice(Resources.branchRefsPrefix.length);
    return branch.length === 0 ? null : branch;
  }
}

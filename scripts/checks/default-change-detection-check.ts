/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { Resources } from "../resources.ts";
import { OnPushFinder } from "./on-push-finder.ts";

class DefaultChangeDetectionCheck {
  public async runAsync(output: Writable): Promise<boolean> {
    const root = process.cwd();
    const files = await DefaultChangeDetectionCheck.listAsync(root, Resources.sourceFolder);
    const found = OnPushFinder.find(root, files);
    if (found.length === 0) {
      output.write(Resources.formatNoOnPush(files.length));
      return true;
    }
    output.write(Resources.formatOnPushFound(found));
    return false;
  }

  private static async listAsync(root: string, folder: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
      if (Resources.skippedSourceFolders.includes(entry.name))
        continue;
      const entryPath = `${folder}${Resources.pathSeparator}${entry.name}`;
      if (entry.isDirectory())
        files.push(...await DefaultChangeDetectionCheck.listAsync(root, entryPath));
      else if (entry.name.endsWith(Resources.typeScriptExtension) && !entry.name.endsWith(Resources.declarationExtension))
        files.push(entryPath);
    }
    return files;
  }
}

process.exitCode = await new DefaultChangeDetectionCheck().runAsync(process.stderr) ? Resources.successExitCode : Resources.failureExitCode;

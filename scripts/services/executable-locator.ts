/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";

export class ExecutableLocator {
  public static locate(name: string): string {
    if (process.platform === Resources.windowsPlatform)
      return name;
    for (const directory of (process.env[Resources.pathVariable] ?? "").split(path.delimiter)) {
      const candidate = path.join(directory, name);
      if (path.isAbsolute(directory) && ExecutableLocator.isExecutableFile(candidate))
        return candidate;
    }
    return name;
  }

  private static isExecutableFile(candidate: string): boolean {
    try {
      accessSync(candidate, constants.X_OK);
      return statSync(candidate).isFile();
    }
    catch (error) {
      if (error instanceof Error && "code" in error && typeof error.code === "string" && Resources.notExecutableCodes.includes(error.code))
        return false;
      throw error;
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants, type Stats } from "node:fs";
import { access, lstat } from "node:fs/promises";

import { Resources } from "../resources.ts";

export class FilePresence {
  public static isGone(error: unknown): boolean {
    return error instanceof Error && "code" in error && Resources.missingFileCodes.includes(String(error.code));
  }

  public static isDenied(error: unknown): boolean {
    return error instanceof Error && "code" in error && Resources.deniedFileCodes.includes(String(error.code));
  }

  public static isUnwritable(error: unknown): boolean {
    return error instanceof Error && "code" in error && Resources.unwritableFileCodes.includes(String(error.code));
  }

  public static isUnreadable(error: unknown): boolean {
    return error instanceof Error && "syscall" in error;
  }

  public static async existsAsync(file: string, mode: number = constants.F_OK): Promise<boolean> {
    try {
      await access(file, mode);
      return true;
    } catch (error) {
      if (FilePresence.isGone(error))
        return false;
      throw error;
    }
  }

  /** What is at the path itself, a link included whether or not its target is there, or null when nothing is. */
  public static async entryAsync(file: string): Promise<Stats | null> {
    try {
      return await lstat(file);
    } catch (error) {
      if (FilePresence.isGone(error))
        return null;
      throw error;
    }
  }
}

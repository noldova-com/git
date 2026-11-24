/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";

/**
 * Lists the window keeps in its own storage. Storage is a convenience: a list it can't read starts empty, and one it can't keep lasts
 * until the window closes.
 */
export class GitWindowStorage {
  /** The items of the list kept under a key, or none when nothing is kept, it doesn't read as a list, or storage is out of reach. */
  public static readArray(key: string): readonly JsonValue[] {
    try {
      const value: JsonValue = JsonReader.parseValue(localStorage.getItem(key) ?? "[]");
      return Array.isArray(value) ? value : [];
    }
    catch {
      return [];
    }
  }

  public static write(key: string, value: JsonValue): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
      // Without storage the list lasts until the window closes.
    }
  }
}

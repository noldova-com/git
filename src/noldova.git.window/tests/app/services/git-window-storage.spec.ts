/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitWindowStorage } from "../../../src/app/services/git-window-storage.ts";

describe("GitWindowStorage", () => {
  const key: string = "git.storageSpec";
  const fresh = (): void => {
    localStorage.removeItem(key);
    onTestFinished(() => {
      vi.restoreAllMocks();
      localStorage.removeItem(key);
    });
  };

  it("keeps a list under its key and reads its items back", () => {
    fresh();

    GitWindowStorage.write(key, ["/a", 3, { id: "w1" }, null]);

    expect([GitWindowStorage.readArray(key), localStorage.getItem(key)]).toEqual([["/a", 3, { id: "w1" }, null], "[\"/a\",3,{\"id\":\"w1\"},null]"]);
  });

  it("reads no items when nothing is kept, the value isn't a list, or it isn't JSON", () => {
    fresh();
    const missing: readonly unknown[] = GitWindowStorage.readArray(key);
    localStorage.setItem(key, "{\"id\":\"w1\"}");
    const object: readonly unknown[] = GitWindowStorage.readArray(key);
    localStorage.setItem(key, "[");

    expect([missing, object, GitWindowStorage.readArray(key)]).toEqual([[], [], []]);
  });

  it("reads no items when storage is out of reach", () => {
    fresh();
    localStorage.setItem(key, "[\"/a\"]");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is off.", "SecurityError");
    });

    expect(GitWindowStorage.readArray(key)).toEqual([]);
  });

  it("keeps nothing, without failing, when storage can't keep the list", () => {
    fresh();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full.", "QuotaExceededError");
    });

    GitWindowStorage.write(key, ["/a"]);

    expect(localStorage.getItem(key)).toBeNull();
  });
});

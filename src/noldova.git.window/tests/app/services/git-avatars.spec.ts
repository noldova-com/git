/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import type { IGitAvatars } from "../../../src/app/interfaces/i-git-avatars.ts";
import { GitAvatars } from "../../../src/app/services/git-avatars.ts";

describe("GitAvatars", () => {
  const fixed = (image: string | null | undefined): IGitAvatars => ({ avatarOf: () => image });

  it("shows none with no source, the first host's picture before a later one's, and the fallback's only once every host has none, until each withdraws", () => {
    const before = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    const withdrawFallback = GitAvatars.provideFallback(fixed("data:image/png;base64,Rg=="));
    const fallbackOnly = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    const withdrawNone = GitAvatars.provide(fixed(null));
    const withdrawFirst = GitAvatars.provide({ avatarOf: (folder, email, commitId) => folder === "/repository" && email === "kim@example.com" && commitId === "a1"
      ? "data:image/png;base64,QQ==" : null });
    const withdrawSecond = GitAvatars.provide(fixed("data:image/png;base64,Qg=="));

    const first = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    const second = GitAvatars.imageOf("/other", "kim@example.com", "a1");
    withdrawFirst();
    withdrawSecond();
    const fallback = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    withdrawNone();
    withdrawFallback();

    expect([before, fallbackOnly, first, second, fallback, GitAvatars.imageOf("/repository", "kim@example.com", "a1")]).toEqual([
      null, "data:image/png;base64,Rg==", "data:image/png;base64,QQ==", "data:image/png;base64,Qg==", "data:image/png;base64,Rg==", null
    ]);
  });

  it("holds the fallback back while a host is still reading, and answers again once it has read, for a view that reads it in a computed signal", () => {
    const host = signal<string | null | undefined>(undefined);
    const withdrawHost = GitAvatars.provide({ avatarOf: () => host() });
    const withdrawFallback = GitAvatars.provideFallback(fixed("data:image/png;base64,Rg=="));

    const reading = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    host.set("data:image/png;base64,SA==");
    const read = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    host.set(null);
    const none = GitAvatars.imageOf("/repository", "kim@example.com", "a1");
    withdrawHost();
    withdrawFallback();

    expect([reading, read, none]).toEqual([null, "data:image/png;base64,SA==", "data:image/png;base64,Rg=="]);
  });
});

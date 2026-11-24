/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import type { IGitCommitPrefixes } from "../../../src/app/interfaces/i-git-commit-prefixes.ts";
import { GitCommitPrefixes } from "../../../src/app/services/git-commit-prefixes.ts";

describe("GitCommitPrefixes", () => {
  const folder: string = "/work/project";

  it("gives the first added host's prefix that isn't null, and none once each is removed", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const first: IGitCommitPrefixes = { prefixFor: (_folder, branch) => branch.startsWith("users/") ? "AB#4821 " : null };
    const second: IGitCommitPrefixes = { prefixFor: (at, branch) => `${at}:${branch} ` };
    const removeFirst: () => void = GitCommitPrefixes.provide(context, first);
    const removeSecond: () => void = GitCommitPrefixes.provide(context, second);

    const found: (string | null)[] = [GitCommitPrefixes.prefixFor(folder, "users/ana/4821"), GitCommitPrefixes.prefixFor(folder, "main")];
    removeFirst();
    found.push(GitCommitPrefixes.prefixFor(folder, "users/ana/4821"));
    removeSecond();
    found.push(GitCommitPrefixes.prefixFor(folder, "main"));

    expect(found).toEqual(["AB#4821 ", "/work/project:main ", "/work/project:users/ana/4821 ", null]);
  });

  it("logs a host whose answer throws to the context that provided it, and asks the next host", () => {
    const broken: FakeWindowPartContext = new FakeWindowPartContext();
    const next: FakeWindowPartContext = new FakeWindowPartContext();
    const removeBroken: () => void = GitCommitPrefixes.provide(broken, { prefixFor: () => { throw new RangeError("broken"); } });
    const removeNext: () => void = GitCommitPrefixes.provide(next, { prefixFor: () => "AB#1 " });

    const found: string | null = GitCommitPrefixes.prefixFor(folder, "main");
    removeBroken();
    removeNext();

    expect(found).toBe("AB#1 ");
    expect([broken.callsOf("log"), next.callsOf("log")])
      .toEqual([[["The commit message starts without a host's prefix, since its answer failed: RangeError: broken"]], []]);
  });
});

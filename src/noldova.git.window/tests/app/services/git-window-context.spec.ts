/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitWindowInactiveException } from "../../../src/app/exceptions/git-window-inactive.exception.ts";
import { GitWindowContext } from "../../../src/app/services/git-window-context.ts";

describe("GitWindowContext", () => {
  it("gives the context provided last until it is withdrawn, and ignores the withdrawal of one provided before it", () => {
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const second: FakeWindowPartContext = new FakeWindowPartContext();
    const withdrawFirst: () => void = GitWindowContext.provide(first);
    const given: readonly unknown[] = [GitWindowContext.current() === first];
    const withdrawSecond: () => void = GitWindowContext.provide(second);
    withdrawFirst();
    const after: boolean = GitWindowContext.current() === second;
    withdrawSecond();

    expect([...given, after]).toEqual([true, true]);
    expect(() => GitWindowContext.current()).toThrow(GitWindowInactiveException);
  });
});

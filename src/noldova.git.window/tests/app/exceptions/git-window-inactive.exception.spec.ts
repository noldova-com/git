/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitWindowException } from "../../../src/app/exceptions/git-window.exception.ts";
import { GitWindowInactiveException } from "../../../src/app/exceptions/git-window-inactive.exception.ts";

describe("GitWindowInactiveException", () => {
  it("says Git's window part isn't active, so the Dashboard has nothing to show, as a Git window exception with no cause", () => {
    const exception: GitWindowInactiveException = new GitWindowInactiveException();

    expect([exception.message, exception.cause, exception.name, exception instanceof GitWindowException])
      .toEqual(["Git's window part isn't active in this window, so the Dashboard has no Git to show.", undefined, "GitWindowInactiveException", true]);
  });
});

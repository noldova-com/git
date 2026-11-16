/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { GitFolderProvidedException } from "../../../src/app/exceptions/git-folder-provided.exception.ts";
import { GitWindowException } from "../../../src/app/exceptions/git-window.exception.ts";
import { StatusMissingException } from "../../../src/app/exceptions/status-missing.exception.ts";

describe("GitWindowException", () => {
  it("is the boundary of every failure the Git view owns, each named after its own class", () => {
    const failures: Error[] = [new GitFolderProvidedException(), new StatusMissingException()];

    expect(failures.map(t => [t instanceof GitWindowException, t instanceof Exception, t.name])).toEqual([
      [true, true, "GitFolderProvidedException"],
      [true, true, "StatusMissingException"]
    ]);
  });

  it("leaves a failure the Git view does not own outside its boundary", () => {
    expect([new Error("A defect."), new TypeError("Not a function.")].map(t => t instanceof GitWindowException)).toEqual([false, false]);
  });
});

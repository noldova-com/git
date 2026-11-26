/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitCommitSigning, SigningFormat } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitSigningRead } from "../../../src/app/models/git-signing-read.ts";

describe("GitSigningRead", () => {
  it("holds a signing read's answer and the folder it is for", () => {
    const signing: GitCommitSigning = new GitCommitSigning(true, SigningFormat.Ssh);
    const value: GitSigningRead = new GitSigningRead("/work/a", signing);

    expect([value.folder, value.signing]).toEqual(["/work/a", signing]);
  });
});

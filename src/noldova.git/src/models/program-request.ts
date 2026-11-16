/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProcessRequest } from "@noldova/desktop.runtime";

import { Access } from "../enums/access.ts";
import { Program } from "../enums/program.ts";
import { Resources } from "../resources.ts";
import type { ProgramRun } from "./program-run.ts";

export class ProgramRequest extends ProcessRequest {

  public constructor(run: ProgramRun, signal: AbortSignal) {
    const isGit = run.program === Program.Git;
    super(
      isGit ? Resources.gitProgram : Resources.ghProgram,
      isGit ? [...(run.access === Access.Read ? Resources.gitReadOptions : Resources.gitWriteOptions), ...run.arguments] : run.arguments,
      run.workingFolder,
      Resources.programEnvironment,
      Resources.inheritedEnvironment,
      signal);
  }
}

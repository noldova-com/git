/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ProcessExit } from "@noldova/desktop.runtime";

import { ProgramResult } from "../../src/models/program-result.ts";
import type { ProgramRun } from "../../src/models/program-run.ts";
import { ProgramRunner } from "../../src/services/program-runner.ts";

export class ScriptedRunnerFixture extends ProgramRunner {
  public failing: string | null = null;
  public failingCode: number = 1;
  public failingErrors: string = "scripted failure\n";
  public truncating: string | null = null;
  public answering: readonly [string, string] | null = null;
  public starting: (command: string) => void = () => {};

  public override async runAsync(run: ProgramRun): Promise<ProgramResult> {
    const command = run.arguments.join(" ");
    this.starting(command);
    if (!Object.isNull(this.failing) && command.includes(this.failing))
      return new ProgramResult(new ProcessExit(this.failingCode, null), Buffer.alloc(0), Buffer.from(this.failingErrors), false);
    if (!Object.isNull(this.answering) && command.includes(this.answering[0]))
      return new ProgramResult(new ProcessExit(0, null), Buffer.from(this.answering[1]), Buffer.alloc(0), false);
    const result = await super.runAsync(run);
    if (!Object.isNull(this.truncating) && command.includes(this.truncating))
      return new ProgramResult(result.exit, result.output, result.errors, true);
    return result;
  }
}

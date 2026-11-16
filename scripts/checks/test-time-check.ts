/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { ScriptException } from "../exceptions/script.exception.ts";
import { TestTimes } from "../models/test-times.ts";
import { Resources } from "../resources.ts";

// Reports the times of the whole run's test files from Vitest's JSON report, naming each file over 1 second that README's list of
// slower files doesn't name, each listed file over the time the list gives it, and each listed file the run no longer has. It never
// fails for a time, since no check of npm test takes the clock as a pass condition; npm run test:timing is the timing check.
class TestTimeCheck {
  public async runAsync(output: Writable): Promise<void> {
    const root = process.cwd();
    const times = await TestTimes.readAsync(root, Resources.testTimesFile);
    const listed = await TestTimes.readListedAsync(root);
    for (const [file, milliseconds] of times) {
      const allowed = listed.get(file);
      if (allowed === undefined && milliseconds > Resources.fileBudgetMilliseconds)
        output.write(Resources.formatUnlistedSlowFile(file, milliseconds));
      else if (allowed !== undefined)
        output.write(Resources.formatListedSlowFile(file, milliseconds, allowed));
    }
    for (const file of [...listed.keys()].filter(t => !times.has(t)))
      output.write(Resources.formatListedFileMissing(file));
  }
}

try {
  await new TestTimeCheck().runAsync(process.stderr);
}
catch (error) {
  if (!(error instanceof ScriptException))
    throw error;
  console.error(error.message);
  process.exitCode = Resources.failureExitCode;
}

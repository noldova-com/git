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

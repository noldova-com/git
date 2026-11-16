/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { TestTimesUnreadableException } from "../exceptions/test-times-unreadable.exception.ts";
import { Resources } from "../resources.ts";
import { JsonValue } from "../services/json-value.ts";

export class TestTimes {
  public static async readAsync(root: string, report: string): Promise<Map<string, number>> {
    const text = await readFile(path.join(root, report), Resources.encoding);
    let json: unknown;
    try {
      json = JSON.parse(text);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new TestTimesUnreadableException(report, error);
    }
    const files = TestTimes.field(json, Resources.testResultsField);
    const times = new Map<string, number>();
    for (const file of Array.isArray(files) ? files : []) {
      const name = TestTimes.field(file, Resources.testNameField);
      const start = TestTimes.field(file, Resources.testStartField);
      const end = TestTimes.field(file, Resources.testEndField);
      if (typeof name !== "string" || typeof start !== "number" || typeof end !== "number")
        throw new TestTimesUnreadableException(report);
      times.set(path.relative(root, name).replaceAll(Resources.windowsPathSeparator, Resources.pathSeparator), end - start);
    }
    return times;
  }

  public static async readListedAsync(root: string): Promise<Map<string, number>> {
    const readme = await readFile(path.join(root, Resources.readmeFile), Resources.encoding);
    const start = readme.indexOf(Resources.slowFilesHeading);
    const section = start < 0 ? "" : readme.slice(start + Resources.slowFilesHeading.length).split(Resources.sectionStart)[0] ?? "";
    return new Map([...section.matchAll(Resources.slowFileRow)].map(t => [t[1] ?? "", Number(t[2]) * Resources.millisecondsPerSecond]));
  }

  private static field(value: unknown, name: string): unknown {
    return JsonValue.isObject(value) ? value[name] : undefined;
  }
}

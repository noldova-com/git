/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ThreadLine } from "../../../src/app/models/thread-line.ts";

describe("ThreadLine", () => {
  it("keeps the thread's id and the file and line it's on, each host's path as the host names it", () => {
    const lines: readonly ThreadLine[] = [new ThreadLine(3, "/src/app.ts", 42), new ThreadLine(21, "src/app.ts", 1)];

    expect(lines.map(t => [t.threadId, t.path, t.line])).toEqual([[3, "/src/app.ts", 42], [21, "src/app.ts", 1]]);
  });
});

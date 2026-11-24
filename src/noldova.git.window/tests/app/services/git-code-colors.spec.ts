/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { ShikiLineTokenizer } from "@noldova/editor.angular";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitCodeColors } from "../../../src/app/services/git-code-colors.ts";

describe("GitCodeColors", () => {
  it("gives no tokenizer with no path or for a path no language fits, and loads none for them", () => {
    const created = vi.spyOn(ShikiLineTokenizer, "createAsync");
    onTestFinished(() => created.mockRestore());
    const colors: GitCodeColors = TestBed.inject(GitCodeColors);

    expect([colors.tokenizerOf(null), colors.tokenizerOf("README"), colors.tokenizerOf("notes.cobol"), created.mock.calls.length]).toEqual([null, null, null, 0]);
  });
});

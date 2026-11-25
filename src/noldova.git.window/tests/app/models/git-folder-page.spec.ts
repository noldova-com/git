/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitFolderPage } from "../../../src/app/models/git-folder-page.ts";

describe("GitFolderPage", () => {
  it("holds the folder a document shows and whether it is active", () => {
    const folder: WritableSignal<string> = signal("/work/repo");
    const active: WritableSignal<boolean> = signal(true);
    const value: GitFolderPage = new GitFolderPage(folder, active);

    expect([value.folder, value.active]).toEqual([folder, active]);
  });
});

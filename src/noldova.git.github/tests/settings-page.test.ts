/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { JsonReader } from "@noldova/context.json";
import { describe, it } from "vitest";

/** Reads a module's declaration file, beside the module's own folder or another module's. */
function declarationOf(path: string): JsonReader {
  return JsonReader.fromValue(JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")));
}

// 0.0.6 declared the Settings page `git-github.account`, which 0.0.7 replaces with the Git module's `git.accounts`. Noldova Desktop keeps no page
// id a person could carry over: its recent commands keep command ids without their arguments, and the open settings page lives only in memory.
// These checks hold the modules' half: nothing a person saves is declared under the old page.
describe("The GitHub module's Settings page", () => {
  it("declares no Settings page and no settings of its own, so nothing a person saved is kept under the 0.0.6 page git-github.account", () => {
    const module: JsonReader = declarationOf("../module.json");
    const settings: JsonReader = declarationOf("../settings.json");

    assert.deepEqual([module.readObject("contributes").hasField("settingsPages"), settings.hasField("pages"), settings.readObjectArray("settings").length],
      [false, false, 0]);
  });

  it("leaves the GitHub account to the Git module's page git.accounts, which declares no page by the old id", () => {
    const module: JsonReader = declarationOf("../../noldova.git/module.json");
    const settings: JsonReader = declarationOf("../../noldova.git/settings.json");

    assert.deepEqual([module.readObject("contributes").readStringArray("settingsPages"), settings.readObjectArray("pages").map(t => t.readString("name"))],
      [["git.accounts"], ["git.accounts"]]);
  });
});

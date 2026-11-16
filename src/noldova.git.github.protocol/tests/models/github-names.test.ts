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

import { GitHubNames } from "../../src/api/index.ts";

describe("GitHubNames", () => {
  it("names the module as its module.json declares it", () => {
    const declaration: JsonReader = JsonReader.parse(readFileSync(new URL("../../../noldova.git.github/module.json", import.meta.url), "utf8"));

    assert.equal(GitHubNames.moduleId, declaration.readString("id"));
  });
  it("names the sign-in's and the reads' methods, the event and the tools as its module.json contributes them", () => {
    const contributes: JsonReader = JsonReader.parse(readFileSync(new URL("../../../noldova.git.github/module.json", import.meta.url), "utf8")).readObject("contributes");

    assert.deepEqual(contributes.readStringArray("methods"),
      [GitHubNames.readSignInMethod, GitHubNames.startSignInMethod, GitHubNames.cancelSignInMethod, GitHubNames.signOutMethod,
        GitHubNames.readReferenceMethod, GitHubNames.readBranchPullRequestMethod, GitHubNames.createPullRequestMethod]);
    assert.deepEqual(contributes.readStringArray("events"), [GitHubNames.signInChangedEvent]);
    assert.deepEqual(contributes.readStringArray("tools"), [GitHubNames.readTool, GitHubNames.prChecksTool, GitHubNames.prCreateTool]);
    assert.equal(GitHubNames.accessService, "git-github.access");
    assert.equal(GitHubNames.manageAccessUrl, `https://github.com/settings/connections/applications/${GitHubNames.clientId}`);
  });
});

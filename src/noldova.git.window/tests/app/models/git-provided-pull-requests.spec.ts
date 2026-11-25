/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import type { IGitPullRequests } from "../../../src/app/interfaces/i-git-pull-requests.ts";
import { GitProvidedPullRequests } from "../../../src/app/models/git-provided-pull-requests.ts";

describe("GitProvidedPullRequests", () => {
  it("holds a host's pull request list and the context it was given by", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const pullRequests: IGitPullRequests = { hostName: "GitHub", signInPage: "https://github.com/login", claims: () => true, listFor: () => signal(null), refresh: () => undefined };
    const value: GitProvidedPullRequests = new GitProvidedPullRequests(context, pullRequests);

    expect([value.context, value.pullRequests]).toEqual([context, pullRequests]);
  });
});

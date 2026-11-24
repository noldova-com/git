/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitGravatars } from "../../../src/app/services/git-gravatars.ts";
import { GitRuntimeClient } from "../../../src/app/services/git-runtime-client.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";

describe("GitGravatars", () => {
  it("reads each email's picture once through the Git module, whatever its case or spaces, answering undefined until it arrives", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { "git.avatar": { image: "data:image/png;base64,QQ==" } });
    const gravatars: GitGravatars = new GitGravatars(new GitRuntimeClient(context));

    const reading = gravatars.avatarOf("/repository", " Ana@Example.com", "a1");
    await GitFixtures.untilAsync(() => gravatars.avatarOf("/other", "ana@example.com", "b2") !== undefined);

    expect([reading, gravatars.avatarOf("/repository", "ANA@example.com", "c3")]).toEqual([undefined, "data:image/png;base64,QQ=="]);
    expect(context.callsOf("requestAsync")).toEqual([["git.avatar", { email: "ana@example.com" }]]);
  });

  it("answers null for an email Gravatar has no picture for, for one it couldn't read, and for an empty one without asking", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, { "git.avatar": () => context.callsOf("requestAsync").length === 1 ? { image: null } : new Error("Down.") });
    const gravatars: GitGravatars = new GitGravatars(new GitRuntimeClient(context));

    gravatars.avatarOf("/repository", "none@example.com", "a1");
    gravatars.avatarOf("/repository", "down@example.com", "a1");
    await GitFixtures.untilAsync(() => gravatars.avatarOf("/repository", "none@example.com", "a1") !== undefined
      && gravatars.avatarOf("/repository", "down@example.com", "a1") !== undefined);

    expect([gravatars.avatarOf("/repository", "none@example.com", "a1"), gravatars.avatarOf("/repository", "down@example.com", "a1"),
      gravatars.avatarOf("/repository", " ", "a1")]).toEqual([null, null, null]);
    expect(context.callsOf("requestAsync").length).toBe(2);
  });
});

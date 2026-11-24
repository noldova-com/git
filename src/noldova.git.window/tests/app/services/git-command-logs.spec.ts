/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitCommandLogs } from "../../../src/app/services/git-command-logs.ts";
import { Resources } from "../../../src/resources.ts";

const KEY: string = "git.commandLogs";
const titleOf = (folder: string): string => Resources.formatCommandLogTitle(folder);
const stored = (): unknown => JSON.parse(localStorage.getItem(KEY) ?? "null");

describe("GitCommandLogs", () => {
  afterEach(() => {
    localStorage.clear();
    GitCommandLogs.restore(new FakeWindowPartContext());
  });

  it("opens again each command log the window kept, leaving out entries that aren't folders", () => {
    localStorage.setItem(KEY, JSON.stringify(["/work/site", 7, " ", null, "/work/docs"]));
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    GitCommandLogs.restore(context);

    expect(context.callsOf("openView")).toEqual([["git.commands", "/work/site", titleOf("/work/site")], ["git.commands", "/work/docs", titleOf("/work/docs")]]);
  });

  it("opens nothing from storage it can't read", () => {
    localStorage.setItem(KEY, "{broken");
    const context: FakeWindowPartContext = new FakeWindowPartContext();

    GitCommandLogs.restore(context);

    expect(context.callsOf("openView")).toEqual([]);
  });

  it("opens a folder's command log and keeps it once, so the next window opens it again", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitCommandLogs.restore(context);

    GitCommandLogs.open(context, "/work/site");
    GitCommandLogs.open(context, "/work/site");
    GitCommandLogs.open(context, "/work/docs");

    expect([context.callsOf("openView").length, stored()]).toEqual([3, ["/work/site", "/work/docs"]]);
  });

  it("forgets a folder's command log once the person closes its view", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitCommandLogs.restore(context);
    GitCommandLogs.open(context, "/work/site");
    GitCommandLogs.open(context, "/work/docs");

    context.raiseViewClosed("git.commands", "/work/site");

    expect(stored()).toEqual(["/work/docs"]);
  });
});

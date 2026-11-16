/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, signal, type WritableSignal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitFolderProvidedException } from "../../../src/app/exceptions/git-folder-provided.exception.ts";
import { GitFolder } from "../../../src/app/services/git-folder.ts";

describe("GitFolder", () => {
  const unregisters: (() => void)[] = [];

  afterEach(() => {
    for (const unregister of unregisters.splice(0))
      unregister();
  });

  it("has no folder and no failure until an app provides one", () => {
    expect([GitFolder.folder(), GitFolder.failure()]).toEqual([null, null]);
  });

  it("follows the provided folder as it changes", () => {
    const folder: WritableSignal<string | null> = signal("/work/one");
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), folder));

    const first: string | null = GitFolder.folder();
    folder.set("C:\\work\\two");
    const second: string | null = GitFolder.folder();
    folder.set("\\\\server\\share");

    expect([first, second, GitFolder.folder()]).toEqual(["/work/one", "C:\\work\\two", "\\\\server\\share"]);
  });

  it("has no folder when the provider gives none, without a log line", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    unregisters.push(GitFolder.provide(context, signal(null)));

    expect([GitFolder.folder(), context.callsOf("log")]).toEqual([null, []]);
  });

  it("has no folder for a blank, relative or over-long folder, and says why in the providing app's log", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const folder: WritableSignal<string | null> = signal(" ");
    unregisters.push(GitFolder.provide(context, folder));

    const read: (string | null)[] = [];
    for (const next of [" ", "work/project", "C:work", `/${"a".repeat(4_096)}`]) {
      folder.set(next);
      read.push(GitFolder.folder());
    }

    expect(read).toEqual([null, null, null, null]);
    expect(GitFolder.failure()).toBeNull();
    expect(context.callsOf("log")).toEqual([
      ["The Git view shows no folder, since the app's folder could not be read: the folder is blank"],
      ["The Git view shows no folder, since the app's folder could not be read: the folder isn't an absolute path"],
      ["The Git view shows no folder, since the app's folder could not be read: the folder isn't an absolute path"],
      ["The Git view shows no folder, since the app's folder could not be read: the folder has more than 4096 characters"]
    ]);
  });

  it("has no folder but the failure's message when the provider throws, and says so in the providing app's log", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    unregisters.push(GitFolder.provide(context, computed((): string => {
      throw new Error("No chat is shown.");
    })));

    expect([GitFolder.folder(), GitFolder.failure(), context.callsOf("log")])
      .toEqual([null, "No chat is shown.", [["The Git view shows no folder, since the app's folder could not be read: Error: No chat is shown."]]]);
  });

  it("gives a thrown value that isn't an Error as the failure", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    unregisters.push(GitFolder.provide(context, computed((): string => {
      throw "No chat is shown.";
    })));

    expect([GitFolder.folder(), GitFolder.failure()]).toEqual([null, "No chat is shown."]);
  });

  it("refuses a second provider until the first is removed, and a removed provider's removal leaves the next in place", () => {
    const unregister: () => void = GitFolder.provide(new FakeWindowPartContext(), signal("/first"));

    expect(() => GitFolder.provide(new FakeWindowPartContext(), signal("/second"))).toThrow(GitFolderProvidedException);
    unregister();
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), signal("/second")));
    unregister();

    expect(GitFolder.folder()).toBe("/second");
  });
});

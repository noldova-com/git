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

  it("puts a shown document's folder ahead of the provided one until it is released, and a stale release leaves a newer one in place", () => {
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), signal("/work/provided")));

    const releaseFirst: () => void = GitFolder.show("/work/first");
    const first: string | null = GitFolder.folder();
    const releaseSecond: () => void = GitFolder.show("/work/second");
    releaseFirst();
    const second: string | null = GitFolder.folder();
    releaseSecond();

    expect([first, second, GitFolder.folder()]).toEqual(["/work/first", "/work/second", "/work/provided"]);
  });

  it("ignores a shown folder while no folder is provided, and refuses a relative one", () => {
    unregisters.push(GitFolder.show("/work/shown"));
    const unprovided: string | null = GitFolder.folder();
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), signal("/work/provided")));
    unregisters.push(GitFolder.show("relative"));

    expect([unprovided, GitFolder.folder()]).toEqual([null, null]);
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

  it("follows whichever followed document is the active one, back and forth, ahead of a shown folder, and the shown or provided folder once none is", () => {
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), signal("/work/provided")));
    unregisters.push(GitFolder.show("/work/shown"));
    const first: WritableSignal<boolean> = signal(true);
    const second: WritableSignal<boolean> = signal(false);
    unregisters.push(GitFolder.follow(signal("/work/first"), first));
    const releaseSecond: () => void = GitFolder.follow(signal("/work/second"), second);
    const seen: (string | null)[] = [GitFolder.folder()];

    for (const [isFirst, isSecond] of [[false, true], [true, false], [false, false]] as const) {
      first.set(isFirst);
      second.set(isSecond);
      seen.push(GitFolder.folder());
    }
    second.set(true);
    releaseSecond();
    seen.push(GitFolder.folder());

    expect(seen).toEqual(["/work/first", "/work/second", "/work/first", "/work/shown", "/work/shown"]);
  });

  it("keeps the last active followed document's folder while a document that follows none is in front, ahead of the provided folder, until that document is released", () => {
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), signal(null)));
    const first: WritableSignal<boolean> = signal(false);
    const second: WritableSignal<boolean> = signal(true);
    unregisters.push(GitFolder.follow(signal("/work/first"), first));
    const releaseSecond: () => void = GitFolder.follow(signal("/work/second"), second);
    const seen: (string | null)[] = [GitFolder.folder()];

    second.set(false);
    seen.push(GitFolder.folder());
    first.set(true);
    seen.push(GitFolder.folder());
    first.set(false);
    seen.push(GitFolder.folder());
    releaseSecond();
    seen.push(GitFolder.folder());

    expect(seen).toEqual(["/work/second", "/work/second", "/work/first", "/work/first", "/work/first"]);
  });

  it("gives the provided folder once the last active followed document is released while none is active", () => {
    unregisters.push(GitFolder.provide(new FakeWindowPartContext(), signal("/work/provided")));
    const active: WritableSignal<boolean> = signal(true);
    const release: () => void = GitFolder.follow(signal("/work/page"), active);
    const shownWhileActive: string | null = GitFolder.folder();
    active.set(false);
    const kept: string | null = GitFolder.folder();
    release();

    expect([shownWhileActive, kept, GitFolder.folder()]).toEqual(["/work/page", "/work/page", "/work/provided"]);
  });
});

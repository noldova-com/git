/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { type IUndoProvider, WindowException } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { FailureCode, GitJournal, GitJournalEntry, UndoMode } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { Resources } from "../../../src/resources.ts";
import { GitFolder } from "../../../src/app/services/git-folder.ts";
import { GitLastWriteUndo } from "../../../src/app/services/git-last-write-undo.ts";
import { GitFixtures } from "../../fixtures/git-fixtures.fixture.ts";
import { GitHeldRequests } from "../../fixtures/git-held-requests.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";

class UndoTakenException extends WindowException {
  public constructor() {
    super("Another part provides Undo.");
  }
}

describe("GitLastWriteUndo", () => {
  const at: string = "2026-11-26T10:00:00Z";
  const tree: string = "0123456789abcdef0123456789abcdef01234567";
  const write = (id: string, undo: UndoMode): GitJournalEntry => {
    const index: string | null = undo === UndoMode.Index ? tree : null;
    return new GitJournalEntry(id, "git.stage", at, "main", "main", [], undo, index, index);
  };
  const journalOf = (...entries: readonly GitJournalEntry[]): JsonValue => new GitJournal(entries).toJson();
  const statusOf = (fingerprint: string): JsonValue => GitFixtures.status([], null, { fingerprint }).toJson();

  interface ISetUp {
    readonly context: FakeWindowPartContext;
    readonly shown: WritableSignal<string | null>;
    readonly provider: () => IUndoProvider | null;
    readonly provide: () => () => void;
  }

  function setUp(folder: string | null = GitFixtures.folder): ISetUp {
    const context = new FakeWindowPartContext();
    context.answer("log", () => undefined);
    context.allow("provideUndo");
    const tracked: FakeWindowPartContext["provideUndo"] = context.provideUndo;
    let provided: IUndoProvider | null = null;
    Object.assign(context, {
      provideUndo: (provider: IUndoProvider): (() => void) => {
        provided = provider;
        return tracked(provider);
      }
    });
    const shown: WritableSignal<string | null> = signal(folder);
    onTestFinished(GitFolder.provide(context, shown));
    return {
      context, shown, provider: () => provided,
      provide: (): (() => void) => {
        const withdraw: () => void = GitLastWriteUndo.provide(context);
        onTestFinished(withdraw);
        return withdraw;
      }
    };
  }

  const undoCalls = (context: FakeWindowPartContext): readonly unknown[] => context.callsOf("requestAsync").filter(t => t[0] === "git.undo").map(t => t[1]);
  const callsOf = (context: FakeWindowPartContext, method: string): number => context.callsOf("requestAsync").filter(t => t[0] === method).length;
  const logs = (context: FakeWindowPartContext): readonly unknown[] => context.callsOf("log").map(t => t[0]);

  it("greys Undo while the journal's newest write can't be undone, then undoes it based on the status read with it and reaches the write before", async () => {
    const journals: JsonValue[] = [journalOf(write("5", UndoMode.Index)), journalOf(write("5", UndoMode.Index), write("6", UndoMode.None)),
      journalOf(write("5", UndoMode.Index), write("6", UndoMode.Index)), journalOf(write("5", UndoMode.Index))];
    const statuses: string[] = ["f1", "f2", "f3", "f4"];
    const { context, provider, provide } = setUp();
    GitFixtures.answerWith(context, { "git.status": () => statusOf(statuses.shift() ?? "f9"), "git.journal": () => journals.shift() ?? journalOf(), "git.undo": null });
    provide();
    const undo: IUndoProvider | null = provider();
    await Wait.until(() => undo?.canUndo() === true);

    context.raiseEvent("git.changed", { folder: "/elsewhere" });
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await Wait.until(() => undo?.canUndo() === false);
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await Wait.until(() => undo?.canUndo() === true);
    const running: Promise<void> | undefined = undo?.undoAsync();
    const whileRunning: boolean | undefined = undo?.canUndo();
    await running;
    await Wait.until(() => callsOf(context, "git.journal") === 4 && undo?.canUndo() === true);

    expect([whileRunning, callsOf(context, "git.journal"), context.activeCallsOf("provideUndo").length]).toEqual([false, 4, 1]);
    expect(undoCalls(context)).toEqual([{ folder: GitFixtures.folder, id: "6", basedOn: "f3" }]);
  });

  it("asks nothing for a second Undo before the journal is read again, and reads it again after an undo Git refuses, whose failure the window reports", async () => {
    const { context, provider, provide } = setUp();
    const held = new GitHeldRequests(context, ["git.undo"], { "git.status": statusOf("f1"), "git.journal": journalOf(write("6", UndoMode.Index)) });
    provide();
    const undo: IUndoProvider | null = provider();
    await Wait.until(() => undo?.canUndo() === true);

    const first: Promise<unknown> | undefined = undo?.undoAsync().catch((error: unknown) => error);
    await undo?.undoAsync();
    await held.answerAsync("git.undo", GitFixtures.failure(FailureCode.Stale));
    const refused: unknown = await first;
    await Wait.until(() => callsOf(context, "git.journal") === 2 && undo?.canUndo() === true);

    expect([refused instanceof Error, undoCalls(context).length]).toEqual([true, 1]);
  });

  it("offers nothing without a folder, for an empty journal or one Git can't read, logs a read that fails otherwise, and keeps the newest folder's answer", async () => {
    const { context, shown, provider, provide } = setUp(null);
    const held = new GitHeldRequests(context, ["git.journal"], { "git.status": statusOf("f1") });
    provide();
    const undo: IUndoProvider | null = provider();
    await Promise.resolve();
    const none: readonly unknown[] = [undo?.canUndo(), callsOf(context, "git.status")];

    const readAsync = async (answer: JsonValue | Error, offered: boolean): Promise<void> => {
      context.raiseEvent("git.changed", { folder: GitFixtures.folder });
      await held.answerAsync("git.journal", answer);
      await Wait.until(() => undo?.canUndo() === offered);
    };
    shown.set(GitFixtures.folder);
    await held.answerAsync("git.journal", journalOf(write("6", UndoMode.Index)));
    await Wait.until(() => undo?.canUndo() === true);
    await readAsync(GitFixtures.failure(FailureCode.Unavailable), false);
    await readAsync(journalOf(write("6", UndoMode.Index)), true);
    await readAsync(journalOf(), false);
    await readAsync(journalOf(write("6", UndoMode.Index)), true);
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await held.answerAsync("git.journal", new Error("The runtime went away."));
    await Wait.until(() => logs(context).length === 1 && undo?.canUndo() === false);

    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const left: (answer: JsonValue | Error) => void = await held.nextAsync("git.journal");
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    const failedLate: (answer: JsonValue | Error) => void = await held.nextAsync("git.journal");
    shown.set("/other");
    await held.answerAsync("git.journal", journalOf());
    left(journalOf(write("6", UndoMode.Index)));
    failedLate(new Error("Too late."));
    await Wait.drainedAsync();

    expect([none, undo?.canUndo()]).toEqual([[false, 0], false]);
    expect(logs(context)).toEqual([Resources.formatUndoReadFailed(GitFixtures.folder, "Error: The runtime went away.")]);
  });

  it("doesn't read the folder an undo was for once Git shows another", async () => {
    const { context, shown, provider, provide } = setUp();
    const held = new GitHeldRequests(context, ["git.undo"], { "git.status": statusOf("f1"), "git.journal": journalOf(write("6", UndoMode.Index)) });
    provide();
    const undo: IUndoProvider | null = provider();
    await Wait.until(() => undo?.canUndo() === true);

    const running: Promise<void> | undefined = undo?.undoAsync();
    shown.set(null);
    await Wait.until(() => undo?.canUndo() === false);
    await held.answerAsync("git.undo", null);
    await running;

    expect([callsOf(context, "git.journal"), undo?.canUndo()]).toEqual([1, false]);
  });

  it("withdraws the provider and stops reading once withdrawn", async () => {
    const { context, provider, provide } = setUp();
    GitFixtures.answerWith(context, { "git.status": statusOf("f1"), "git.journal": journalOf(write("6", UndoMode.Index)) });
    const withdraw: () => void = provide();
    await Wait.until(() => provider()?.canUndo() === true);

    withdraw();
    context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await Promise.resolve();

    expect([context.activeCallsOf("provideUndo").length, context.activeCallsOf("onEvent").length, provider()?.canUndo(), callsOf(context, "git.journal")]).toEqual([0, 0, false, 1]);
  });

  it("logs and provides nothing where another part already provides Undo, and lets any other failure through", () => {
    const { context, provide } = setUp();
    Object.assign(context, { provideUndo: (): (() => void) => { throw new UndoTakenException(); } });
    provide()();
    const taken: readonly unknown[] = [logs(context), context.activeCallsOf("onEvent").length, callsOf(context, "git.status")];
    Object.assign(context, { provideUndo: (): (() => void) => { throw new RangeError("Broken."); } });

    expect(taken).toEqual([[Resources.undoTaken], 0, 0]);
    expect(() => GitLastWriteUndo.provide(context)).toThrow(RangeError);
  });
});

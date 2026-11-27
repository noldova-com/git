/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createEnvironmentInjector, EnvironmentInjector, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitDetailView } from "../../../src/app/services/git-detail-view.ts";

function viewOf(context: FakeWindowPartContext): GitDetailView<number> {
  return new GitDetailView<number>(context, "notes.detail", "selected", t => `Note ${t}`);
}

function documentInjector(): EnvironmentInjector {
  return createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
}

describe("GitDetailView", () => {
  it("shows the front choice, keeps it while no followed document is in front, empties for a front without one, and once all are destroyed", () => {
    const detail = viewOf(new FakeWindowPartContext());
    const first: WritableSignal<number | null> = signal(7402);
    const second: WritableSignal<number | null> = signal(null);
    const firstActive: WritableSignal<boolean> = signal(true);
    const secondActive: WritableSignal<boolean> = signal(false);
    const seen: (readonly unknown[])[] = [[detail.shown(), detail.front()]];
    const look = (): void => {
      seen.push([detail.shown(), detail.front()]);
    };
    const firstDocument = documentInjector();
    const secondDocument = documentInjector();
    detail.follow(first, firstActive, firstDocument);
    detail.follow(second, secondActive, secondDocument);
    look();
    firstActive.set(false);
    look();
    secondActive.set(true);
    look();
    second.set(7490);
    look();
    first.set(7521);
    secondActive.set(false);
    look();
    secondDocument.destroy();
    look();
    firstActive.set(true);
    look();
    firstDocument.destroy();
    look();

    expect(seen).toEqual([[null, undefined], [7402, 7402], [7402, undefined], [null, null], [7490, 7490], [7490, undefined], [7490, undefined],
      [7521, 7521], [null, undefined]]);
  });

  it("shows nothing while the followed documents it first hears of are behind another kind of document", () => {
    const detail = viewOf(new FakeWindowPartContext());
    detail.follow(signal(7402), signal(false), documentInjector());

    expect([detail.shown(), detail.front()]).toEqual([null, undefined]);
  });

  it("brings the view forward, titled, when a followed document comes to the front with a choice or shows its first one there, never for a choice read again, and never with the focus",
    () => {
      const context = new FakeWindowPartContext();
      const detail = viewOf(context);
      const choice: WritableSignal<number | null> = signal(null);
      const active: WritableSignal<boolean> = signal(true);
      detail.follow(choice, active, documentInjector());
      TestBed.tick();
      choice.set(7402);
      TestBed.tick();
      choice.set(7490);
      TestBed.tick();
      active.set(false);
      TestBed.tick();
      active.set(true);
      TestBed.tick();
      choice.set(null);
      TestBed.tick();
      choice.set(7511);
      TestBed.tick();

      expect([context.callsOf("openView"), context.callsOf("showView")]).toEqual([[["notes.detail", "selected", "Note 7402"], ["notes.detail", "selected", "Note 7490"],
        ["notes.detail", "selected", "Note 7511"]], []]);
    });

  it("opens the view for each choice the person makes, titled for it, also while it is open, and follows the person closing its instance", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const stop = detail.listen();
    const open: boolean[] = [detail.isOpen()];
    detail.showInFront(7490);
    detail.showInFront(7511);
    context.raiseViewClosed("notes.detail", "other");
    open.push(detail.isOpen());
    context.raiseViewClosed("notes.detail", "selected");
    open.push(detail.isOpen());
    const listening: number = context.activeCallsOf("onViewClosed").length;
    stop();

    expect([context.callsOf("openView"), context.callsOf("showView"), listening, context.activeCallsOf("onViewClosed").length, open])
      .toEqual([[["notes.detail", "selected", "Note 7490"], ["notes.detail", "selected", "Note 7511"]], [], 1, 0, [false, true, false]]);
  });

  it("doesn't open the view again when the document in front shows the choice the person just made there", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const choice: WritableSignal<number | null> = signal(null);
    detail.follow(choice, signal(true), documentInjector());
    TestBed.tick();
    choice.set(7402);
    detail.showInFront(7402);
    TestBed.tick();

    expect(context.callsOf("openView")).toEqual([["notes.detail", "selected", "Note 7402"]]);
  });

  it("brings the view forward for the choice of the document in front, and with none leaves it to that document's next choice", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const choice: WritableSignal<number | null> = signal(null);
    detail.bringForward();
    detail.follow(choice, signal(true), documentInjector());
    TestBed.tick();
    detail.bringForward();
    const waiting: number = context.callsOf("openView").length;
    choice.set(7521);
    TestBed.tick();
    detail.bringForward();

    expect([waiting, context.callsOf("openView"), context.callsOf("showView")])
      .toEqual([0, [["notes.detail", "selected", "Note 7521"], ["notes.detail", "selected", "Note 7521"]], []]);
  });

  it("leaves a view made not to come forward with its documents where it is, opening it only for the person's choice", () => {
    const context = new FakeWindowPartContext();
    const detail = new GitDetailView<number>(context, "notes.detail", "selected", t => `Note ${t}`, false);
    detail.follow(signal(7402), signal(true), documentInjector());
    TestBed.tick();
    detail.showInFront(7490);

    expect([detail.shown(), context.callsOf("openView")]).toEqual([7402, [["notes.detail", "selected", "Note 7490"]]]);
  });

  it("brings a view made not to come forward with its documents forward for the next choice once the person asked with none, and only that once", () => {
    const context = new FakeWindowPartContext();
    const detail = new GitDetailView<number>(context, "notes.detail", "selected", t => `Note ${t}`, false);
    const choice: WritableSignal<number | null> = signal(null);
    detail.follow(choice, signal(true), documentInjector());
    TestBed.tick();
    detail.bringForward();
    const waiting: number = context.callsOf("openView").length;
    choice.set(7521);
    TestBed.tick();
    choice.set(null);
    TestBed.tick();
    choice.set(7530);
    TestBed.tick();

    expect([waiting, detail.shown(), context.callsOf("openView")]).toEqual([0, 7530, [["notes.detail", "selected", "Note 7521"]]]);
  });

  it("gives the group's front back when the person leaves the followed documents, and brings the view forward when they come back", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const active: WritableSignal<boolean> = signal(true);
    detail.follow(signal(7402), active, documentInjector());
    TestBed.tick();
    active.set(false);
    TestBed.tick();
    const returned: number = context.callsOf("returnView").length;
    active.set(true);
    TestBed.tick();
    active.set(false);
    active.set(true);
    TestBed.tick();

    expect([returned, context.callsOf("returnView"), context.callsOf("openView")])
      .toEqual([1, [["notes.detail", "selected"]], [["notes.detail", "selected", "Note 7402"], ["notes.detail", "selected", "Note 7402"]]]);
  });

  it("gives nothing back before the view opened, while the person moves between followed documents, or once they closed the view", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const stop = detail.listen();
    const emptyActive: WritableSignal<boolean> = signal(true);
    detail.follow(signal(null), emptyActive, documentInjector());
    TestBed.tick();
    emptyActive.set(false);
    TestBed.tick();
    const firstActive: WritableSignal<boolean> = signal(true);
    const secondActive: WritableSignal<boolean> = signal(false);
    detail.follow(signal(7402), firstActive, documentInjector());
    detail.follow(signal(7490), secondActive, documentInjector());
    TestBed.tick();
    firstActive.set(false);
    secondActive.set(true);
    TestBed.tick();
    context.raiseViewClosed("notes.detail", "selected");
    secondActive.set(false);
    TestBed.tick();
    stop();

    expect([context.callsOf("returnView"), context.callsOf("openView")]).toEqual([[], [["notes.detail", "selected", "Note 7402"],
      ["notes.detail", "selected", "Note 7490"]]]);
  });

  it("comes back to a document with nothing chosen without bringing the view forward, and brings it once one with a choice is in front again", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const choice: WritableSignal<number | null> = signal(7402);
    const active: WritableSignal<boolean> = signal(true);
    detail.follow(choice, active, documentInjector());
    TestBed.tick();
    active.set(false);
    TestBed.tick();
    choice.set(null);
    active.set(true);
    TestBed.tick();
    active.set(false);
    TestBed.tick();
    choice.set(7490);
    active.set(true);
    TestBed.tick();

    expect([context.callsOf("returnView").length, context.callsOf("openView")])
      .toEqual([2, [["notes.detail", "selected", "Note 7402"], ["notes.detail", "selected", "Note 7490"]]]);
  });
});

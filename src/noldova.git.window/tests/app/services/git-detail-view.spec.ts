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
    const seen: (readonly [number | null, number | null | undefined])[] = [[detail.shown(), detail.front()]];
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

  it("opens the view, titled for the choice, the first time only, and for a choice again once the person closed its instance, never with the focus", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const stop = detail.listen();
    const open: boolean[] = [detail.isOpen()];
    detail.showOnce(7402);
    detail.showOnce(7490);
    detail.showChosen(7490);
    context.raiseViewClosed("notes.detail", "other");
    open.push(detail.isOpen());
    detail.showChosen(7511);
    context.raiseViewClosed("notes.detail", "selected");
    open.push(detail.isOpen());
    detail.showOnce(7521);
    detail.showChosen(7532);
    open.push(detail.isOpen());
    detail.showChosen(7540);
    const listening: number = context.activeCallsOf("onViewClosed").length;
    stop();

    expect([context.callsOf("openView"), context.callsOf("showView"), listening, context.activeCallsOf("onViewClosed").length, open])
      .toEqual([[["notes.detail", "selected", "Note 7402"], ["notes.detail", "selected", "Note 7532"]], [], 1, 0, [false, true, false, true]]);
  });

  it("opens the view for each choice shown in front, titled for it, also while it is open, never with the focus", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    detail.showInFront(7490);
    detail.showInFront(7511);
    detail.showChosen(7521);

    expect([context.callsOf("openView"), context.callsOf("showView"), detail.isOpen()])
      .toEqual([[["notes.detail", "selected", "Note 7490"], ["notes.detail", "selected", "Note 7511"]], [], true]);
  });

  it("brings the view forward at once for the front document's choice, else at the next choice shown once, and only that next one, never with the focus", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const choice: WritableSignal<number | null> = signal(null);
    detail.follow(choice, signal(true), documentInjector());
    detail.showOnce(7402);
    detail.bringForward();
    const waiting: number = context.callsOf("openView").length;
    detail.showOnce(7490);
    detail.showOnce(7511);
    choice.set(7521);
    detail.bringForward();

    expect([waiting, context.callsOf("openView"), context.callsOf("showView")]).toEqual([1, [["notes.detail", "selected", "Note 7402"],
      ["notes.detail", "selected", "Note 7490"], ["notes.detail", "selected", "Note 7521"]], []]);
  });

  it("keeps an ask to bring the view forward for the document in front then, or the first one to come to the front, and drops it once another one does", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const firstActive: WritableSignal<boolean> = signal(true);
    detail.follow(signal(null), firstActive, documentInjector());
    detail.showOnce(7402);
    detail.bringForward();
    firstActive.set(false);
    const secondActive: WritableSignal<boolean> = signal(true);
    detail.follow(signal(null), secondActive, documentInjector());
    detail.showOnce(7490);
    secondActive.set(false);
    TestBed.tick();
    detail.bringForward();
    const thirdActive: WritableSignal<boolean> = signal(false);
    detail.follow(signal(null), thirdActive, documentInjector());
    TestBed.tick();
    thirdActive.set(true);
    TestBed.tick();
    detail.showOnce(7511);
    detail.bringForward();
    const fourthActive: WritableSignal<boolean> = signal(false);
    detail.follow(signal(null), fourthActive, documentInjector());
    TestBed.tick();
    thirdActive.set(false);
    fourthActive.set(true);
    TestBed.tick();
    detail.showOnce(7521);

    expect(context.callsOf("openView")).toEqual([["notes.detail", "selected", "Note 7402"], ["notes.detail", "selected", "Note 7511"]]);
  });

  it("keeps an ask to bring the view forward when the document it belongs to leaves the front and comes back", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const active: WritableSignal<boolean> = signal(true);
    detail.follow(signal(null), active, documentInjector());
    detail.showOnce(7402);
    detail.bringForward();
    TestBed.tick();
    active.set(false);
    TestBed.tick();
    active.set(true);
    TestBed.tick();
    detail.showOnce(7490);

    expect(context.callsOf("openView")).toEqual([["notes.detail", "selected", "Note 7402"], ["notes.detail", "selected", "Note 7490"]]);
  });

  it("opens the view for a choice made before any document showed one", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    detail.showChosen(7490);
    detail.showOnce(7402);

    expect(context.callsOf("openView")).toEqual([["notes.detail", "selected", "Note 7490"]]);
  });

  it("gives the group's front back when the person leaves the followed documents, and brings the view forward when they come back", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const active: WritableSignal<boolean> = signal(true);
    detail.follow(signal(7402), active, documentInjector());
    TestBed.tick();
    detail.showOnce(7402);
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
    const firstActive: WritableSignal<boolean> = signal(true);
    const secondActive: WritableSignal<boolean> = signal(false);
    detail.follow(signal(7402), firstActive, documentInjector());
    detail.follow(signal(7490), secondActive, documentInjector());
    TestBed.tick();
    firstActive.set(false);
    TestBed.tick();
    firstActive.set(true);
    TestBed.tick();
    detail.showOnce(7402);
    firstActive.set(false);
    secondActive.set(true);
    TestBed.tick();
    context.raiseViewClosed("notes.detail", "selected");
    secondActive.set(false);
    TestBed.tick();
    stop();

    expect([context.callsOf("returnView"), context.callsOf("openView")]).toEqual([[], [["notes.detail", "selected", "Note 7402"]]]);
  });

  it("comes back to a document with nothing chosen without bringing the view forward, and brings it once one with a choice is in front again", () => {
    const context = new FakeWindowPartContext();
    const detail = viewOf(context);
    const choice: WritableSignal<number | null> = signal(7402);
    const active: WritableSignal<boolean> = signal(true);
    detail.follow(choice, active, documentInjector());
    TestBed.tick();
    detail.showOnce(7402);
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

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { ActiveConflict, ConflictState } from "@noldova/code.editor.merge.angular";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitConflictDetailComponent } from "../../../../src/app/components/git-conflict-detail/git-conflict-detail.component.ts";
import { GitConflictDetail } from "../../../../src/app/models/git-conflict-detail.ts";
import { GitConflictDetails } from "../../../../src/app/services/git-conflict-details.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";

class RenderedConflict {
  public readonly chosen: WritableSignal<GitConflictDetail | null>;
  public readonly view: ComponentFixture<GitConflictDetailComponent>;

  public constructor(chosen: WritableSignal<GitConflictDetail | null>, view: ComponentFixture<GitConflictDetailComponent>) {
    this.chosen = chosen;
    this.view = view;
  }
}

describe("GitConflictDetailComponent", () => {
  const render = async (first: GitConflictDetail | null): Promise<RenderedConflict> => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.setUp(context);
    const chosen: WritableSignal<GitConflictDetail | null> = signal(first);
    GitConflictDetails.of(context).follow(chosen, signal(true), TestBed.inject(Injector));
    const view: ComponentFixture<GitConflictDetailComponent> = TestBed.createComponent(GitConflictDetailComponent);
    view.componentRef.setInput("instance", "selected");
    view.autoDetectChanges();
    await view.whenStable();
    return new RenderedConflict(chosen, view);
  };

  const textsOf = (view: ComponentFixture<GitConflictDetailComponent>, selector: string): readonly string[] => {
    const element: HTMLElement = view.nativeElement;
    return [...element.querySelectorAll(selector)].map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
  };

  it("shows the active conflict, where it is and its base, and that no resolved file keeps a conflict marker", async () => {
    const { view } = await render(new GitConflictDetail(new ActiveConflict(1, 3, "const base = 0;\n", ConflictState.Unresolved, 9, 13), null, [], null));

    expect([textsOf(view, ".detail-title"), textsOf(view, ".detail-lines"), textsOf(view, ".checklist-title"), textsOf(view, ".base-text").length,
      textsOf(view, ".markers .check-text"), textsOf(view, ".detail-note")]).toEqual([
      ["Conflict 2 of 3"], ["lines 10 to 14"], ["Base", "Before you commit"], 1, ["No conflict markers left in resolved files"],
      ["Resolutions are remembered (rerere), so the same conflict resolves itself the next time it comes up."]
    ]);
  });

  it("says when a conflict has no base, on one line, and names the resolved files that keep a conflict marker", async () => {
    const { chosen, view } = await render(new GitConflictDetail(new ActiveConflict(0, 1, null, ConflictState.Unresolved, 4, 4), null, ["src/x.ts"], null));
    const one: readonly (readonly string[])[] = [textsOf(view, ".detail-lines"), textsOf(view, ".base-note"), textsOf(view, ".markers .check-text")];

    chosen.set(new GitConflictDetail(null, null, ["src/x.ts", "src/y.ts", "src/z.ts"], null));
    await view.whenStable();

    expect([one, textsOf(view, ".detail-title"), textsOf(view, ".markers .check-text")]).toEqual([
      [["line 5"], ["No base: both sides added this text."], ["Conflict markers left in src/x.ts"]],
      [],
      ["Conflict markers left in src/x.ts, src/y.ts and src/z.ts"]
    ]);
  });

  it("says why the check for conflict markers failed, and says nothing of markers before the check answers", async () => {
    const { chosen, view } = await render(new GitConflictDetail(null, null, null, "Git couldn't read src/x.ts."));
    const failed: readonly string[] = textsOf(view, ".markers .check-text");

    chosen.set(new GitConflictDetail(null, null, null, null));
    await view.whenStable();

    expect([failed, textsOf(view, ".markers"), textsOf(view, ".checklist-title")])
      .toEqual([["The check for conflict markers failed: Git couldn't read src/x.ts."], [], ["Before you commit"]]);
  });

  it("says how to see a conflict while the document in front shows no file", async () => {
    const { view } = await render(null);

    expect([textsOf(view, ".empty-view"), textsOf(view, ".detail-title")]).toEqual([["Open the conflicts of a merge or rebase to see the conflict here."], []]);
  });
});

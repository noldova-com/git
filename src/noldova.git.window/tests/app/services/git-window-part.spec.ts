/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding, DockSide, type ViewContribution } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitViewComponent } from "../../../src/app/components/git-view/git-view.component.ts";
import { GitWindowPart } from "../../../src/app/services/git-window-part.ts";

describe("GitWindowPart", () => {
  it("reconnects only while it is active", async () => {
    const part: GitWindowPart = new GitWindowPart();
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    context.beStrict();
    context.allow("registerView");

    const answers: boolean[] = [await part.reconnectAsync()];
    await part.activateAsync(context);
    answers.push(await part.reconnectAsync(), part.isActive);
    await part.deactivateAsync();
    answers.push(await part.reconnectAsync(), part.isActive);

    expect(answers).toEqual([false, true, true, false, false]);
    expect(context.calls.map(t => t.member)).toEqual(["registerView"]);
  });

  it("registers the Git view in the right dock's first group at order 20, shown by default, with no padding, loading the view's component", async () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const views: ViewContribution[] = [];
    context.answer("registerView", t => {
      views.push(t);
    });
    context.beStrict();

    await new GitWindowPart().activateAsync(context);
    const [view] = views;

    expect([view?.name, view?.title, view?.icon, view?.defaultSide, view?.isShownByDefault, view?.padding, view?.defaultGroup, view?.defaultOrder])
      .toEqual(["git.view", "Git", "account_tree", DockSide.Right, true, ContentPadding.None, 0, 20]);
    expect(await view?.loadComponent()).toBe(GitViewComponent);
    expect(context.callsOf("registerView")).toEqual([[view]]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { GitNames } from "@noldova/git.protocol";
import { DefaultTheme, type ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, it } from "vitest";
import { page } from "vitest/browser";

import { BranchDialog } from "../../../fixtures/branch-dialog.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const screenshots: string = "../../../../../../_build/azure-devops-window/screenshots";

function box(root: Element, selector: string): DOMRect {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement))
    throw new Error(`The dialog has no ${selector}.`);
  return element.getBoundingClientRect();
}

function boxes(root: Element, selector: string): readonly DOMRect[] {
  return [...root.querySelectorAll(selector)].map(t => t.getBoundingClientRect());
}

function px(rem: number): number {
  return AppearanceFixture.toPixels(rem);
}

describe("AzureDevOpsBranchComponent in the kit's look", () => {
  afterEach(() => {
    BranchDialog.closeAll();
    AppearanceFixture.reset();
  });

  it.each(AppearanceFixture.modes)("lines the name, the base and the choices up with the dialog's text, in the kit's normal width, in %s mode", async (mode: ThemeMode) => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const dialog = await new BranchDialog().openAsync();
    const root = dialog.element;
    const frame = dialog.find("nol-dialog", HTMLElement);

    const body = box(root, ".nol-git-azure-devops-branch");
    const line = box(root, ".nol-git-azure-devops-branch-line");
    const [nameLabel, baseLabel] = boxes(root, ".nol-git-azure-devops-branch-label");
    const field = box(root, ".nol-git-azure-devops-branch-field input");
    const base = box(root, ".nol-git-azure-devops-branch-base");
    const [patternNote, baseNote] = boxes(root, ".nol-git-azure-devops-branch-note");
    const [link, active, prefix, push] = boxes(root, "nol-checkbox");
    const [nameGroup, baseGroup] = boxes(root, ".nol-git-azure-devops-branch-group");
    if (nameLabel === undefined || baseLabel === undefined || patternNote === undefined || baseNote === undefined || nameGroup === undefined || baseGroup === undefined
      || link === undefined || active === undefined || prefix === undefined || push === undefined)
      throw new Error("The dialog lacks a label, a note, a group or a choice.");
    AppearanceFixture.expectPixels(frame.getBoundingClientRect().width, px(27.5));
    for (const left of [line.left, nameLabel.left, field.left, patternNote.left, baseLabel.left, base.left, baseNote.left, link.left, active.left, prefix.left, push.left])
      AppearanceFixture.expectPixels(left, body.left);
    AppearanceFixture.expectPixels(field.right, body.right);
    AppearanceFixture.expectPixels(base.right, body.right);
    AppearanceFixture.expectPixels(field.top - nameLabel.bottom, px(0.25));
    AppearanceFixture.expectPixels(patternNote.top - field.bottom, px(0.25));
    AppearanceFixture.expectPixels(base.top - baseLabel.bottom, px(0.25));
    AppearanceFixture.expectPixels(baseNote.top - base.bottom, px(0.25));
    AppearanceFixture.expectPixels(nameGroup.top - line.bottom, px(0.75));
    AppearanceFixture.expectPixels(baseGroup.top - nameGroup.bottom, px(0.75));
    AppearanceFixture.expectPixels(link.top - baseGroup.bottom, px(0.75));
    AppearanceFixture.expectPixels(active.top - link.bottom, px(0.5));
    AppearanceFixture.expectPixels(prefix.top - active.bottom, px(0.5));
    AppearanceFixture.expectPixels(push.top - prefix.bottom, px(0.5));
    await page.screenshot({ element: frame, path: `${screenshots}/branch-${mode}.png` });

    dialog.requests.fail(GitNames.createBranchAtMethod, new WindowFailure("Not connected."));
    await dialog.clickAsync("Create and switch");
    const failure = box(root, ".nol-git-azure-devops-branch-failure");
    const moved = box(root, ".nol-git-azure-devops-branch");
    const choices = box(root, ".nol-git-azure-devops-branch-choices");
    AppearanceFixture.expectPixels(failure.left, moved.left);
    AppearanceFixture.expectPixels(failure.top - choices.bottom, px(0.75));
    await page.screenshot({ element: frame, path: `${screenshots}/branch-failed-${mode}.png` });
  });
});

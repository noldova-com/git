/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createEnvironmentInjector, EnvironmentInjector, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRebaseCommit, GitRebasePlan } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitRebasePreviewComponent } from "../../../../src/app/components/git-rebase-preview/git-rebase-preview.component.ts";
import { GitRebasePreview, type IGitRebaseStop } from "../../../../src/app/models/git-rebase-preview.ts";
import { GitRebasePreviews } from "../../../../src/app/services/git-rebase-previews.ts";
import { GitResolving } from "../../../../src/app/services/git-resolving.ts";

const onto: string = "0123456789abcdef0123456789abcdef01234567";
const base: string = "fedcba9876543210fedcba9876543210fedcba98";
const commits: readonly GitRebaseCommit[] = [new GitRebaseCommit("a".repeat(40), "Read the log as a stream", null)];
const stop: IGitRebaseStop = { step: 2, paths: ["src/log.ts", "src/lane.ts"], commit: "ccccccc" };

function previewOf(pushed: boolean, stopAt: IGitRebaseStop | null, stopped: string | null): GitRebasePreview {
  return new GitRebasePreview("/work/git", new GitRebasePlan("feature/graph", onto, base, 1, commits, ["feature/minimap"], pushed), "main", 2,
    ["feature/minimap"], ["Draw lanes on a canvas", "Read the log as a stream"], stopAt, stopped);
}

class Screen {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly fixture: ComponentFixture<GitRebasePreviewComponent>;

  public constructor(choice: WritableSignal<GitRebasePreview | null>) {
    this.context.allow("openDocument");
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    const document = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    onTestFinished(() => document.destroy());
    GitRebasePreviews.of(this.context).follow(choice, signal(true), document);
    this.fixture = TestBed.createComponent(GitRebasePreviewComponent);
    this.fixture.componentRef.setInput("instance", "selected");
    this.fixture.detectChanges();
  }

  public get element(): HTMLElement {
    const element: unknown = this.fixture.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The view isn't open.");
    return element;
  }

  public get button(): HTMLButtonElement {
    const button = this.element.querySelector(".show-conflict");
    if (!(button instanceof HTMLButtonElement))
      throw new Error("The view has no Show the conflict button.");
    return button;
  }

  public texts(selector: string): readonly string[] {
    return [...this.element.querySelectorAll(selector)].map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
  }
}

describe("GitRebasePreviewComponent", () => {
  it("says how to see a preview while no rebase document is open", () => {
    const screen = new Screen(signal(null));

    expect([screen.texts(".empty-view"), screen.element.querySelector(".preview")]).toEqual([["Open an interactive rebase to preview it."], null]);
  });

  it("shows the branch now, from its base onto its target, and after, with the stacked branches it moves and the subjects it ends with", () => {
    const screen = new Screen(signal(previewOf(false, null, null)));

    expect([screen.texts(".now .node"), screen.texts(".after .node"), screen.element.querySelector(".stop-card"), screen.texts(".pushed")]).toEqual([
      ["feature/graph", "2 commits from fedcba9", "main1 commit ahead of the base"],
      ["feature/minimapmoved too", "feature/graph", "Draw lanes on a canvas", "Read the log as a stream", "main0123456"], null, []]);
  });

  it("says a pushed branch will need a force push with lease", () => {
    const screen = new Screen(signal(previewOf(true, null, null)));

    expect(screen.texts(".pushed")).toEqual(["The branch has been pushed. After the rebase, Push will offer a force push with lease, which refuses if someone else pushed meanwhile."]);
  });

  it("names the step that stops on a conflict, its files and commit, and keeps Show the conflict unavailable until the rebase stops there", () => {
    const screen = new Screen(signal(previewOf(false, stop, null)));

    screen.button.click();

    expect([screen.texts(".stop-title"), screen.texts(".stop-text"), screen.button.disabled, screen.button.title, screen.context.callsOf("openDocument")]).toEqual([
      ["warningStep 2 will stop on a conflict"],
      ["src/log.ts, src/lane.ts changed on main. The same lines change in ccccccc. You can resolve it when the rebase stops, or move or drop this commit."],
      true, "Opens the conflict once the rebase stops on it", []]);
  });

  it("opens the folder's conflict screen at the stopped file once the rebase stopped on it", () => {
    onTestFinished(() => GitResolving.opened.set(new Map()));
    const screen = new Screen(signal(previewOf(false, stop, "src/log.ts")));

    screen.button.click();

    expect([screen.button.disabled, screen.button.title, screen.context.callsOf("openDocument"), GitResolving.pathOf("/work/git")]).toEqual([false,
      "Show the conflict now", [["git.conflicts", "/work/git", "Conflicts: git"]], "src/log.ts"]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createEnvironmentInjector, EnvironmentInjector, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitWorkspaceAcrossComponent } from "../../../../src/app/components/git-workspace-across/git-workspace-across.component.ts";
import { GitWorkspaceAcrossViewComponent } from "../../../../src/app/components/git-workspace-across-view/git-workspace-across-view.component.ts";
import type { IGitPullRequests } from "../../../../src/app/interfaces/i-git-pull-requests.ts";
import type { IGitWorkspaceAcrossPage } from "../../../../src/app/interfaces/i-git-workspace-across-page.ts";
import { GitBranchPullRequest } from "../../../../src/app/models/git-branch-pull-request.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitRowPullRequest } from "../../../../src/app/models/git-row-pull-request.ts";
import { GitWorkspaceAcross } from "../../../../src/app/models/git-workspace-across.ts";
import { GitWorkspaceReview } from "../../../../src/app/models/git-workspace-review.ts";
import { GitWorkspaceReviews } from "../../../../src/app/models/git-workspace-reviews.ts";
import { GitWorkspaceRow } from "../../../../src/app/models/git-workspace-row.ts";
import { GitWorkspaceAcrossViews } from "../../../../src/app/services/git-workspace-across-views.ts";

class RecordedPage implements IGitWorkspaceAcrossPage {
  public readonly calls: (readonly unknown[])[] = [];

  public open(folder: string): void {
    this.calls.push(["open", folder]);
  }

  public openPullRequest(row: GitWorkspaceRow, pullRequest: GitPullRequestRow): void {
    this.calls.push(["openPullRequest", row, pullRequest]);
  }

  public openReview(review: GitWorkspaceReview): void {
    this.calls.push(["openReview", review]);
  }

  public readWritten(folders: readonly string[]): void {
    this.calls.push(["readWritten", folders]);
  }
}

const row: GitWorkspaceRow = new GitWorkspaceRow("/work/git", signal(null), signal(GitBranchPullRequest.none(0, 0, 0)), signal(false));
const pullRequest: GitPullRequestRow = new GitPullRequestRow("12", "#12", "Change 12", "https://github.com/example-owner/git/pull/12", false, 0, 0, 0, 0, "feature/x");
const host: IGitPullRequests = { claims: () => true, hostName: "GitHub", signInPage: "github.account", listFor: () => signal(null), refresh: () => undefined };

class Screen {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly fixture: ComponentFixture<GitWorkspaceAcrossViewComponent>;

  public constructor(choice: WritableSignal<GitWorkspaceAcross | null>) {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    const document = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    onTestFinished(() => document.destroy());
    GitWorkspaceAcrossViews.of(this.context).follow(choice, signal(true), document);
    this.fixture = TestBed.createComponent(GitWorkspaceAcrossViewComponent);
    this.fixture.componentRef.setInput("instance", "selected");
    this.fixture.detectChanges();
  }

  public get element(): HTMLElement {
    const element: unknown = this.fixture.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The view isn't open.");
    return element;
  }

  public get panels(): readonly GitWorkspaceAcrossComponent[] {
    return this.fixture.debugElement.queryAll(By.directive(GitWorkspaceAcrossComponent)).map(t => t.injector.get(GitWorkspaceAcrossComponent));
  }
}

describe("GitWorkspaceAcrossViewComponent", () => {
  it("says how to see the repositories together while no workspace page is open", () => {
    const screen = new Screen(signal(null));

    expect([screen.element.querySelector(".empty-view")?.textContent?.trim(), screen.panels.length])
      .toEqual(["Open a workspace to see its repositories together here.", 0]);
  });

  it("draws no background of its own, so it sits on the dock's like the other views", () => {
    const screen = new Screen(signal(null));

    expect(getComputedStyle(screen.element).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("shows the page's repositories, runs and reviews in one labelled panel", () => {
    const reviews = new GitWorkspaceReviews([], true);
    const screen = new Screen(signal(new GitWorkspaceAcross("workspace-1", [row], [], reviews, new RecordedPage())));
    const panel: GitWorkspaceAcrossComponent | undefined = screen.panels[0];

    expect([screen.panels.length, screen.element.querySelector(".across")?.getAttribute("aria-label"), panel?.rows(), panel?.runs(), panel?.reviews()])
      .toEqual([1, "Across repositories", [row], [], reviews]);
  });

  it("passes what the person opens or writes in the panel to the page it shows", () => {
    const page = new RecordedPage();
    const screen = new Screen(signal(new GitWorkspaceAcross("workspace-1", [row], [], new GitWorkspaceReviews([], false), page)));
    const review = new GitWorkspaceReview(pullRequest, "/work/git", "git", host);
    const panel: GitWorkspaceAcrossComponent | undefined = screen.panels[0];

    panel?.repositoryOpened.emit("/work/git");
    panel?.pullRequestOpened.emit(new GitRowPullRequest(row, pullRequest));
    panel?.reviewOpened.emit(review);
    panel?.written.emit(["/work/git"]);

    expect(page.calls).toEqual([["open", "/work/git"], ["openPullRequest", row, pullRequest], ["openReview", review], ["readWritten", ["/work/git"]]]);
  });

  it("starts a fresh panel for another page rather than keeping the last page's", () => {
    const choice: WritableSignal<GitWorkspaceAcross | null> = signal(new GitWorkspaceAcross("workspace-1", [row], [], new GitWorkspaceReviews([], false),
      new RecordedPage()));
    const screen = new Screen(choice);
    const first: GitWorkspaceAcrossComponent | undefined = screen.panels[0];

    choice.set(new GitWorkspaceAcross("workspace-2", [row], [], new GitWorkspaceReviews([], false), new RecordedPage()));
    screen.fixture.detectChanges();

    expect([screen.panels.length, screen.panels[0] === first]).toEqual([1, false]);
  });
});

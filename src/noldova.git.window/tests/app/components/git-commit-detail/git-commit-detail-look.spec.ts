/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { DiffFile, FileChange, GitCommit, GitCommitDetail, GitCommitSignature, GitDiff, GitGraphCommit, GitPrediction, GitRemote, LineKind, PredictionOutcome,
  RemoteTransport, SignatureState } from "@noldova/git.protocol";
import { DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import type {} from "@vitest/browser-playwright";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";

import { GitPullRequestState } from "../../../../src/app/enums/git-pull-request-state.ts";
import { GitBranchPullRequest } from "../../../../src/app/models/git-branch-pull-request.ts";
import { GitCommitComments } from "../../../../src/app/models/git-commit-comments.ts";
import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitPullRequestRow } from "../../../../src/app/models/git-pull-request-row.ts";
import { GitPullRequests } from "../../../../src/app/services/git-pull-requests.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { FixtureLine, GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitLayout } from "../../../fixtures/git-layout.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";
import { RightEdge } from "../../../fixtures/right-edge.fixture.ts";

describe("GitCommitDetailComponent in the kit's look", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
  const box = (element: Element | null): DOMRect => element?.getBoundingClientRect() ?? new DOMRect();
  const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"),
    "author@example.com", []);
  const body: string = "Why it changed: the history stopped at a rename, so read the log with --follow and keep each entry's path, so the history and blame "
    + "reach the older path.";

  const resolve = (color: string): string => {
    const probe: HTMLSpanElement = document.createElement("span");
    probe.style.color = color;
    document.body.append(probe);
    const resolved: string = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  };

  afterEach(async () => {
    try {
      (await AppearanceFixture.parkPointerAsync()).remove();
    }
    finally {
      AppearanceFixture.reset();
    }
  });

  it.each(AppearanceFixture.modes)("sets the message at 1.6 lines, says who authored and committed it on one line, mutes the predictions, and marks a verified signature in the status colour, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), body, "Other Person", "other@example.com", "2026-11-21T09:30:00Z", false).toJson(),
      "git.predict": new GitPrediction(PredictionOutcome.Clean, []).toJson(),
      "git.commitSignature": new GitCommitSignature("c".repeat(40), SignatureState.Verified, "Other Person <other@example.com>", "SHA256:abc").toJson()
    }, ".detail", [provideMarkdown()]);
    view.element.style.width = "32rem";
    view.element.style.height = "40rem";
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await view.waitForAsync(".message p");
    await view.waitForAsync(".committed");
    await view.waitForAsync(".prediction");
    await view.waitForAsync(".signature");
    await view.fixture.whenStable();

    const paragraph: HTMLElement = view.find(".message p");
    const when: HTMLElement = view.find(".when");
    expect(getComputedStyle(paragraph).lineHeight).toBe("20.8px");
    expect(Math.round(box(paragraph).height / 20.8)).toBeGreaterThanOrEqual(2);
    expect([view.find(".committed").getClientRects().length, rem(box(when).height)]).toEqual([1, rem(parseFloat(getComputedStyle(when).lineHeight))]);
    expect([...new Set(view.all(".prediction").map(t => getComputedStyle(t).color))]).toEqual([resolve("var(--nol-text-muted)")]);

    const signature: HTMLElement = view.find(".signature");
    const icon: DOMRect = box(signature.querySelector(".signature-icon"));
    const text: DOMRect = box(signature.querySelector(".signature-text"));
    expect([rem(box(signature).top - box(view.find(".author")).bottom), rem(icon.width), rem(icon.height), rem(text.left - icon.right), rem(icon.left - box(view.find(".author")).left)])
      .toEqual([0.5, 0.875, 0.875, 0.375, 0]);
    expect([getComputedStyle(signature).fontSize, getComputedStyle(signature.querySelector(".signature-icon") ?? signature).color])
      .toEqual(["12px", resolve("var(--nol-status-ok)")]);
    expect(Math.abs(icon.top + icon.height / 2 - (text.top + text.height / 2))).toBeLessThan(1);

    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("draws no signature line for an unsigned commit, the parents one people gap under the author, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.predict": new GitPrediction(PredictionOutcome.Clean, []).toJson(),
      "git.commitSignature": new GitCommitSignature("c".repeat(40), SignatureState.None, null, null).toJson()
    }, ".detail", [provideMarkdown()]);
    view.element.style.width = "32rem";
    await view.waitForAsync(".parents");
    await view.untilAsync(() => view.requested("git.commitSignature").length === 1 && view.requested("git.commitDetail").length === 1);
    await view.fixture.whenStable();

    expect([view.all(".signature").length, rem(box(view.find(".parents")).top - box(view.find(".author")).bottom)]).toEqual([0, 0.5]);
    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-unsigned-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("ends a renamed file's row with its letter and similarity on one line, at the same end as a plain letter, at the dock's width, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    const renamed: DiffFile = new DiffFile("b.ts", undefined, "a.ts", undefined, FileChange.Renamed, "100644", "100644", false, null, [], false, 92);
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": new GitDiff([renamed, ...GitFixtures.diff("c.ts", new FixtureLine(LineKind.Added, "one")).files], 0, 0, false).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.predict": new GitPrediction(PredictionOutcome.Clean, []).toJson()
    }, ".detail", [provideMarkdown()]);
    view.element.style.width = "25rem";
    await view.untilAsync(() => view.all(".file-row .letter").length === 2);
    await view.fixture.whenStable();
    const [first, second] = view.all(".file-row:not(.folder)");
    const letterOf = (row: HTMLElement | undefined): HTMLElement | null => row?.querySelector<HTMLElement>(".letter") ?? null;
    const ends: readonly number[] = [first, second].map(t => rem(box(t ?? null).right - box(letterOf(t)).right));

    expect([letterOf(first)?.textContent, letterOf(second)?.textContent]).toEqual(["R 92%", "M"]);
    expect([letterOf(first)?.getClientRects().length, rem(box(letterOf(first)).height), ends]).toEqual([1, rem(box(letterOf(second)).height), [0.5, 0.5]]);
    expect(box(letterOf(first)).left).toBeGreaterThanOrEqual(box(first?.querySelector(".grow") ?? null).right);
    const detail: HTMLElement = view.find(".detail");
    const edge: number = RightEdge.contentOf(detail);
    expect([...RightEdge.missesOf(detail, edge, [".id-row .more"]), ...[first, second].flatMap(t => RightEdge.missesOf(t ?? detail, edge, [".letter"]))]).toEqual([]);
    expect([rem(box(detail).right - box(first ?? null).right), rem(box(second?.querySelector("nol-file-badge") ?? null).left - box(detail).left)]).toEqual([0.25, 0.75]);
    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-similarity-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("lists a predicted conflict's files as badges under its short line at the dock's width, wrapping inside the panel and capped with how many more, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const paths: readonly string[] = ["Sample/src/Services/NoteExports/NoteExportsService.cs", "src/a.ts", "Sample/src/Services/NoteExports/NoteExportsRepository.cs", "README.md", "docs/guide.md"];
    const answers: GitPrediction[] = [new GitPrediction(PredictionOutcome.Conflicts, paths), new GitPrediction(PredictionOutcome.Clean, [])];
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(),
      "git.diff": new GitDiff([...GitFixtures.diff("docs/notes.md", new FixtureLine(LineKind.Added, "one")).files, ...GitFixtures.diff("src/a.ts", new FixtureLine(LineKind.Added, "one")).files], 0, 0,
        false).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.predict": () => answers.shift()?.toJson() ?? new GitPrediction(PredictionOutcome.Clean, []).toJson()
    }, ".detail");
    view.element.style.width = "25rem";
    view.element.style.height = "40rem";
    await view.waitForAsync(".prediction-more");
    await view.waitForAsync("nol-git-diff-files .file-row");
    await view.fixture.whenStable();

    const line: HTMLElement = view.find(".prediction");
    const files: DOMRect = box(view.find(".prediction-files"));
    const chips: readonly HTMLElement[] = view.all(".prediction-file");
    const more: HTMLElement = view.find(".prediction-more");
    const first: DOMRect = box(chips[0] ?? null);
    const second: DOMRect = box(chips[1] ?? null);
    const third: DOMRect = box(chips[2] ?? null);
    expect([view.texts(".prediction"), view.texts(".prediction-file-name"), chips.map(t => t.title), view.texts(".prediction-more")]).toEqual([
      ["Cherry-pick would conflict in five files", "Revert applies cleanly."], ["NoteExportsService.cs", "a.ts", "NoteExportsRepository.cs"], paths.slice(0, 3), ["+2 more"]
    ]);
    expect([line.getClientRects().length, rem(first.top - box(line).bottom), rem(first.left - box(line).left)]).toEqual([1, 0.25, 0]);
    expect(chips.map(t => [rem(box(t).height), box(t).left >= files.left, box(t).right <= files.right])).toEqual([[1.25, true, true], [1.25, true, true], [1.25, true, true]]);
    expect([rem(second.left - first.right), first.top === second.top, third.top > first.top, rem(third.top - first.bottom), rem(third.left - files.left)])
      .toEqual([0.25, true, true, 0.25, 0]);
    expect(chips.map(t => {
      const badge: DOMRect = box(t.querySelector("nol-file-badge"));
      const name: DOMRect = box(t.querySelector(".prediction-file-name"));
      return [rem(badge.left - box(t).left), rem(name.left - badge.right), Math.abs(badge.top + badge.height / 2 - (box(t).top + box(t).height / 2)) < 1];
    })).toEqual([[0.375, 0.25, true], [0.375, 0.25, true], [0.375, 0.25, true]]);
    expect(chips.map(t => [t.tagName, getComputedStyle(t).backgroundColor, getComputedStyle(t).fontSize, getComputedStyle(t.querySelector(".prediction-file-name") ?? t).color]))
      .toEqual([["SPAN", "rgba(0, 0, 0, 0)", "12px", resolve("var(--nol-text-strong)")], ["BUTTON", "rgba(0, 0, 0, 0)", "12px", resolve("var(--nol-text-strong)")],
        ["SPAN", "rgba(0, 0, 0, 0)", "12px", resolve("var(--nol-text-strong)")]]);
    expect([rem(box(more).left - third.right), Math.abs(box(more).top + box(more).height / 2 - (third.top + third.height / 2)) < 1, getComputedStyle(more).color])
      .toEqual([0.25, true, resolve("var(--nol-text-muted)")]);

    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-prediction-files-${mode}.png` });

    const folder: HTMLElement = view.find("nol-git-diff-files .file-row.folder[title='src']");
    folder.click();
    await view.untilAsync(() => folder.getAttribute("aria-expanded") === "false");
    view.element.style.height = "12rem";
    view.element.style.overflow = "auto";
    view.find<HTMLButtonElement>("button.prediction-file").click();
    const fileRow = (): HTMLElement | null => view.element.querySelector<HTMLElement>("nol-git-diff-files .file-row[title='src/a.ts']");
    await view.untilAsync(() => fileRow()?.getAttribute("aria-expanded") === "true");
    await view.untilAsync(() => box(fileRow()).bottom <= box(view.element).bottom && box(fileRow()).top >= box(view.element).top);
    expect([folder.getAttribute("aria-expanded"), view.all("nol-git-diff-files .diff").length]).toEqual(["true", 1]);
  });

  it.each(AppearanceFixture.modes)("pins the pull request card to the panel's foot as a raised card, its title strong and a merge in the status colour, in %s mode", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    const row: GitPullRequestRow = new GitPullRequestRow("pull-212", "#212", "Follow renames", "https://example.invalid/pull/212", false, 2, 6, 0, 0, "fix/renames");
    onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
      claims: () => true, hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined,
      commitFor: () => signal(GitBranchPullRequest.of(row, GitPullRequestState.Merged, false))
    }));
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { remote: new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https) }).toJson(),
      "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
    }, ".detail .files");
    view.element.style.width = "32rem";
    view.element.style.height = "40rem";
    await view.waitForAsync(".pull-request-note");
    await view.fixture.whenStable();

    const card: HTMLElement = view.find(".pull-request");
    const style: CSSStyleDeclaration = getComputedStyle(card);
    const head: DOMRect = box(card.querySelector(".pull-request-head"));
    const icon: DOMRect = box(card.querySelector(".pull-request-icon"));
    const title: HTMLElement = card.querySelector<HTMLElement>(".pull-request-title") ?? card;
    const note: HTMLElement = card.querySelector<HTMLElement>(".pull-request-note") ?? card;
    const panel: DOMRect = box(view.element);
    const files: DOMRect = box(view.find(".files"));
    expect([rem(panel.bottom - box(card).bottom), rem(box(card).left - panel.left), rem(panel.right - box(card).right), box(card).width === files.width])
      .toEqual([0.75, 0.75, 0.75, true]);
    expect([style.paddingTop, style.paddingLeft, style.borderTopLeftRadius].map(t => rem(parseFloat(t)))).toEqual([0.75, 0.75, 0.375]);
    expect([style.borderTopWidth, style.borderTopColor, style.backgroundColor]).toEqual(["1px", resolve("var(--nol-card-border)"), resolve("var(--nol-raised)")]);
    expect([rem(box(note).top - head.bottom), rem(box(title).left - icon.right), rem(icon.left - box(card).left - 1), rem(head.top - box(card).top - 1)])
      .toEqual([0.375, 0.375, 0.75, 0.75]);
    expect([getComputedStyle(title).color, getComputedStyle(title).fontWeight, getComputedStyle(card.querySelector(".pull-request-state") ?? card).color, getComputedStyle(note).color,
      getComputedStyle(note).fontSize]).toEqual([resolve("var(--nol-text-strong)"), "500", resolve("var(--nol-status-ok)"), resolve("var(--nol-text-muted)"), "12px"]);

    await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-pull-request-${mode}.png` });
  });

  it.each(AppearanceFixture.modes)("ends the card's note with the review comments, on its line in its muted small text, with no row above the card, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      const row: GitPullRequestRow = new GitPullRequestRow("pull-212", "#212", "Follow renames", "https://example.invalid/pull/212", false, 2, 6, 0, 0, "fix/renames");
      onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
        claims: () => true, hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined,
        commitFor: () => signal(GitBranchPullRequest.of(row, GitPullRequestState.Merged, false)),
        commentsFor: () => signal(new GitCommitComments(3, false, "https://example.invalid/pull/212#discussion_r7"))
      }));
      onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
      GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
      const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
        ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { remote: new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https) }).toJson(),
        "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
        "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
      }, ".detail .files");
      view.element.style.width = "32rem";
      view.element.style.height = "40rem";
      await view.waitForAsync(".pull-request-comments");
      await view.fixture.whenStable();

      const comments: HTMLElement = view.find(".pull-request-comments");
      const note: HTMLElement = view.find(".pull-request-note");
      const card: DOMRect = box(view.find(".pull-request"));
      const panel: DOMRect = box(view.element);
      const line: DOMRect = box(comments);
      expect([view.all(".comments").length, rem(panel.bottom - card.bottom), Math.abs(line.top + line.height / 2 - box(note).top - box(note).height / 2) < 1,
        line.right <= box(note).right, line.left > box(note).left]).toEqual([0, 0.75, true, true, true]);
      expect([getComputedStyle(comments).color, getComputedStyle(comments).fontSize, getComputedStyle(comments).lineHeight, getComputedStyle(comments).backgroundColor,
        getComputedStyle(comments).borderTopWidth, getComputedStyle(comments).paddingLeft]).toEqual([getComputedStyle(note).color, "12px", getComputedStyle(note).lineHeight,
        "rgba(0, 0, 0, 0)", "0px", "0px"]);

      await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-comments-${mode}.png` });
    });

  it("fits the right dock's width in the app's narrowest window, 25rem by 27rem, with a signature and a pull request card, and nothing clipped, outside it or overlapping, in dark mode",
    async () => {
      AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Dark);
      const row: GitPullRequestRow = new GitPullRequestRow("pull-212", "#212", "Follow renames", "https://example.invalid/pull/212", false, 2, 6, 0, 0, "fix/renames");
      onTestFinished(GitPullRequests.provide(new FakeWindowPartContext(), {
        claims: () => true, hostName: "GitHub", signInPage: "git-github.account", listFor: () => signal(null), refresh: () => undefined,
        commitFor: () => signal(GitBranchPullRequest.of(row, GitPullRequestState.Merged, false))
      }));
      onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
      GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
      const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
        ...GitFixtures.watching,
        "git.status": GitFixtures.status([], null, { remote: new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https) }).toJson(),
        "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
        "git.commitDetail": new GitCommitDetail("c".repeat(40), body, "Other Person", "other@example.com", "2026-11-21T09:30:00Z", false).toJson(),
        "git.predict": new GitPrediction(PredictionOutcome.Clean, []).toJson(),
        "git.commitSignature": new GitCommitSignature("c".repeat(40), SignatureState.Verified, "Other Person <other@example.com>", "SHA256:abc").toJson()
      }, ".detail", [provideMarkdown()]);
      view.element.style.width = "25rem";
      view.element.style.height = "27rem";
      view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
      await view.waitForAsync(".signature");
      await view.waitForAsync(".pull-request-note");
      await view.waitForAsync(".prediction");
      await view.fixture.whenStable();

      await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-narrow-Dark.png` });
      expect(GitLayout.problemsOf(view.element)).toEqual([]);
    });

  it.each(AppearanceFixture.modes)("ends the commit's actions with Tag here, a gap apart on each line and nothing after it, while the app leaves AI features off, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
      GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
      const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
        ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
        "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
      }, ".detail");
      view.element.style.width = "25rem";
      view.element.style.height = "40rem";
      await view.waitForAsync(".tag-here");
      await view.fixture.whenStable();

      const actions: HTMLElement = view.find(".actions");
      const buttons: readonly DOMRect[] = [...actions.children].map(t => box(t));
      const gaps: readonly number[] = buttons.slice(1).flatMap((t, i) => {
        const before: DOMRect = buttons[i] ?? t;
        return t.top === before.top ? [rem(t.left - before.right)] : [];
      });
      expect([view.all(".explain").length, actions.lastElementChild?.classList.contains("tag-here"), gaps.length > 0, [...new Set(gaps)]]).toEqual([0, true, true, [0.5]]);
      expect(buttons.every(t => t.right <= box(actions).right && t.left >= box(actions).left)).toBe(true);
      await page.screenshot({ element: view.element, path: `${screenshots}/git-commit-detail-no-ai-${mode}.png` });
    });
});

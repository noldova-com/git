/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ApplicationRef, type EnvironmentProviders, ErrorHandler, type Provider, signal, type WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import {
  FailureCode, GitCommit, GitCommitDetail, GitCommitSignature, GitGraphCommit, GitPrediction, GitRef, type JsonValue, LineKind, PredictionAction, PredictionOutcome, RefKind,
  SignatureState
} from "@noldova/git.protocol";
import { DefaultTheme, LinkGesture, LinkReference, LinkReferenceImage, LinkReferenceMatch } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitCommitView } from "../../../../src/app/models/git-commit-view.ts";
import { GitAvatars } from "../../../../src/app/services/git-avatars.ts";
import { GitLinkReferences } from "../../../../src/app/services/git-link-references.ts";
import { GitRebaseTarget, GitRebasing } from "../../../../src/app/services/git-rebasing.ts";
import { GitViewOptions } from "../../../../src/app/services/git-view-options.ts";
import { GitViewing } from "../../../../src/app/services/git-viewing.ts";
import { FixtureLine, GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";
import type { IGitLinkReferences } from "../../../../src/app/interfaces/i-git-link-references.ts";

describe("GitCommitDetailComponent", () => {
  const commitOf = (parents: readonly string[]): GitGraphCommit =>
    new GitGraphCommit(new GitCommit("c".repeat(40), parents, "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), "author@example.com", []);

  const partsOf = (view: GitViewFixture, selector: string): readonly string[] =>
    view.all(selector).map(row => [...row.children].filter(t => t.tagName !== "NOL-FILE-BADGE").map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim()).filter(t => t.length > 0).join(" "));

  const showAsync = async (commit: GitGraphCommit, diff: ReturnType<typeof GitFixtures.diff> | ReturnType<typeof GitFixtures.failure>,
    more: GitCommitDetail | Error = new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false),
    providers: readonly (Provider | EnvironmentProviders)[] = [], answers: Readonly<Record<string, JsonValue | Error>> = {}): Promise<GitViewFixture> => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commit));
    return GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": diff instanceof Error ? diff : diff.toJson(),
      "git.commitDetail": more instanceof Error ? more : more.toJson(),
      "git.cherryPick": null,
      "git.createBranchAt": null,
      "git.createTag": null,
      ...answers
    }, ".detail", providers);
  };

  it("shows the selected commit beside the panel's changes, with its files read against its first parent, and how to choose one once nothing is selected", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40), "e".repeat(40)]),
      GitFixtures.diff("src/services/reader.ts", new FixtureLine(LineKind.Added, "one"), new FixtureLine(LineKind.Added, "two"), new FixtureLine(LineKind.Removed, "old")));
    await view.waitForAsync(".files");

    expect(view.texts(".id-row .mono, .subject, .author .strong")).toEqual(["cccccccccccc", "Follow renames", "Sample Author"]);
    expect(view.texts(".parents .mono")).toEqual(["ddddddd", "eeeeeee"]);
    expect(view.all(".parents button").map(t => t.title)).toEqual(["Show ddddddd in the history", "Show eeeeeee in the history"]);
    expect(view.texts(".files-header .caps, .files-header .added, .files-header .removed")).toEqual(["1 file changed", "+2", "−1"]);
    expect(partsOf(view, ".file-row")).toEqual(["expand_more folder src/services", "reader.ts +2 −1 M"]);
    expect(view.all(".file-row:not(.folder)").map(t => [t.firstElementChild?.tagName, (t.firstElementChild?.getBoundingClientRect().height ?? 0) > 0]))
      .toEqual([["NOL-FILE-BADGE", true]]);
    expect(view.requested("git.diff")).toEqual([{ folder: GitFixtures.folder, scope: { kind: "Range", from: "d".repeat(40), to: "c".repeat(40) } }]);

    expect(view.panel.querySelectorAll(".body")).toHaveLength(1);

    GitViewing.showChanges(GitFixtures.folder);
    await view.waitForAsync(".empty-view");
    expect([view.all(".detail").length, view.texts(".empty-view"), view.panel.querySelectorAll(".body").length])
      .toEqual([0, ["Choose a commit in History to see it here"], 1]);
  });

  it("shows a parent in the history from its link, by its whole id", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40), "e".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".parents button");
    onTestFinished(() => GitViewing.branch.set(null));

    await view.clickAsync(".parents button:nth-of-type(2)");

    expect([GitViewing.branch()?.folder, GitViewing.branch()?.branch, GitViewing.branch()?.commitId]).toEqual([GitFixtures.folder, "", "e".repeat(40)]);
  });

  it("reads a first commit against the empty tree, and closes a folder and lists whole paths on a click", async () => {
    const view: GitViewFixture = await showAsync(commitOf([]), GitFixtures.diff("src/a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".files");

    expect(partsOf(view, ".parents")).toEqual(["Parent None: the first commit"]);
    expect(view.requested("git.diff")).toEqual([{ folder: GitFixtures.folder, scope: { kind: "Range", from: "4b825dc642cb6eb9a060e54bf8d69288fbee4904", to: "c".repeat(40) } }]);
    await view.clickAsync(".folder");
    await view.untilAsync(() => view.all(".file-row").length === 1);
    await view.chooseAsync(".files-header .layout button", "List");
    await view.untilAsync(() => partsOf(view, ".file-row").includes("src/a.ts +1 M"));

    expect(partsOf(view, ".file-row")).toEqual(["src/a.ts +1 M"]);
  });

  it("opens a file's diff from the commit's own read under its row, a step in under its folder, and closes it, without reading again", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]),
      GitFixtures.diff("src/services/reader.ts", new FixtureLine(LineKind.Context, "a"), new FixtureLine(LineKind.Removed, "b"), new FixtureLine(LineKind.Added, "c")));
    await view.waitForAsync(".files");
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);

    await view.clickAsync(".file-row:not(.folder)");
    await view.waitForAsync(".diff");
    const lines: readonly string[] = view.all(".diff > div").map(t => `${t.className}|${t.textContent}`);
    const expanded: string | null = view.find(".file-row:not(.folder)").getAttribute("aria-expanded");
    const inset: number = rem(view.find(".diff").getBoundingClientRect().left - view.find(".files").getBoundingClientRect().left);
    await view.clickAsync(".file-row:not(.folder)");
    await view.untilAsync(() => view.all(".diff").length === 0);

    expect(lines).toEqual(["meta-line|@@ -1,1 +1,2 @@", "| a", "removed-line|-b", "added-line|+c"]);
    expect([expanded, view.find(".file-row:not(.folder)").getAttribute("aria-expanded")]).toEqual(["true", "false"]);
    expect(inset).toBe(1.75);
    expect(view.requested("git.diff")).toHaveLength(1);
  });

  it("shows the message after the subject as Markdown, and who committed it when that isn't the author", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")),
      new GitCommitDetail("c".repeat(40), "Why it changed.\n\n## Checks\n\n- `one`\n- two", "Other Person", "other@example.com", "2026-11-21T09:30:00Z", true),
      [provideMarkdown()]);
    await view.waitForAsync(".message li");
    await view.waitForAsync(".committed");
    const subject: DOMRect = view.find(".subject").getBoundingClientRect();
    const message: DOMRect = view.find(".message").getBoundingClientRect();

    expect([view.texts(".message p")[0], view.texts(".message [role=heading]")[0], view.texts(".message li"), view.texts(".message code")[0], view.texts(".message .muted")[0]])
      .toEqual(["Why it changed.", "Checks", ["one", "two"], "one", "…"]);
    expect(view.find(".message").textContent).not.toContain("##");
    expect([message.top >= subject.bottom, message.left, message.height > subject.height]).toEqual([true, subject.left, true]);
    expect(view.texts(".committed")[0]).toMatch(/^committed by Other Person /u);
    expect(view.requested("git.commitDetail")).toEqual([{ folder: GitFixtures.folder, id: "c".repeat(40) }]);
  });

  it("draws a link a host knows in the message as its chip, asking for the commit's folder, and opens a link through the window", async () => {
    const issue: string = "https://github.com/example-owner/example-repository/issues/5";
    const reference = signal<LinkReference | null>(new LinkReference("example-owner/example-repository#5", "Issue", new LinkReferenceImage("data:,")));
    const folders: string[] = [];
    onTestFinished(GitLinkReferences.provide({
      referencesFor: folder => {
        folders.push(folder);
        return { find: t => t === issue ? reference : null, findText: t => [new LinkReferenceMatch(t.indexOf("#5"), 2, issue)] };
      }
    }));
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")),
      new GitCommitDetail("c".repeat(40), "Fixes #5.", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false), [provideMarkdown()]);
    view.context.answer("openLinkAsync", async () => undefined);
    await view.waitForAsync(".message a[nol-link-reference-chip]");

    await view.clickAsync(".message a[nol-link-reference-chip]");

    expect([view.texts(".message a[nol-link-reference-chip]")[0]?.includes("#5"), [...new Set(folders)]]).toEqual([true, [GitFixtures.folder]]);
    expect(view.context.callsOf("openLinkAsync")).toEqual([[issue, { gesture: LinkGesture.Plain }]]);
  });

  it("reports a message link the window fails to open", async () => {
    const issue: string = "https://github.com/example-owner/example-repository/issues/5";
    onTestFinished(GitLinkReferences.provide({ referencesFor: () => ({ find: () => null, findText: t => [new LinkReferenceMatch(t.indexOf("#5"), 2, issue)] }) }));
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")),
      new GitCommitDetail("c".repeat(40), "Fixes #5.", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false), [provideMarkdown()]);
    const handled: string[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(String(error)));
    view.context.answer("openLinkAsync", () => Promise.reject(new Error("open refused")));
    await view.waitForAsync(".message a");

    await view.clickAsync(".message a");
    await GitFixtures.untilAsync(() => handled.length > 0);

    expect(handled).toEqual(["Error: open refused"]);
  });

  it("shows a reference a host finds in the subject as a link named as the host reads it, and opens it through the window", async () => {
    const issue: string = "https://github.com/example-owner/example-repository/issues/5";
    const reference = signal<LinkReference | null>(new LinkReference("example-owner/example-repository#5", "Issue", new LinkReferenceImage("data:,")));
    onTestFinished(GitLinkReferences.provide({
      referencesFor: () => ({ find: t => t === issue ? reference : null, findText: t => t.includes("renames") ? [new LinkReferenceMatch(t.indexOf("renames"), 7, issue)] : [] })
    }));
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    view.context.answer("openLinkAsync", async () => undefined);
    await view.waitForAsync(".subject a");

    await view.clickAsync(".subject a");

    expect([view.texts(".subject"), view.find(".subject a").getAttribute("href")]).toEqual([["Follow example-owner/example-repository#5"], issue]);
    expect(view.context.callsOf("openLinkAsync")).toEqual([[issue, { gesture: LinkGesture.Plain }]]);
  });

  it("gives a host the links of its own in the message, with the commit's folder, and opens none of them through the window", async () => {
    const issue: string = "https://github.com/example-owner/example-repository/issues/5";
    const reference = signal<LinkReference | null>(new LinkReference("example-owner/example-repository#5", "Issue", new LinkReferenceImage("data:,")));
    const opened: string[] = [];
    const injectors: unknown[] = [];
    onTestFinished(GitLinkReferences.provide({
      referencesFor: () => ({ find: t => t === issue ? reference : null, findText: t => [new LinkReferenceMatch(t.indexOf("#5"), 2, issue)] }),
      opens: (folder, url, injector) => {
        opened.push(`${folder} ${url}`);
        injectors.push(injector.get(ApplicationRef));
        return true;
      }
    }));
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")),
      new GitCommitDetail("c".repeat(40), "Fixes #5.", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false), [provideMarkdown()]);
    await view.waitForAsync(".message a[nol-link-reference-chip]");

    await view.clickAsync(".message a[nol-link-reference-chip]");

    expect([opened, view.context.callsOf("openLinkAsync")]).toEqual([[`${GitFixtures.folder} ${issue}`], []]);
    expect(injectors).toHaveLength(1);
    expect(injectors[0]).toBe(TestBed.inject(ApplicationRef));
  });

  it.each([["declines it", { opens: (): boolean => false }], ["has no way to open one", {}]] as const)(
    "opens a link through the window when its host %s", async (_: string, own: Pick<IGitLinkReferences, "opens">) => {
      const issue: string = "https://github.com/example-owner/example-repository/issues/5";
      const reference = signal<LinkReference | null>(new LinkReference("example-owner/example-repository#5", "Issue", new LinkReferenceImage("data:,")));
      onTestFinished(GitLinkReferences.provide({
        referencesFor: () => ({ find: t => t === issue ? reference : null, findText: t => [new LinkReferenceMatch(t.indexOf("#5"), 2, issue)] }),
        ...own
      }));
      const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")),
        new GitCommitDetail("c".repeat(40), "Fixes #5.", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false), [provideMarkdown()]);
      await view.waitForAsync(".message a[nol-link-reference-chip]");
      view.context.answer("openLinkAsync", () => Promise.resolve());

      await view.clickAsync(".message a[nol-link-reference-chip]");

      expect(view.context.callsOf("openLinkAsync").map(t => t[0])).toEqual([issue]);
    });

  it("shows the author's picture in place of their initials once a host has it, as a circle of the same size in the same place", async () => {
    const image = signal<string | null>(null);
    const asked: string[] = [];
    onTestFinished(GitAvatars.provide({
      avatarOf: (folder, email, commitId) => {
        asked.push(`${folder} ${email} ${commitId}`);
        return image();
      }
    }));
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".author span.av");
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const boxOf = (selector: string): readonly number[] => {
      const box = view.all(selector)[0]?.getBoundingClientRect();
      const author = view.all(".author")[0]?.getBoundingClientRect();
      return [rem((box?.left ?? 0) - (author?.left ?? 0)), rem((box?.top ?? 0) - (author?.top ?? 0)), rem(box?.width ?? 0), rem(box?.height ?? 0)];
    };
    const initials = boxOf(".author .av");

    image.set("data:image/png;base64,iVBORw0KGgo=");
    await view.waitForAsync(".author img.av");

    const picture = view.all(".author img.av")[0];
    expect([boxOf(".author .av"), view.all(".author span.av").length, picture?.getAttribute("src"), picture?.getAttribute("alt"), getComputedStyle(picture ?? document.body).borderRadius])
      .toEqual([initials, 0, "data:image/png;base64,iVBORw0KGgo=", "", "50%"]);
    expect(initials.slice(2)).toEqual([1.5, 1.5]);
    expect([...new Set(asked)]).toEqual([`${GitFixtures.folder} author@example.com ${"c".repeat(40)}`]);
  });

  it("shows no message or committer when there is none and the author committed it", async () => {
    const plain: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await plain.waitForAsync(".files");
    await plain.untilAsync(() => plain.requested("git.commitDetail").length === 1);
    expect([plain.all(".message").length, plain.all(".committed").length]).toEqual([0, 0]);
  });

  const signed: string = "c".repeat(40);
  it.each([
    ["a verified signature", new GitCommitSignature(signed, SignatureState.Verified, "A Person <a@example.com>", "SHA256:abc"),
      ["Verified", "verified", "Signed by A Person <a@example.com>, verified against the keys you trust", "SHA256:abc"]],
    ["an unverified signature", new GitCommitSignature(signed, SignatureState.Unverified, null, null), ["Unverified", "gpp_maybe", "Signed, but the signature isn't verified", null]],
    ["no signature", new GitCommitSignature(signed, SignatureState.None, null, null), ["no row", "0"]],
    ["a check Git can't make", GitFixtures.failure(FailureCode.Git, null, "gpg is missing."), ["no row", "0"]],
    ["another commit's answer", new GitCommitSignature("e".repeat(40), SignatureState.Verified, null, null), ["no row", "0"]]
  ] as const)("says under the people whether the commit's signature checks out and who signed it, with the key as its title, for %s", async (_, signature, row) => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")), undefined, [],
      { "git.commitSignature": signature instanceof Error ? signature : signature.toJson() });
    await view.waitForAsync(".files");
    await view.untilAsync(() => view.requested("git.commitSignature").length === 1);
    await view.fixture.whenStable();
    const shown: HTMLElement | null = view.element.querySelector<HTMLElement>(".signature");

    expect(Object.isNull(shown) ? ["no row", String(view.all("[role=alert]").length)]
      : [shown.dataset["state"], view.texts(".signature-icon")[0], view.texts(".signature-text")[0], shown.getAttribute("title")]).toEqual(row);
    expect(view.requested("git.commitSignature")).toEqual([{ folder: GitFixtures.folder, id: signed }]);
  });

  it("shows no message when Git can't read it, and still lists the files without an alert", async () => {
    const failed: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")),
      GitFixtures.failure(FailureCode.Git, null, "Git can't read that commit."));
    await failed.waitForAsync(".files");
    await failed.untilAsync(() => failed.requested("git.commitDetail").length === 1);
    expect([failed.all(".message").length, failed.all("[role=alert]").length]).toEqual([0, 0]);
  });

  it("says under the actions what a cherry-pick and a revert would do, starting where they start, and asks again when the repository changes", async () => {
    const answers: GitPrediction[] = [
      new GitPrediction(PredictionOutcome.Conflicts, ["a.ts", "b.ts", "c.ts", "d.ts"]), new GitPrediction(PredictionOutcome.UpToDate, []),
      new GitPrediction(PredictionOutcome.Clean, []), new GitPrediction(PredictionOutcome.Conflicts, ["a.ts"]),
      new GitPrediction(PredictionOutcome.FastForward, []), new GitPrediction(PredictionOutcome.Unavailable, [])
    ];
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    GitFixtures.answerWith(view.context, {
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.predict": () => answers.shift()?.toJson() ?? null
    });
    const lines = (): readonly string[] => view.texts(".prediction");

    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await view.untilAsync(() => lines().length === 2);
    expect(lines()).toEqual(["Cherry-pick would conflict in four files", "Revert: already on this branch."]);
    expect([view.texts(".prediction-file-name"), view.all(".prediction-file").map(t => [t.tagName, t.title]), view.texts(".prediction-more")])
      .toEqual([["a.ts", "b.ts", "c.ts"], [["BUTTON", "a.ts"], ["SPAN", "b.ts"], ["SPAN", "c.ts"]], ["+1 more"]]);
    view.find(".prediction-file").click();
    await view.untilAsync(() => view.find("nol-git-diff-files .file-row").getAttribute("aria-expanded") === "true");
    expect(view.texts("nol-git-diff-files .diff")).toHaveLength(1);
    const actions: DOMRect = view.find(".actions").getBoundingClientRect();
    const shown: DOMRect = view.find(".predictions").getBoundingClientRect();
    expect([shown.left, shown.top >= actions.bottom, view.find(".predictions").getAttribute("role")]).toEqual([actions.left, true, "status"]);

    view.context.raiseEvent("git.changed", { folder: "/work/other" });
    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await view.untilAsync(() => lines()[1] === "Revert would conflict in one file");
    expect([lines(), view.texts(".prediction-file-name"), view.texts(".prediction-more")]).toEqual([["Cherry-pick applies cleanly.", "Revert would conflict in one file"], ["a.ts"], []]);

    view.context.raiseEvent("git.changed", { folder: GitFixtures.folder });
    await view.untilAsync(() => lines().length === 1);
    expect(lines()).toEqual(["Cherry-pick applies cleanly."]);
    expect(view.requested("git.predict").slice(-2)).toEqual([
      { folder: GitFixtures.folder, id: "c".repeat(40), action: PredictionAction.CherryPick },
      { folder: GitFixtures.folder, id: "c".repeat(40), action: PredictionAction.Revert }
    ]);
  });

  it("merges a branch's tip on the status it is based on, saying first what the merge would do, and keeps the commit shown beside the panel's changes", async () => {
    const answers: GitPrediction[] = [new GitPrediction(PredictionOutcome.Conflicts, ["a.ts"]), new GitPrediction(PredictionOutcome.Clean, []), new GitPrediction(PredictionOutcome.Clean, [])];
    const tip: GitGraphCommit = new GitGraphCommit(commitOf(["d".repeat(40)]).commit, "author@example.com", [new GitRef(RefKind.RemoteBranch, "origin/main")]);
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, tip));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.predict": () => answers.shift()?.toJson() ?? null,
      "git.merge": null
    }, ".detail");
    await view.untilAsync(() => view.texts(".prediction").length === 3);

    expect(view.texts(".prediction")).toEqual(["Merge would conflict in one file", "Cherry-pick applies cleanly.", "Revert applies cleanly."]);
    expect(view.requested("git.predict")).toEqual([PredictionAction.Merge, PredictionAction.CherryPick, PredictionAction.Revert].map(action => ({ folder: GitFixtures.folder, id: "c".repeat(40), action })));
    const merge: HTMLButtonElement = view.find<HTMLButtonElement>(".merge");
    expect([merge.textContent?.trim(), merge.title, merge.getBoundingClientRect().left]).toEqual(["mergeMerge", "Merge this branch into the current branch", view.find(".actions").getBoundingClientRect().left]);
    await view.clickAsync(".merge");
    await view.untilAsync(() => !view.find<HTMLButtonElement>(".merge").disabled);

    expect(view.requested("git.merge")).toEqual([{ folder: GitFixtures.folder, id: "c".repeat(40), basedOn: GitFixtures.status().fingerprint }]);
    expect([view.all(".detail").length, view.all("[role=alert]").length, view.panel.querySelectorAll(".body").length]).toEqual([1, 0, 1]);
  });

  it("cherry-picks the commit on the status it is based on, offers no merge for a commit no branch points at, and keeps the commit shown", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".files");
    const fingerprint: string = GitFixtures.status().fingerprint;

    expect([view.find<HTMLButtonElement>(".cherry-pick").disabled, view.all(".merge")]).toEqual([false, []]);
    await view.clickAsync(".cherry-pick");
    await view.untilAsync(() => !view.find<HTMLButtonElement>(".cherry-pick").disabled);
    expect(view.requested("git.cherryPick")).toEqual([{ folder: GitFixtures.folder, id: "c".repeat(40), basedOn: fingerprint }]);
    expect([view.all(".detail").length, view.all("[role=alert]").length]).toEqual([1, 0]);
  });

  it("holds every action that writes while the Git panel follows another folder, since they write there, and offers them again once it follows the commit's", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    const history: WritableSignal<boolean> = signal(true);
    GitViewing.show(new GitCommitView(GitFixtures.folder, new GitGraphCommit(commitOf(["d".repeat(40)]).commit, "author@example.com", [new GitRef(RefKind.Branch, "main")])));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson()
    }, ".files", [], history);
    const writes: readonly string[] = [".merge", ".cherry-pick", ".revert", ".branch-here", ".tag-here"];
    const held = (): readonly boolean[] => [...writes, ".rebase-here"].map(t => view.find<HTMLButtonElement>(t).disabled);
    const before: readonly boolean[] = held();

    // Another repository's Conflicts document comes to the front: the Commit view keeps the commit, and the panel follows that repository.
    history.set(false);
    view.folder.set("/work/other");
    await view.untilAsync(() => view.find<HTMLButtonElement>(".merge").disabled);
    const elsewhere: readonly boolean[] = held();
    view.folder.set(GitFixtures.folder);
    await view.untilAsync(() => !view.find<HTMLButtonElement>(".merge").disabled);

    expect([before, elsewhere, held()]).toEqual([[false, false, false, false, false, false], [true, true, true, true, true, false], [false, false, false, false, false, false]]);
  });

  it.each([
    ["its local branch", [new GitRef(RefKind.Tag, "v1"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.Branch, "main")], "main"],
    ["its remote branch without a local one", [new GitRef(RefKind.RemoteBranch, "origin/main")], "origin/main"],
    ["its short id without a branch", [], "ccccccc"]
  ])("opens the rebase screen onto the commit, named by %s", async (_case: string, refs: GitRef[], name: string) => {
    onTestFinished(() => GitRebasing.forget(GitFixtures.folder));
    const view: GitViewFixture = await showAsync(new GitGraphCommit(commitOf(["d".repeat(40)]).commit, "author@example.com", refs), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".files");

    await view.clickAsync(".rebase-here");

    expect(GitRebasing.targetOf(GitFixtures.folder)).toEqual(new GitRebaseTarget("c".repeat(40), name));
    expect(view.context.callsOf("openDocument")).toEqual([["git.interactiveRebase", GitFixtures.folder, expect.any(String)]]);
  });

  it("reverts the commit, and shows Git's refusal under its actions, where the commit stays", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commitOf(["d".repeat(40)])));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.revert": GitFixtures.failure(FailureCode.Git, null, "Git stopped on conflicts.")
    }, ".detail");
    await view.waitForAsync(".files");

    await view.clickAsync(".revert");
    await view.waitForAsync(".detail [role=alert]");

    expect(view.requested("git.revert")).toEqual([{ folder: GitFixtures.folder, id: "c".repeat(40), basedOn: GitFixtures.status().fingerprint }]);
    expect([view.texts(".detail [role=alert]"), view.panel.querySelectorAll("[role=alert]").length]).toEqual([["Git stopped on conflicts."], 0]);
  });

  const typeName = async (view: GitViewFixture, name: string): Promise<void> => {
    const field: HTMLInputElement = view.find<HTMLInputElement>(".branch-name");
    field.value = name;
    field.dispatchEvent(new Event("input"));
    await view.untilAsync(() => !view.find<HTMLButtonElement>(".branch-form .create").disabled === (name.trim().length > 0));
  };

  it("asks for a name in a row as wide as the actions, makes the branch at the commit on a click, and closes the row", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".files");
    const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);

    await view.clickAsync(".branch-here");
    await view.waitForAsync(".branch-form");
    const actions: DOMRect = view.find(".actions").getBoundingClientRect();
    const form: DOMRect = view.find(".branch-form").getBoundingClientRect();
    const field: DOMRect = view.find(".branch-name").getBoundingClientRect();
    const create: DOMRect = view.find(".branch-form .create").getBoundingClientRect();
    expect([rem(form.left - actions.left), rem(form.right - actions.right), field.left - form.left, rem(field.width) > 6, create.top >= form.top]).toEqual([0, 0, 0, true, true]);
    expect(view.find<HTMLButtonElement>(".branch-form .create").disabled).toBe(true);
    await typeName(view, "fix/old");
    view.find<HTMLFormElement>(".branch-form").requestSubmit();
    await view.untilAsync(() => view.all(".branch-form").length === 0);

    expect(view.requested("git.createBranchAt")).toEqual([{ folder: GitFixtures.folder, name: "fix/old", id: "c".repeat(40), basedOn: GitFixtures.status().fingerprint }]);
    expect(view.all(".detail")).toHaveLength(1);
  });

  it("asks for a tag's name in the same row from Tag, a button as tall as Branch here, and makes the tag at the commit", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".files");
    const branchHere: DOMRect = view.find(".branch-here").getBoundingClientRect();
    const tagHere: DOMRect = view.find(".tag-here").getBoundingClientRect();
    expect([tagHere.height, tagHere.top > branchHere.top || tagHere.left > branchHere.right]).toEqual([branchHere.height, true]);

    await view.clickAsync(".tag-here");
    await view.waitForAsync(".branch-form");
    expect([view.find(".branch-name").getAttribute("placeholder"), view.find(".branch-name").getAttribute("aria-label")]).toEqual(["New tag name", "New tag name"]);
    await typeName(view, " v1 ");
    view.find<HTMLFormElement>(".branch-form").requestSubmit();
    await view.untilAsync(() => view.all(".branch-form").length === 0);

    expect([view.requested("git.createTag"), view.requested("git.createBranchAt")])
      .toEqual([[{ folder: GitFixtures.folder, name: "v1", id: "c".repeat(40), basedOn: GitFixtures.status().fingerprint }], []]);
  });

  it("offers copying the id and making a branch or a tag here from More actions, each the same as its own button", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".files");
    const writes = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    onTestFinished(() => writes.mockRestore());
    const items = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
    const pickAsync = async (action: string): Promise<void> => {
      await view.clickAsync(".id-row .more");
      await view.untilAsync(() => items().length > 0);
      document.querySelector<HTMLElement>(`button[nol-menu-item][data-action=${action}]`)?.click();
      await view.untilAsync(() => items().length === 0);
    };
    const placeholder = (): string | null => view.all(".branch-form").length === 0 ? null : view.find(".branch-name").getAttribute("placeholder");

    await view.clickAsync(".id-row .more");
    await view.untilAsync(() => items().length > 0);
    const offered: readonly (readonly unknown[])[] = items().map(t => [t.getAttribute("data-action"), t.getAttribute("aria-disabled") === "true"]);
    document.querySelector<HTMLElement>("button[nol-menu-item][data-action=branch-here]")?.click();
    await view.waitForAsync(".branch-form");
    const branch: string | null = placeholder();
    await pickAsync("tag-here");
    await view.untilAsync(() => placeholder() === "New tag name");
    await pickAsync("copy-id");
    await view.untilAsync(() => writes.mock.calls.length > 0);

    expect(offered).toEqual([["copy-id", false], ["branch-here", false], ["tag-here", false]]);
    expect(branch).toBe("New branch name");
    expect(writes.mock.calls).toEqual([["c".repeat(40)]]);
  });

  it("keeps the row with Git's refusal under it when the name is taken, and closes it on Escape or Cancel", async () => {
    onTestFinished(() => GitViewing.showChanges(GitFixtures.folder));
    GitViewing.show(new GitCommitView(GitFixtures.folder, commitOf(["d".repeat(40)])));
    const view: GitViewFixture = await GitViewFixture.renderCommitAsync({
      ...GitFixtures.watching, "git.status": GitFixtures.status().toJson(), "git.diff": GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")).toJson(),
      "git.commitDetail": new GitCommitDetail("c".repeat(40), "", "Sample Author", "author@example.com", "2026-11-20T14:02:00Z", false).toJson(),
      "git.createBranchAt": GitFixtures.failure(FailureCode.Refused, null, "The branch main already exists. Choose a new name.")
    }, ".detail");
    await view.waitForAsync(".files");

    await view.clickAsync(".branch-here");
    await view.waitForAsync(".branch-form");
    await typeName(view, "main");
    view.find<HTMLFormElement>(".branch-form").requestSubmit();
    await view.waitForAsync(".detail [role=alert]");
    expect([view.all(".branch-form").length, view.texts(".detail [role=alert]")]).toEqual([1, ["The branch main already exists. Choose a new name."]]);

    view.find(".branch-name").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await view.untilAsync(() => view.all(".branch-form").length === 0);
    expect(view.all(".detail [role=alert]")).toHaveLength(0);
    await view.clickAsync(".branch-here");
    await view.waitForAsync(".branch-form");
    await view.clickAsync(".branch-form .cancel");
    await view.untilAsync(() => view.all(".branch-form").length === 0);
  });

  it("says why when Git can't read the commit's files", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.failure(FailureCode.Git, null, "Git can't read that commit."));
    await view.waitForAsync("[role=alert]");

    expect(view.texts("[role=alert]")).toEqual(["Git can't read that commit."]);
  });

  it.each(AppearanceFixture.modes)("shows the commit's labels after its parents as outlined chips without icons, a local branch with its remote in its title, 1.25rem high a gap apart, in %s mode",
    async mode => {
      AppearanceFixture.apply(DefaultTheme.theme, mode);
      onTestFinished(() => AppearanceFixture.reset());
      const commit: GitGraphCommit = new GitGraphCommit(new GitCommit("c".repeat(40), ["d".repeat(40)], "Sample Author", "2026-11-20T14:02:00Z", "Follow renames"), "author@example.com", [
        new GitRef(RefKind.Head, "main"), new GitRef(RefKind.Branch, "main"), new GitRef(RefKind.RemoteBranch, "origin/main"), new GitRef(RefKind.Tag, "v1"), new GitRef(RefKind.Tag, "v1.1")
      ]);
      const view: GitViewFixture = await showAsync(commit, GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
      await view.waitForAsync(".parents .chip");
      const rem = (pixels: number): number => Math.round(pixels / parseFloat(getComputedStyle(document.documentElement).fontSize) * 1000) / 1000;
      const chips: readonly HTMLElement[] = view.all(".parents .chip");
      const boxes: readonly DOMRect[] = [view.find(".parents .link"), view.all(".parents > .muted")[1] ?? view.element, ...chips].map(t => t.getBoundingClientRect());
      const middle = (box: DOMRect | undefined): number => (box?.top ?? 0) + (box?.height ?? 0) / 2;

      expect([view.texts(".parents > *"), chips.map(t => [t.children.length, t.querySelectorAll(".ms").length, t.title, t.classList.contains("current")])]).toEqual([
        ["Parent", "ddddddd", "· In", "main", "v1", "v1.1"], [[1, 0, "main, origin/main", true], [1, 0, "v1", false], [1, 0, "v1.1", false]]]);
      expect(boxes.slice(1).map((t, index) => [rem(t.left - (boxes[index]?.right ?? 0)), Math.abs(middle(t) - middle(boxes[0])) < 1])).toEqual([[0.375, true],
        [0.375, true], [0.375, true], [0.375, true]]);
      expect([chips.map(t => rem(t.getBoundingClientRect().height)), getComputedStyle(chips[0] ?? view.element).boxShadow.includes("inset")]).toEqual([[1.25, 1.25, 1.25], true]);
    });

  it("shows no labels and no \"· In\" for a commit without labels", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".subject");

    expect([view.all(".chip"), view.texts(".parents > *")]).toEqual([[], ["Parent", "ddddddd"]]);
  });

  it("offers Explain, not built yet, after the commit's actions only while the app turns AI features on", async () => {
    const view: GitViewFixture = await showAsync(commitOf(["d".repeat(40)]), GitFixtures.diff("a.ts", new FixtureLine(LineKind.Added, "one")));
    await view.waitForAsync(".tag-here");
    const off: readonly unknown[] = [view.all(".explain").length, view.find(".actions").lastElementChild?.classList.contains("tag-here") === true];
    GitViewOptions.showsAiFeatures.set(true);
    onTestFinished(() => GitViewOptions.showsAiFeatures.set(false));
    await view.untilAsync(() => view.all(".explain").length === 1);
    const explain: HTMLButtonElement = view.find<HTMLButtonElement>(".explain");

    expect([off, explain.textContent?.trim(), explain.disabled, explain.title, view.find(".actions").lastElementChild === explain])
      .toEqual([[0, true], "auto_awesomeExplain", true, "Not built yet", true]);
  });
});

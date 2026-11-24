/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostChanges, HostItem, HostPerson, HostReference, HostWorkItem, HostWorkItemType, ReferenceKind, ReferenceState, WorkItemCategory,
  WorkItemQuery } from "@noldova/git.hosting.protocol";
import type { LinkReference } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { AzureDevOpsReferenceLink } from "../../../src/app/models/azure-devops-reference-link.ts";
import { AzureDevOpsReferenceLooks } from "../../../src/app/services/azure-devops-reference-looks.ts";

describe("AzureDevOpsReferenceLooks", () => {
  const repository = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  const openedAt = Date.parse("2026-11-01T09:30:00.000Z");
  const closedAt = Date.parse("2026-11-07T18:05:00.000Z");
  const svgOf = (url: string): string => decodeURIComponent(url.slice("data:image/svg+xml,".length));
  const pathOf = (url: string): string => svgOf(url).replace(/^.*<path d="([^"]+)".*$/su, "$1");
  const workItemOf = (type: HostWorkItemType = new HostWorkItemType("Bug", "CC293D", "icon_insect"), category: WorkItemCategory = WorkItemCategory.InProgress,
    assignee: HostPerson | null = new HostPerson("monalisa@example.com", null, null), iteration: string | null = "Web Site\\Sprint 42"): HostWorkItem =>
    new HostWorkItem("git-azure-devops", "fabrikam", "Web Site", 42, type, "The greeting is cut short", "Active", category,
      "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42", assignee, iteration, "Web Site", null);
  const pullRequestOf = (state: ReferenceState, author: HostPerson | null = new HostPerson("octocat@example.com", null, null)): HostItem =>
    new HostItem(new HostReference("git-azure-devops", "fabrikam", repository, 7), ReferenceKind.PullRequest, state, "Fix the greeting",
      "https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7", author, openedAt,
      state === ReferenceState.Open || state === ReferenceState.Draft ? null : closedAt, 0, new HostChanges(null, null, null, "feature/greeting", "main",
        "0123456789abcdef0123456789abcdef01234567"));
  const shown = (chip: LinkReference): readonly unknown[] => [chip.reference, chip.kind, chip.state?.label ?? null, chip.icon.isMonochrome, chip.mark, chip.title,
    chip.location];

  it("draws a work item with its type's name, icon and colour in both modes, its id and title, and its state after it in its category's tone", () => {
    const chip = AzureDevOpsReferenceLooks.workItemOf(workItemOf());

    expect(shown(chip)).toEqual(["Bug 42", "Bug", "Bug", true, null, "The greeting is cut short", "fabrikam/Web Site"]);
    expect([chip.state?.light.color, chip.state?.light.background, chip.state?.dark.color, chip.state?.dark.background]).toEqual(["#CC293D",
      "color-mix(in srgb, #CC293D 16%, transparent)", "#CC293D", "color-mix(in srgb, #CC293D 16%, transparent)"]);
    expect([chip.workItemState?.label, chip.workItemState?.tone.light, chip.workItemState?.tone.dark]).toEqual(["Active", "#007ACC", "#007ACC"]);
    expect(svgOf(chip.icon.url)).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24" viewBox="0 -960 960 960"><path d="[^"]+"\/><\/svg>$/u);
  });

  it("gives each of Azure DevOps' type icons its own symbol, and any other icon the work item symbol", () => {
    const icons = ["icon_book", "icon_insect", "icon_clipboard", "icon_crown", "icon_trophy", "icon_list", "icon_check_box", "icon_chat_bubble", "icon_review"];

    const paths = icons.map(t => pathOf(AzureDevOpsReferenceLooks.workItemOf(workItemOf(new HostWorkItemType("Bug", "CC293D", t))).icon.url));

    expect(new Set(paths.slice(0, 7)).size).toBe(7);
    expect([paths[7] === paths[8], paths.slice(0, 7).includes(paths[7] ?? "")]).toEqual([true, false]);
    expect(paths[7]).toBe(pathOf(AzureDevOpsReferenceLooks.pendingOf(new AzureDevOpsReferenceLink(new WorkItemQuery("git-azure-devops", "fabrikam", 42),
      "fabrikam#42")).icon.url));
  });

  it("tones a work item's state by its category as Azure DevOps does, and a removed one in the muted text colour", () => {
    const tones = Object.values(WorkItemCategory).map(t => AzureDevOpsReferenceLooks.workItemOf(workItemOf(undefined, t)).workItemState?.tone.light);

    expect(tones).toEqual(["#B2B2B2", "#007ACC", "#FF9D00", "#339933", "var(--nol-text-muted)"]);
  });

  it("gives a work item's card its assignee, its iteration's last part and the pages of the item and its project", () => {
    const chip = AzureDevOpsReferenceLooks.workItemOf(workItemOf());
    const rootIteration = AzureDevOpsReferenceLooks.workItemOf(workItemOf(undefined, undefined, undefined, "Web Site"));

    expect([chip.author?.name, chip.author?.image, chip.statuses.map(t => t.text), rootIteration.statuses.map(t => t.text), chip.time])
      .toEqual(["monalisa@example.com", null, ["Sprint 42"], ["Web Site"], null]);
    expect([chip.itemHref, chip.locationHref, chip.authorHref, chip.diffHref, chip.commentsHref]).toEqual(["https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42",
      "https://dev.azure.com/fabrikam/Web%20Site", null, null, null]);
  });

  it("gives a work item's card the Create a branch action, whose address carries the item's organization, id and title for the branch dialog", () => {
    const action = AzureDevOpsReferenceLooks.workItemOf(workItemOf()).action;

    expect([action?.label, action?.href, action?.glyph]).toEqual(["Create a branch",
      "git-azure-devops:branch?organization=fabrikam&id=42&title=The+greeting+is+cut+short", "call_split"]);
  });

  it("leaves the assignee and the iteration out of a work item's card when it has none", () => {
    const chip = AzureDevOpsReferenceLooks.workItemOf(workItemOf(undefined, undefined, null, null));

    expect([chip.author, chip.statuses]).toEqual([null, []]);
  });

  it("draws a pull request in each state with Azure DevOps' name for it, the Git view's icon and colour, its number and its title", () => {
    const states = [ReferenceState.Open, ReferenceState.Draft, ReferenceState.Merged, ReferenceState.Closed];

    const chips = states.map(t => AzureDevOpsReferenceLooks.pullRequestOf(pullRequestOf(t)));

    expect(chips.map(shown)).toEqual(["Active", "Draft", "Completed", "Abandoned"].map(t => ["!7", "Pull request", t, true, null, "Fix the greeting",
      "fabrikam !7"]));
    expect(chips.map(t => [t.state?.light.color, t.state?.dark.color, t.state?.light.background])).toEqual(["var(--nol-status-ok)", "var(--nol-text-muted)",
      "var(--nol-accent)", "var(--nol-text-muted)"].map(t => [t, t, `color-mix(in srgb, ${t} 16%, transparent)`]));
    expect(new Set(chips.map(t => t.icon.url)).size).toBe(4);
  });

  it("dates a pull request by when it was completed or abandoned, else by when it was opened, and links its page and organization", () => {
    const open = AzureDevOpsReferenceLooks.pullRequestOf(pullRequestOf(ReferenceState.Open));
    const merged = AzureDevOpsReferenceLooks.pullRequestOf(pullRequestOf(ReferenceState.Merged));

    expect([open.time?.toISOString(), merged.time?.toISOString()]).toEqual(["2026-11-01T09:30:00.000Z", "2026-11-07T18:05:00.000Z"]);
    expect([merged.itemHref, merged.locationHref, merged.authorHref, merged.diff, merged.comments]).toEqual(["https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7",
      "https://dev.azure.com/fabrikam", null, null, null]);
  });

  it("names a pull request's creator, and leaves the author out when Azure DevOps no longer knows them", () => {
    const named = AzureDevOpsReferenceLooks.pullRequestOf(pullRequestOf(ReferenceState.Open));
    const gone = AzureDevOpsReferenceLooks.pullRequestOf(pullRequestOf(ReferenceState.Open, null));

    expect([named.author?.name, named.author?.image, gone.author]).toEqual(["octocat@example.com", null, null]);
  });

  it("draws an item still being read with a plain reference, its kind and icon, and no state, title or card parts", () => {
    const workItem = AzureDevOpsReferenceLooks.pendingOf(new AzureDevOpsReferenceLink(new WorkItemQuery("git-azure-devops", "fabrikam", 42), "fabrikam#42"));
    const pullRequest = AzureDevOpsReferenceLooks.pendingOf(new AzureDevOpsReferenceLink(new HostReference("git-azure-devops", "fabrikam", repository, 7),
      `fabrikam/${repository}!7`));

    expect([workItem, pullRequest].map(t => [...shown(t), t.workItemState, t.author, t.itemHref])).toEqual([
      ["Work item 42", "Work item", null, true, null, null, null, null, null, null],
      ["!7", "Pull request", null, true, null, null, null, null, null, null]
    ]);
    expect(pullRequest.icon.url).toBe(AzureDevOpsReferenceLooks.pullRequestOf(pullRequestOf(ReferenceState.Open)).icon.url);
  });
});

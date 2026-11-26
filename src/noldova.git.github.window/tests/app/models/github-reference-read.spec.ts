/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostReference } from "@noldova/git.hosting.protocol";
import { LinkReference, LinkReferenceImage } from "@noldova/ui.components.angular";
import { describe, expect, it } from "vitest";

import { GitHubReferenceRead } from "../../../src/app/models/github-reference-read.ts";

describe("GitHubReferenceRead", () => {
  const reference: HostReference = new HostReference("git-github", "octocat", "hello-world", 42);
  const pending: LinkReference = new LinkReference("octocat/hello-world#42", "Pull request", new LinkReferenceImage("data:,"));
  const read: LinkReference = new LinkReference("octocat/hello-world#42", "Pull request", new LinkReferenceImage("data:,"), { title: "Fix the greeting" });

  it("holds the reference and its pending look, and shows the pending look at first only when asked to", () => {
    const shown: GitHubReferenceRead = new GitHubReferenceRead(reference, pending, true);
    const hidden: GitHubReferenceRead = new GitHubReferenceRead(reference, pending, false);

    expect([shown.reference, shown.pending, shown.item(), hidden.item()]).toEqual([reference, pending, pending, null]);
  });

  it("shows the pending look when a read starts while nothing shows, and keeps what shows when one starts again", () => {
    const item: GitHubReferenceRead = new GitHubReferenceRead(reference, pending, false);

    const first: number = item.start();
    const started: LinkReference | null = item.item();
    item.show(first, read);
    const second: number = item.start();

    expect([first, started, second, item.item()]).toEqual([1, pending, 2, read]);
  });

  it("shows the newest read's answer, a missing one too, and drops an older read's", () => {
    const item: GitHubReferenceRead = new GitHubReferenceRead(reference, pending, true);

    const older: number = item.start();
    const newer: number = item.start();
    const late: boolean = item.show(older, read);
    const afterLate: LinkReference | null = item.item();
    const answered: boolean = item.show(newer, null);

    expect([late, afterLate, answered, item.item()]).toEqual([false, pending, true, null]);
  });

  it("hides the item when it stops, and drops the answer of a read that ran before", () => {
    const item: GitHubReferenceRead = new GitHubReferenceRead(reference, pending, true);

    const attempt: number = item.start();
    item.stop();
    const stopped: LinkReference | null = item.item();
    const late: boolean = item.show(attempt, read);

    expect([stopped, late, item.item()]).toEqual([null, false, null]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { GitRepositoryLink } from "../../../src/app/models/git-repository-link.ts";
import { GitRepositoryLinks } from "../../../src/app/services/git-repository-links.ts";

describe("GitRepositoryLinks", () => {
  const azure: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https);
  const github: GitRemote = new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https);

  it("lists each host's rows for a remote in the order the hosts were added, and drops a host's rows once it is withdrawn", () => {
    const open = (): void => undefined;
    const sprint: GitRepositoryLink = new GitRepositoryLink("sprint", "Sprint", "view_kanban", open);
    const board: GitRepositoryLink = new GitRepositoryLink("board", "Board", "dashboard", open);
    const withdrawFirst = GitRepositoryLinks.provide({ linksFor: t => t.host === "dev.azure.com" ? [sprint] : [] });
    const withdrawSecond = GitRepositoryLinks.provide({ linksFor: () => [board] });

    const both = [GitRepositoryLinks.of(azure), GitRepositoryLinks.of(github)];
    withdrawFirst();
    const after = GitRepositoryLinks.of(azure);
    withdrawSecond();

    expect([both, after, GitRepositoryLinks.of(azure)]).toEqual([[[sprint, board], [board]], [board], []]);
    expect([sprint.key, sprint.label, sprint.icon, sprint.open]).toEqual(["sprint", "Sprint", "view_kanban", open]);
  });
});

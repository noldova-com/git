# Changelog

**Scope:** What each published version of Git's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.7

- The Azure DevOps host module, three new packages that move with the others: `@noldova/git.azure-devops`, `@noldova/git.azure-devops.window` and `@noldova/git.azure-devops.protocol` (#32).
  It signs in with Microsoft or a personal access token, whose sign-in lists the token's scopes, reads and writes pull requests with their threads, replies, votes, reviewers and Complete, and reads the person's work items with the commits that name them.
  Its counts match Azure DevOps' pages: approvals count people, not the groups that carry a person's vote, checks take each pipeline's newest build, and a completed or abandoned pull request shows nothing still queued as running.
  A pull request's state shows in Azure DevOps' words, Active, Draft, Completed or Abandoned, and a work item's type in Azure DevOps' own icon, with when the item last changed.
- The Git window adds History and the commit detail, Conflicts with the editor's merge view, interactive rebase, the Dashboard with the Across repositories view, stash, the Undo menu over the write journal, ahead and behind of the upstream, and the detail views as dock tabs; the status bar follows the open repository's branch, upstream, changes and checks, with the diff's line totals from the new method `git.diffTotals` (#32).
- `git.watch` walks a folder's tree one walk at a time, so a folder made while a walk runs keeps one watch (#32).
- `@noldova/git.hosting.protocol` adds `HostWorkItem.changedAt`, when the item last changed, and `HostWorkItemType.image`, the type's icon as the host draws it, in SVG; `@noldova/git.window` adds `GitBranchPullRequest.stateLabel`, the host's own word for a pull request's state, and `GitRepositoryLink.isActive`, which selects a host's row in the repository panel while its page is the active document, as the My work items row does.
  Each is optional in its constructor, and JSON without it reads as null.
- Both modules take Noldova Desktop 0.0.16: `module.json`'s `noldovaDesktop` range and the runtime packages' Noldova Desktop peers start at 0.0.16, and the window packages take Noldova Desktop 0.0.16's packages, `@noldova/ui.components.angular` 0.0.29 and the editor packages at 0.0.9 (#32).

## 0.0.6

- Both modules take Noldova Desktop 0.0.11: `module.json`'s `noldovaDesktop` range and the runtime packages' Noldova Desktop peers start at 0.0.11, and the window packages take Noldova Desktop 0.0.11's packages and `@noldova/ui.components.angular` 0.0.21; Git is built and tested with context 0.0.10, and its context peers stay at 0.0.9 and up (#100, #105, #107).
- `documents/ARCHITECTURE.md` says why any module that names `git-github` as a dependency or an optional dependency may read `git-github.access`, the GitHub token's service (#103).

## 0.0.5

- `BranchPullRequest`, the answer to the GitHub module's `git-github.readBranchPullRequest`, and the agent tool `git_github_pr_checks` carry the pull request's review decision, `reviewDecision`, from each reviewer's latest review that approves or requests changes: `ChangesRequested` when one requests changes, else `Approved` when one approves, else `Waiting`, and `null` without a pull request; only the reviews of the repository's owner, members and collaborators count (#97).
  `BranchPullRequest.fromJson` refuses a field it doesn't know, so an app reading these answers moves its Git packages to 0.0.5 with the modules.
- Both modules take Noldova Desktop 0.0.10: `module.json`'s `noldovaDesktop` range and the runtime packages' Noldova Desktop peers start at 0.0.10, and the window packages take Noldova Desktop 0.0.10's packages and `@noldova/ui.components.angular` 0.0.20; the context peers of every package that takes context start at 0.0.9 (#57, #81, #83, #85, #88, #92, #95, #43).

## 0.0.4

- In a new layout, the Git view opens in the right dock's first group at order 20, so an app can put its own views at orders 10 and 30 around it in that group (#54).
- Both modules take Noldova Desktop 0.0.7: `module.json`'s `noldovaDesktop` range and the runtime packages' Noldova Desktop peers start at 0.0.7, and the window packages take Noldova Desktop 0.0.7's packages, Angular 22.3.0 and `@noldova/ui.components.angular` 0.0.15 (#41, #50).

## 0.0.3

- The GitHub module opens GitHub's device sign-in page, from Settings → GitHub and from the Git view's GitHub row, and its page for the app's access, Manage access on GitHub, in the person's own browser whatever the Links setting says, since both need the person's GitHub session; a pull request and a check's run still open where the setting says (#45).
- Both modules take Noldova Desktop 0.0.5: `module.json`'s `noldovaDesktop` range and the runtime packages' Noldova Desktop peers start at 0.0.5, and the window packages take Noldova Desktop 0.0.5's packages; the window packages' context peers start at 0.0.8, while the other packages that take context, the runtime packages, `@noldova/git.protocol` and `@noldova/git.hosting.protocol`, keep 0.0.7 (#18, #30, #39).
- The window packages take `@noldova/ui.components.angular` 0.0.12 and its size tokens in place of the windows' own sizes, at the same values (#33).

## 0.0.2

- The packages are published through npm's trusted publishing, with provenance, so the release stores no token.

## 0.0.1

- The first version of Git's seven packages, under the MIT License: `@noldova/git`, `@noldova/git.window` and `@noldova/git.protocol` for the local Git module, `@noldova/git.github`, `@noldova/git.github.window` and `@noldova/git.github.protocol` for the GitHub module, and `@noldova/git.hosting.protocol`, which every host module shares.
  The seven packages move together.
- `@noldova/git` holds `module.json`, the module `git`, and exports `./runtime` and `./window`, which give Noldova Desktop the runtime part and the window part; `module.json` names `>=0.0.1 <0.1.0` as its `noldovaDesktop` range.
  Its runtime part runs the person's own `git`, 2.39 or later, and answers `git.status`, `git.diff`, `git.branches`, `git.log`, `git.worktrees`, `git.pullHooks`, `git.watch` and `git.unwatch`, and the writes `git.stage`, `git.unstage`, `git.createBranch`, `git.switchBranch`, `git.commit`, `git.push` and `git.pull`, each a person's own click in the window; `git.changed` tells a watching window that a folder's status moved.
- It gives an agent 11 tools: `git_status`, `git_diff`, `git_log`, `git_branches`, `git_stage`, `git_unstage`, `git_create_branch`, `git_switch_branch`, `git_commit`, `git_push` and `git_pull`. `git_stage`, `git_unstage` and `git_create_branch` ask the person only when a hook of the repository would run, a stage meets a clean or process filter, or the hooks can't be read; `git_switch_branch`, `git_commit`, `git_pull` and `git_push` always ask, and a push to any branch but the one the agent's session made asks in every mode, offering only Allow once and Deny, as `documents/SECURITY-MODEL.md` says.
- `@noldova/git.window` gives the Git view, `git.view`: a folder's branch, changes, diff and commit.
- `@noldova/git.github` holds `module.json`, the module `git-github`, which depends on `git`, and exports `./runtime`, `./window` and the type `IGitHubAccess`.
  Its runtime part signs in to GitHub with GitHub's device flow and keeps the token in Noldova Desktop's secrets on this computer; it reads issues, pull requests and checks, and opens pull requests, and gives an agent 3 tools: `git_github_read`, `git_github_pr_checks` and `git_github_pr_create`, the last asking the person first, every time.
  Its window part adds the GitHub page in Settings, `git-github.account`, and a branch's pull request and checks in the Git view.
- `@noldova/git.protocol`, `@noldova/git.github.protocol` and `@noldova/git.hosting.protocol` hold what the parts exchange.
- The module packages, `@noldova/git` and `@noldova/git.github`, take Noldova Desktop's `@noldova/desktop.protocol` and `@noldova/desktop.runtime` at `>=0.0.1 <0.1.0` as peers; they, `@noldova/git.protocol` and `@noldova/git.hosting.protocol` also take context's `@noldova/context.exceptions` and `@noldova/context.json` at `>=0.0.7 <0.1.0`; `@noldova/git.github.protocol` takes none.
- The window packages' peers are all optional, so npm neither installs nor reports a missing one, and an app installs them itself:
  - `@noldova/git.window`: `@angular/common`, `@angular/core` and `@angular/forms` at `>=22.2.6 <23.0.0`, `@noldova/context.exceptions` and `@noldova/context.json` at `>=0.0.7 <0.1.0`, `@noldova/desktop.window` at `>=0.0.1 <0.1.0` and `@noldova/ui.components.angular` at `>=0.0.5 <0.1.0`.
  - `@noldova/git.github.window`: `@angular/common` and `@angular/core` at `>=22.2.6 <23.0.0`, `@noldova/context.json` at `>=0.0.7 <0.1.0`, `@noldova/desktop.window` and `@noldova/git.window` at `>=0.0.1 <0.1.0` and `@noldova/ui.components.angular` at `>=0.0.5 <0.1.0`.
    Its ranged peer on `@noldova/git.window` means an app that includes the GitHub module builds only with Noldova Desktop 0.0.2 or later, which accepts a ranged peer on another of Noldova's packages.
- Git builds and tests on Node.js 26.13.1 with npm 11.20.0, against Noldova Desktop 0.0.2, whose `@noldova/desktop.*` packages it pins exactly, and `@types/node` 26.

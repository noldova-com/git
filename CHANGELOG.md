# Changelog

**Scope:** What each published version of Git's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

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

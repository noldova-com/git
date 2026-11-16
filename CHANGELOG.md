# Changelog

**Scope:** What each published version of Git's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.1

- The first version of Git's seven packages, under the MIT License: `@noldova/git`, `@noldova/git.window` and `@noldova/git.protocol` for the local Git module, `@noldova/git.github`, `@noldova/git.github.window` and `@noldova/git.github.protocol` for the GitHub module, and `@noldova/git.hosting.protocol`, which every host module shares.
  The seven packages move together.
- `@noldova/git` holds `module.json`, the module `git`, and exports `./runtime` and `./window`, which give Noldova Desktop the runtime part and the window part; `module.json` names `>=0.0.1 <0.1.0` as its `noldovaDesktop` range.
  Its runtime part runs the person's own `git`, 2.39 or later, and answers `git.status`, `git.diff`, `git.branches`, `git.log`, `git.worktrees`, `git.pullHooks`, `git.watch` and `git.unwatch`, and the writes `git.stage`, `git.unstage`, `git.createBranch`, `git.switchBranch`, `git.commit`, `git.push` and `git.pull`, each a person's own click in the window; `git.changed` tells a watching window that a folder's status moved.
- It gives an agent 11 tools: `git_status`, `git_diff`, `git_log`, `git_branches`, `git_stage`, `git_unstage`, `git_create_branch`, `git_switch_branch`, `git_commit`, `git_push` and `git_pull`; each write first raises a permission request, and the app's policy decides whether the person is asked.
- `@noldova/git.window` gives the Git view, `git.view`: a folder's branch, changes, diff and commit.
- `@noldova/git.github` holds `module.json`, the module `git-github`, which depends on `git`, and exports `./runtime`, `./window` and the type `IGitHubAccess`.
  Its runtime part signs in to GitHub with GitHub's device flow and keeps the token in Noldova Desktop's secrets on this computer; it reads issues, pull requests and checks, and opens pull requests, and gives an agent 3 tools: `git_github_read`, `git_github_pr_checks` and `git_github_pr_create`, the last asking the person first, every time.
  Its window part adds the GitHub page in Settings, `git-github.account`, and a branch's pull request and checks in the Git view.
- `@noldova/git.protocol`, `@noldova/git.github.protocol` and `@noldova/git.hosting.protocol` hold what the parts exchange.
- The module packages take Noldova Desktop's `@noldova/desktop.protocol` and `@noldova/desktop.runtime` at `>=0.0.1 <0.1.0` as peers; `@noldova/git`, `@noldova/git.github`, `@noldova/git.protocol` and `@noldova/git.hosting.protocol` take context's `@noldova/context.exceptions` and `@noldova/context.json` at `>=0.0.7 <0.1.0`, and the window packages also `@noldova/context.core`, as peers.
- `@noldova/git.github.window` takes `@noldova/git.window` and `@noldova/git.protocol` at `>=0.0.1 <0.1.0` as peers, so an app that includes the GitHub module builds only with the Noldova Desktop release that accepts a ranged peer on another of Noldova's packages, noldova-com/desktop#111.

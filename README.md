# Git

Git shows a repository's state in a Noldova desktop app and lets the app's AI agents work with it, and with the service that hosts it, with the person's approval.
It is a set of modules for apps built on [Noldova Desktop](https://github.com/noldova-com/desktop):

- **Git**: the local repository, its changes, branches, commits and history, read and written through the person's own `git`.
- **GitHub**: sign-in, and a branch's pull request and checks on GitHub.

The GitHub module is separate, so an app that needs only the local repository adds only the Git module.
GitHub is the name of its owner's service; the module names it only to connect to it.
The modules are product-neutral: an app adds their packages and configures them through their published API, and they hold no app's names, text or behavior.

Each change an agent wants to make, such as a commit, a push or a comment, first raises a permission request, and the app's policy decides whether the person is asked.

It targets Windows, macOS and Linux on x64 and ARM64.
To report a bug or ask for a change, open an issue in this repository, as the organization's [contributing guide](https://github.com/noldova-com/.github/blob/main/CONTRIBUTING.md) says.
Report a security problem privately, as its [security policy](https://github.com/noldova-com/.github/blob/main/SECURITY.md) says.

## Getting started

An app on Noldova Desktop installs each module's package it needs, pinned exactly, and lists it in `desktop.modules`:

```bash
npm install --save-exact @noldova/git @noldova/git.github
```

```json
{
  "desktop": {
    "modules": [
      { "id": "git", "package": "@noldova/git" },
      { "id": "git-github", "package": "@noldova/git.github" }
    ]
  }
}
```

[documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) says how the modules are built and what each part does, and [documents/SECURITY-MODEL.md](documents/SECURITY-MODEL.md) what an agent's writes ask.

Each name opens the package's folder; each badge opens it on npm.

| Package | npm | What it is |
|---|---|---|
| [`git`](src/noldova.git) | [![npm](https://badgen.net/npm/v/@noldova/git)](https://www.npmjs.com/package/@noldova/git) | The local Git module: its `module.json` and its runtime part, which runs the person's `git` and the agent tools. |
| [`git.window`](src/noldova.git.window) | [![npm](https://badgen.net/npm/v/@noldova/git.window)](https://www.npmjs.com/package/@noldova/git.window) | The Git module's window part: the Git view of a folder's branch, changes and commit, in Angular. |
| [`git.protocol`](src/noldova.git.protocol) | [![npm](https://badgen.net/npm/v/@noldova/git.protocol)](https://www.npmjs.com/package/@noldova/git.protocol) | The messages between the Git module's runtime and window parts. |
| [`git.github`](src/noldova.git.github) | [![npm](https://badgen.net/npm/v/@noldova/git.github)](https://www.npmjs.com/package/@noldova/git.github) | The GitHub module: its `module.json` and its runtime part, which signs in to GitHub and reads its issues, pull requests and checks. |
| [`git.github.window`](src/noldova.git.github.window) | [![npm](https://badgen.net/npm/v/@noldova/git.github.window)](https://www.npmjs.com/package/@noldova/git.github.window) | The GitHub module's window part: the sign-in and a branch's pull request and checks, in Angular. |
| [`git.github.protocol`](src/noldova.git.github.protocol) | [![npm](https://badgen.net/npm/v/@noldova/git.github.protocol)](https://www.npmjs.com/package/@noldova/git.github.protocol) | What the GitHub module's parts share. |
| [`git.azure-devops`](src/noldova.git.azure-devops) | [![npm](https://badgen.net/npm/v/@noldova/git.azure-devops)](https://www.npmjs.com/package/@noldova/git.azure-devops) | The Azure DevOps module: its `module.json` and its runtime part, which signs in to Azure DevOps with a Microsoft account or a personal access token and reads its pull requests with their votes, policies and builds, and its work items. |
| [`git.azure-devops.window`](src/noldova.git.azure-devops.window) | [![npm](https://badgen.net/npm/v/@noldova/git.azure-devops.window)](https://www.npmjs.com/package/@noldova/git.azure-devops.window) | The Azure DevOps module's window part, in Angular: the sign-in on Git's Accounts and hosts page, a branch's pull request and checks, the pull request page and My work items. |
| [`git.azure-devops.protocol`](src/noldova.git.azure-devops.protocol) | [![npm](https://badgen.net/npm/v/@noldova/git.azure-devops.protocol)](https://www.npmjs.com/package/@noldova/git.azure-devops.protocol) | What the Azure DevOps module's parts share. |
| [`git.hosting.protocol`](src/noldova.git.hosting.protocol) | [![npm](https://badgen.net/npm/v/@noldova/git.hosting.protocol)](https://www.npmjs.com/package/@noldova/git.hosting.protocol) | What every host module shares: references to issues and pull requests, and the sign-in's models. |

## Building from source

```bash
npm run build
npm test
```

`npm run build` installs the repository's exact versions with `npm ci` when there is no `node_modules`, logging each request npm makes and its time, so a slow install shows which download stalled, then builds and packs the seven packages into `_packages`, one after another, installing each archive as it is packed, so the packages built after it and every test use the packed package, as an app does.
`npm test` runs the checks and every package's tests, and last installs the packed packages into a fixture app, so it runs after the build.
`npm test -- --repeat <count> <test files>` runs the checks once, then the chosen tests that many times, stopping at the first run that fails, as when proving a flaky test's fix; Noldova Desktop's `npm test` takes the same option.
[documents/TESTING.md](documents/TESTING.md) says what the checks cover and on which targets.

## Checks

Every pull request into `main` must pass "Check / Linked issue" and "Build and test / All targets", which [documents/TESTING.md](documents/TESTING.md#the-pull-request-checks) describes.

`.github/workflows/module-range.yml` calls Noldova Desktop's "Module range" workflow, pinned to Noldova Desktop 0.0.12's commit, once for each module, `src/noldova.git`, `src/noldova.git.github` and `src/noldova.git.azure-devops`, on every pull request, every night and by hand.
It builds and tests each module with `npm run build` and `npm test` against the newest published Noldova Desktop inside its `module.json`'s `noldovaDesktop` range, which Desktop Build's range check, at the Noldova Desktop version the root `package.json` pins, chooses, and a failing nightly run opens or updates an issue, so it holds only `contents: read` and `issues: write`.
The build's installs of the packed packages name the version `node_modules` holds of each `@noldova/` package the root `package.json` pins, since an install otherwise takes the lockfile's version back, so the version the run moved to stays.

The coverage gate leaves out two things, both in the two window parts and both as the organization's Angular standard says:

- the enum files, `src/app/enums/**` in each window part's `angular.json` `coverageExclude`, since the build inlines their members and they hold no executable code; only the Git window part has enum files today, so the GitHub window part's entry matches nothing;
- the compiler's development-mode class-metadata call after each class (`ɵsetClassMetadata`), which never runs in production; `scripts/angular/class-metadata-coverage.ts` marks exactly that call, and the run reports how many it skipped.

No package excludes any other file from coverage.

### Test files over 1 second

A test file finishes within 1 second.
`npm test` reports each file over it, each listed file over its time here and each name here the run no longer has, and never fails for a time: no check of `npm test` takes the clock as a pass condition, so a busy machine never fails a test that passes.
`npm run test:timing`, run after `npm run build` and `npm test`, is the labelled timing check, apart from the gate: it runs the root suite and each window part's specs 3 times, takes each file's median time, and fails a file whose median is over 1 second that this list doesn't name, a listed file whose median is over its time here plus 50%, or a name here the run no longer has.
The margin is half again over the highest time across the machines, so one slow run of three doesn't fail it.
The runtime package's files run real git, which is how the module works, and the window parts' files draw in a real browser; they take longer for that reason, and a maintainer accepts each. A file under 1 second is listed when the slowest machine's runs come within a third of it.
The time is the highest of the latest runs on Linux, both macOS machines and Windows, the file's whole time.

| File | Time | Why |
|---|---|---|
| `src/noldova.git/tests/services/pull.writer.test.ts` | 53.0 s | 19 tests pull from real remotes, past and into uncommitted changes, with hooks, submodules and filters. |
| `src/noldova.git/tests/services/worktree.service.test.ts` | 51.3 s | 43 tests create, lock, remove and recover real worktrees with real git, some five at once. |
| `src/noldova.git/tests/services/push.writer.test.ts` | 33.9 s | 15 tests push to real remotes, publish new branches and read each refusal by git's words. |
| `src/noldova.git/tests/tools/git-tools.test.ts` | 32.8 s | 9 tests run each agent tool through Noldova Desktop's tool registry and real git, the writes against a real remote. |
| `src/noldova.git/tests/runtime-part.test.ts` | 31.3 s | 28 tests activate the runtime part and run each of its methods through real git, and its watch through real file-system events. |
| `src/noldova.git/tests/services/write.runner.test.ts` | 25.9 s | 11 tests run each write's real git after reading the status again, and when the person denies or the repository changes. |
| `src/noldova.git/tests/services/branch-switch.writer.test.ts` | 25.9 s | 9 tests switch real branches, with hooks, submodules and filters, and the files a switch would overwrite. |
| `src/noldova.git/tests/services/status.reader.test.ts` | 24.5 s | 14 tests read the real status of conflicts, submodules, renames, upstreams and paths that aren't UTF-8. |
| `src/noldova.git/tests/services/diff.reader.test.ts` | 19.5 s | 15 tests read real diffs of the worktree, the index, a range, conflicts and submodules. |
| `src/noldova.git/tests/services/commit.writer.test.ts` | 18.2 s | 11 tests commit for real, with hooks that pass and refuse. |
| `src/noldova.git/tests/services/program-runner.test.ts` | 15.5 s | 16 tests start real git, and a stand-in gh, through Noldova Desktop's process supervisor, with its limits, its time limit, a held index lock and a missing program. |
| `src/noldova.git/tests/services/change-monitor.test.ts` | 14.6 s | 20 tests watch real repositories through file-system events and read each change with real git. |
| `src/noldova.git/tests/services/branch-create.writer.test.ts` | 14.5 s | 8 tests create real branches, with hooks, and name each session's own branch against its remotes. |
| `src/noldova.git/tests/services/stage.writer.test.ts` | 13.9 s | 6 tests stage real changes, with hooks and filters, and read git's refusals. |
| `src/noldova.git/tests/services/filter-options.reader.test.ts` | 12.7 s | 11 tests read the filter drivers of real repositories' configuration and submodules. |
| `src/noldova.git/tests/services/unstage.writer.test.ts` | 12.0 s | 6 tests unstage real changes, from HEAD and before the first commit, with hooks. |
| `src/noldova.git/tests/services/line-counts.reader.test.ts` | 9.9 s | 8 tests count the lines of real changes, binary and text. |
| `src/noldova.git/tests/services/checkout-risks.reader.test.ts` | 9.6 s | 2 tests read the hooks and filters of real submodules at several depths. |
| `src/noldova.git/tests/tools/git-write-tool.test.ts` | 9.3 s | 2 tests run a write tool through Noldova Desktop's tool registry and real git, and read the status after it. |
| `src/noldova.git/tests/services/pick.writer.test.ts` | 7.0 s | 7 tests cherry-pick and revert real commits, merges too, and stop on a conflict or abort a pick that changes nothing. |
| `src/noldova.git/tests/services/repository-statuses.test.ts` | 6.6 s | 2 tests read the status and a remote of real repositories, as the runtime part's methods do. |
| `src/noldova.git/tests/services/log.reader.test.ts` | 6.4 s | 8 tests read real history, with merges and before the first commit. |
| `src/noldova.git/tests/services/operation.reader.test.ts` | 6.4 s | 8 tests read the merge, cherry-pick, revert and rebase that real git stops in on a conflict. |
| `src/noldova.git/tests/services/hooks.reader.test.ts` | 6.0 s | 11 tests read the hooks of real repositories, from their hooks folder and core.hooksPath. |
| `src/noldova.git.github.window/tests/app/components/github-sign-in/github-sign-in-look.spec.ts` | 5.1 s | 44 look tests draw each sign-in state in Settings in light, dark and forced colours, measure its edges in rem and save screenshots. |
| `src/noldova.git/tests/services/remote.reader.test.ts` | 5.0 s | 4 tests read the remotes of real repositories. |
| `src/noldova.git/tests/services/branches.reader.test.ts` | 4.5 s | 5 tests read real branches, remotes and remote branches. |
| `src/noldova.git/tests/services/repository.reader.test.ts` | 4.2 s | 8 tests read the folders of real repositories and their linked worktrees. |
| `src/noldova.git.window/tests/app/components/git-view/git-view-look.spec.ts` | 3.9 s | 19 look tests draw the Git view in a 25rem dock in light, dark and forced colours, measure its cards, rows and diff in rem and save screenshots. |
| `src/noldova.git/tests/services/worktrees.reader.test.ts` | 3.7 s | 4 tests list real worktrees, before the first commit and of a bare repository. |
| `src/noldova.git.github.window/tests/app/components/github-host-row/github-host-row-look.spec.ts` | 3.2 s | 12 look tests draw the pull request row in light, dark and forced colours and measure it in rem. |
| `src/noldova.git.azure-devops.window/tests/app/components/azure-devops-host-row/azure-devops-host-row-look.spec.ts` | 2.9 s | 15 look tests draw the Azure DevOps pull request row in light, dark and forced colours and measure it in rem. |
| `src/noldova.git.azure-devops.window/tests/app/components/azure-devops-sign-in/azure-devops-sign-in-look.spec.ts` | 2.6 s | 42 look tests draw each Azure DevOps sign-in state in Settings in light, dark and forced colours and measure its edges in rem. |
| `src/noldova.git/tests/fixtures/repository.fixture.test.ts` | 2.6 s | 4 tests make and copy the template repository the other tests use, and run git through its fake prompts. |
| `src/noldova.git/tests/services/lfs-pointer.reader.test.ts` | 2.2 s | 5 tests read real LFS pointers and attributes against the files in the worktree and the index. |
| `src/noldova.git/tests/services/graph.reader.test.ts` | 1.9 s | 5 tests read every branch's real commits with their labels, a page at a time. |
| `src/noldova.git/tests/services/repository-items.reader.test.ts` | 1.9 s | 5 tests read the real tags, stashes and submodules of repositories, cut at their limits. |
| `src/noldova.git/tests/services/git-version.reader.test.ts` | 1.8 s | 4 tests start real git for its version. |
| `src/noldova.git/tests/services/branch-at.writer.test.ts` | 1.7 s | 2 tests make real branches at a commit without switching, and read git's refusals. |
| `src/noldova.git/tests/tools/git-read-tool.test.ts` | 1.6 s | 2 tests run a read tool through Noldova Desktop's tool registry and real git. |
| `src/noldova.git/tests/tools/tool-text.test.ts` | 1.5 s | 3 tests cut long reads to the agent's limit, item by item. |
| `src/noldova.git.window/tests/app/components/git-branch-card/git-branch-card.component.spec.ts` | 1.4 s | 19 specs render the branch card in a browser, open its menu and run its writes against the fake context. |
| `src/noldova.git.window/tests/app/components/git-file-group/git-file-group.component.spec.ts` | 0.7 s | 8 specs render the file groups in a browser and open each row's diff. |

A test that never finishes fails at the run's one limit, 160 seconds for each test and hook in `vitest.config.ts`, over three times the slowest file above (3 × 53.0 s is 159.0 s), so a hang fails, naming the test, while a slow machine never fails a test that passes; no test sets a limit of its own.

## Flake proof

The "Flake proof" workflow, `.github/workflows/flake-proof.yml`, calls the organization's shared flake proof, which the `.github` repository's README describes under "Proving flakes", pinned to a full commit SHA.
It runs an npm script, `npm test` unless another is named, many times on GitHub-hosted Linux, Windows and macOS runners, as "Build and test" does, to show that a fix holds a flaky test steady.
A member starts it by hand, and each job builds once and then runs the tests in a loop:

```bash
gh workflow run flake-proof.yml -R noldova-com/git --ref <branch> -f runs=10 -f jobs=2 -f "targets=linux-x64 windows-x64"
```

| Input | What it takes | Default |
|---|---|---|
| `ref` | The branch, tag or commit to test. | The branch the run starts on. |
| `filter` | The arguments the script takes, separated by spaces; for `npm test`, the arguments it passes to Vitest, such as a test file's path: a root suite file keeps measuring coverage but drops its gates, and a window spec runs without coverage; empty runs the whole suite. | Empty. |
| `script` | The npm script each run runs with the filter. | `test` |
| `prepare` | The npm scripts each job runs once after the build and before the runs, separated by spaces. | Empty. |
| `display` | Runs each run on Linux under a virtual display and a session bus, for a script that opens windows and starts no display. | Off. |
| `runs` | The runs per target, 1 to 200, shared among the jobs, each of which stops after 120 minutes. | 10 |
| `jobs` | The parallel jobs per target, 1 to 4, so that CI keeps runners free. | 2 |
| `targets` | The targets, separated by spaces, from `linux-x64`, `linux-arm64`, `windows-x64`, `windows-arm64`, `macos-x64` and `macos-arm64`. | `linux-x64 windows-x64` |

The run's summary gives each job's runs, passes and failures; a failed run's last 60 log lines are in the job's log, and its whole log in the job's artifact for the days the shared settings name. Each run may take an even share of the job's time still left, keeping three minutes for the artifact; a run that reaches its share is stopped, named as having reached its limit and counted as failed.

The flake-proof job's concurrency group is named by `ref` and the first 16 hex digits of the SHA-256 of the script, the prepare scripts, the display switch and the filter, which a first job, "Concurrency group", works out, since GitHub refuses a run whose group is over 400 characters before it starts, as a filter that names several tests in full makes it.
Runs of different inputs go side by side; a second run of the same `ref` and the same four inputs shows its first job done and waits at its flake-proof job until the first run ends.

## Releases

The ten packages are published to npm together, at one version, by the "Release npm packages" workflow, `.github/workflows/release-npm.yml`, and a release never deletes a published version.
It publishes through npm's trusted publishing, with provenance, so no token is stored: each package's trusted publisher on npm is this repository's `release-npm.yml` in the `release` environment.
[documents/ARCHITECTURE.md](documents/ARCHITECTURE.md#the-package) says how a version is built, checked and released, and [CHANGELOG.md](CHANGELOG.md) what each version changed.

## License

The code in this repository is licensed under the [MIT License](LICENSE).
Its third-party packages keep their own licenses, which their packages carry.
The window parts draw icons from [Primer Octicons](https://github.com/primer/octicons), under the MIT License, and the Azure DevOps window part's reference chips from [Material Symbols](https://github.com/google/material-design-icons), under the Apache License 2.0, which each window part's `THIRD-PARTY-NOTICES.md` names and its package carries.

Angular, Azure DevOps, Git, GitHub, GitLab, Linux, macOS, npm, Vitest and Windows are names of their owners.

## Trademarks

The code is under the MIT License, while the name "Noldova" and its logo are not: the MIT License grants no right to them.
A build from this code that is published by anyone but Noldova uses another name and its own logo.

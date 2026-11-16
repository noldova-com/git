# Testing

**Scope:** What the pull request checks verify in this repository, and what the modules' tests cover on which targets.

The organization's testing standard, `https://github.com/noldova-com/.github/blob/main/standards/TESTING.md`, applies here in full.

## The pull request checks

Every pull request into `main` must pass both checks before it merges.
Both run in GitHub Actions on GitHub-hosted runners, which the `.github` repository's shared `versions.yml` names.

| Check | What it verifies |
|---|---|
| Check / Linked issue | The organization's shared check, `linked-issue.yml` in the `.github` repository, which `.github/workflows/require-linked-issue.yml` calls from its `check` job, named "Check": the PR description has a standalone `Issue: #N`, `Issue #N` or closing reference, such as `Closes #N`, that names an issue in this repository. |
| Build and test / All targets | Every target's job passed. |

"Build and test" calls the `.github` repository's shared `build-and-test.yml` with `publishes: true`. On each target it builds and packs the seven packages with `npm run build`, which runs `npm ci` first when there is no `node_modules`, checks the toolchain, Node.js 24.21.0 with npm 11.19.0, and that every tracked text file uses LF line endings, runs every check with `npm test`, and checks that the tests left the tracked files unchanged; on each target it also checks the archives as the release does, and on Linux x64 that a second build from a clean checkout packs the same archives.
The repository has one install: the root's `package.json` and `package-lock.json`. The packages under `src` aren't npm workspaces; `npm run build` installs each from its packed archive, so the tests import what an app installs. Those installs keep the `@noldova/` versions already in `node_modules`, so the tests run against whatever Noldova Desktop and context the install holds, which the Module range workflow moves without saving.
After the install, `npm run build` fails when `npm ls @angular/cdk --all` or `npm ls @noldova/context.core --all` at the repository's root lists more than one copy, naming each copy's version and path, or none, with `scripts/checks/package-copy-check.ts`; a second copy of `@angular/cdk`, which npm nests under the UI kit without a warning when the window part pins another version, would run the kit's overlays and focus handling apart from the window part's, and a second copy of `@noldova/context.core`, which npm nests under a package that pins context's packages rather than taking them as peers, throws when it loads. It then compiles the hosting protocol, and each module's protocol and runtime part, with the TypeScript compiler into `_build`, compiles each window part with Angular's compiler in partial compilation mode, packs the seven packages into `_packages`, and checks the archives, failing on any finding ([ARCHITECTURE.md](ARCHITECTURE.md#the-package)).
`npm test` runs `scripts/test.ts`, which stops at the first step that fails.
It first runs the declaration check, `scripts/declarations/declaration-check.ts`, which fails on any problem in each module's `module.json` and its two manifests, naming the module's folder: the declaration's fields and names, that its `dependencies` is an object from module ids to exact versions, the package's name, version and private flag, that every entry of `dependencies`, `devDependencies` and `optionalDependencies` is pinned exactly, that `noldovaDesktop` runs from a version to the next minor below 1.0, or the next major from 1.0, that the package's `peerDependencies` on Noldova Desktop's packages name it and its others an exact version or, on context's and the kit's packages, a range of the same form, that the window manifest takes context's packages only as peers of that form and holds no other peer, that the root's `devDependencies` pin of each context peer is inside its range, that the root's and the window projects' Noldova Desktop pins are inside it, that its manifests pin the same runtime `dependencies` as the root manifest, and that a module's manifests list each of the root manifest's `dependencies`.
Then `scripts/checks/default-change-detection-check.ts` fails on any `@Component` under `src` that sets OnPush change detection, naming each file and line: Angular 22 makes OnPush the default, so the option does nothing.
The finder reads each file's syntax tree with TypeScript's API. It finds the decorator through its `@angular/core` import, renamed or through a namespace too, takes the `changeDetection` key bare, quoted or shorthand, and takes `OnPush` as a member, an element, a bare name or its value `0`, with the key and value on one line or several. It doesn't follow options passed in a variable.
It then type-checks the repository automation under `scripts`, the hosting protocol's and each module's source and tests with the TypeScript compiler, and runs every `*.test.ts` file under the parts' and the hosting protocol's `tests` folders with Vitest.
Vitest gives each test and hook one limit, 160 seconds in `vitest.config.ts`, only as a guard against a hang: over three times the slowest test file on any target (README lists the times), so a test that passes never fails for a busy machine, and one that never ends fails, named in the log; no test sets a limit of its own, and each waits on what it checks rather than on time.
After the whole suite, `scripts/checks/test-time-check.ts` reads each file's time from Vitest's JSON report, `_build/test-times.json`, and names each file over 1 second that README's [Test files over 1 second](../README.md#test-files-over-1-second) doesn't list, each listed file over its listed time, and each listed file the run no longer has; it never fails for a time, and fails only when the report can't be read; a filtered run skips it.
The 1 second per file is a timing check, kept apart from the gate: `npm run test:timing` (`scripts/timing/test-timing.ts`) runs the root suite and each window part's specs 3 times and fails a file whose median is over 1 second that the list doesn't name, a listed file whose median is over its listed time plus 50%, or a listed name the runs no longer have.
Then it runs each window part's tests itself, in `src/noldova.git.window` and then `src/noldova.git.github.window`, with no npm script: it removes Vite's pre-bundled dependencies under `node_modules/.vite`, as the Angular standard says, `ngc` type-checks the part, Playwright installs its headless Chromium shell when it is missing, with a 10-minute deadline, and `ng test`, Angular's unit-test builder, runs every `*.spec.ts` under the window part's `tests`, the look specs among them, with Vitest in headless Chromium through Playwright, on a build with the kit's stylesheet, which each part's `tests/kit-stylesheet.setup.ts` loads before the specs.
The Git part's look spec draws the Git view in a 25rem dock in light and dark mode, measures its cards, rows and inline diff in rem, then draws it again in forced colours, through Chrome DevTools' media emulation, and checks the same measures, the cards' borders, the diff lines' signs and the Highlight outline on the open row and the open branch, and the Highlight fill on the branch menu's active option, and saves each screenshot under `_build/window/screenshots`.
The GitHub part's sign-in look spec measures the page's edges and gaps in rem in the settings column, in every state and in light and dark, and saves a screenshot of each under `_build/github-window/screenshots`.
Its host row look spec draws the row in a 25rem dock in light and dark and measures the pull request card's insets, gaps and checks in rem, the signed-out and no pull request lines, and the state and check colours, then checks the row's icons, title and border in forced colours, which it turns on through Chrome DevTools' media emulation, and saves each screenshot there too.
The GitHub sign-in specs and its look spec fake only `Date`, `setInterval` and `clearInterval` on the shared page, and restore real timers in `afterEach`. The look specs undo forced colours, the parked pointer and the appearance each in its own `finally`. Window specs pass Desktop's window failures as `tests/fixtures/window-failure.fixture.ts`, since Desktop exports only the abstract `WindowException`, and catch a rethrown failure through `tests/fixtures/unhandled-rejections.fixture.ts`.
Last, `scripts/tests/installed-package/install-and-open.ts` installs every packed package from `_packages` into a fixture app in a new temporary folder outside the repository, so the app can't resolve a package from the repository's own install, and removes the folder after the run; it installs with install scripts off, as an app installs them, so it runs after `npm run build`. It runs twice, with context's packages (`@noldova/context.core`, `.exceptions`, `.json` and `.text`) pinned in the fixture manifest at the lowest version the window part's peer range takes and at the root's pin, once if they are the same. Each time it also installs, packed from the repository's own install, Noldova Desktop's runtime, the module packages' peer, `@noldova/desktop.protocol` and `@types/node`, and fails, naming each copy's version and path, when `npm ls @noldova/context.core --all` in the fixture app lists more than one copy; it type-checks an app's construction of each module's runtime part against the installed declarations, passing `--types node`, since TypeScript 6 loads no `@types` package by default, and `--allowImportingTsExtensions`, since the fixture files import the scripts' `.ts` sources, then, with `scripts/tests/installed-package/open-module.ts`, activates and deactivates each installed runtime part with a context that keeps no secrets and only records methods and events, and fails unless the part was active only in between.
It copies its fixture files, `read-packed-peers.mts`, `read-runtime-part.mts` and `open-module.ts`, with what they import from `scripts` (`resources.ts`, `models/version-range.ts`, `ScriptException` and `InstalledPackageCheckFailedException`, `IInstalledRuntimePart`, `FixtureManifest` and their own `InstalledPackageResources`), into the fixture app's `scripts` folder at the same paths, in an app whose manifest is of type `module`, so they run there with only the app's install. Each check fails with an `InstalledPackageCheckFailedException`, whose message the file prints before it exits with 1. `read-packed-peers.mts` reads the packages' context peers with the scripts' own `VersionRange`, after checking that reading against its samples. `read-runtime-part.mts` is left out of the scripts' own type check, since the repository's install doesn't hold the packages it imports; the fixture app type-checks it.
The automation under `scripts` has no tests of its own, as the organization decided for every repository: its checks run, and nothing measures it.
Arguments make a filtered run, as `npm test -- <test file>` does.
A window spec, named from the repository root with forward slashes, runs alone in its window part after the cache removal, `ngc` and the Playwright install, through `ng test` without coverage.
Vitest takes the other arguments as the root suite's filters and still measures coverage, but the coverage gates are off, since only the whole suite can meet them; a filtered run is not the gate.

### Running CI's other steps

These steps of "Build and test" aren't part of `npm test`; each runs locally after `npm run build` on a clean checkout, with the pipelines tool the shared workflow pins, `@noldova/tools.pipelines.github@0.0.20`, installed with `npm install --prefix <folder> @noldova/tools.pipelines.github@0.0.20`, whose `node_modules/.bin/pipelines` runs them:

- `pipelines toolchain 24.21.0 11.19.0`: Node.js and npm are the versions the repository pins.
- `pipelines line-endings`: every tracked text file uses LF line endings.
- `pipelines unchanged`: the build and tests changed no tracked file.
- `pipelines reproducible _packages`, on Linux x64 in CI: a second build packs the same archives.
- `pipelines archive _packages <version> <commit> @noldova`, with `version.json`'s version and `git rev-parse HEAD`: the archives carry that version and commit and only the release's scope.

`npm test -- --skip-test-details --skip-coverage-details` runs the checks as CI does, without the per-test and per-file lists.
Only GitHub runs the rest: the hosted Windows runners' move of npm's temp files off the system disk, "All targets", the linked-issue check, the release, Relock and the flake proof's loop.

## Coverage

`npm test` without arguments measures coverage with Vitest's V8 coverage and fails below 100% of the statements, lines, branches and functions.

| Scope | Requirement |
|---|---|
| Each module's production code under `src` | 100% of lines, branches and functions. |
| Repository automation under `scripts/` | Not measured: scripts have no tests of their own, as the TypeScript standard says; the installed-package test under `scripts/tests/` checks the packed packages, not the scripts. |
| Test files, the files under each `tests` folder | Not measured: they are the tests, not the code under test. |
| Third-party packages under `node_modules` | Not measured. |
| JSON declarations and manifests, and YAML workflows | No coverage percentage; the declaration check under `npm test` checks `module.json` and the manifests, and the workflows' own runs check the YAML. |

No production file is excluded but the window parts' enum files and class-metadata calls, which [README.md](../README.md#checks) names with their reasons.
The coverage includes every `.ts` file under `src` outside the `tests` folders and the window part, so a file that no test loads counts as uncovered and fails the gate.
The window part's specs measure its `src` the same way, through the unit-test builder's V8 coverage; besides enum files, the only code they skip is the compiler's development-mode class-metadata calls, which `scripts/angular/class-metadata-coverage.ts` marks and counts.

## The targets

The modules' tests run on Linux x64, Windows x64 and macOS arm64 for every pull request, draft or ready, and on pushes to `main` and runs started by hand on all six targets, Linux arm64, Windows arm64 and macOS x64 too, on GitHub-hosted runners.
The workflow's one job, `build-and-test`, named "Build and test", calls the shared workflow, which runs one job per target, such as "Linux x64", which GitHub lists as "Build and test / Linux x64", and its "All targets" fails unless every one of them passed.

## What the tests cover

On every pull request and every push to `main`, on every target:

- Each module's protocol names, against the module's own `module.json`.
- Each module's runtime part's activation and deactivation, as a unit test and from the installed package.
- Each protocol's export map and declarations from the installed packages: the fixture app compiles and runs a file that reads each module's protocol names and the hosting protocol's `HostReference`.
- The packed peers: the fixture app reads the installed GitHub window part's manifest and fails unless it takes the Git window part as a peer at the installed Git window part's version, and not as a dependency.
- Each module's window part's export and its activation, reconnection and deactivation, in headless Chromium.
- The hosting protocol's reference: its parts, how it writes itself, its JSON's round trip, and each part and field it refuses.
- Each Git protocol model's rules, its JSON form both ways, and its refusals: a field it doesn't define, a missing field or one of the wrong type, and a value its rules refuse, each named by its path.
- The hosting protocol's sign-in models: each state's fields, what each refuses, and how each writes and reads itself; and the names `HostingNames` builds.
- The GitHub module's device flow against a fake GitHub: each request's address, headers and body, and every answer GitHub gives, including an error status, a body that isn't JSON, a field out of its range, a failed or stopped request.
- The GitHub module's sign-in on fake timers, with Noldova Desktop's fakes of secrets and app windows: polling at GitHub's interval and slowing down, expiry, denial, a failure to reach GitHub or to keep the token, an unknown failure, which is logged and rethrown rather than taken for a refusal, cancel at each step, a second start, restoring a kept, revoked, unreadable or not yet readable sign-in, sign-out with and without the token's removal, and disposal, a cancel as the code arrives, which leaves no wait or poll, a quit during the token's save, which keeps the token, and a failed save, which leaves the token kept before. The waits run on Vitest's mock clock, with `timers.setTimeout` of `node:timers/promises` pointed at it by `tests/fixtures/mock-clock.fixture.ts`, since Vitest 5.0.3's fake timers don't patch that module.
- The GitHub module's runtime part's methods and event, with the global `fetch` stubbed.
- The Git module's runtime part against real repositories the tests make, with git started through Noldova Desktop's own process supervisor, behind its `FakeRuntimePartContext`: `git.status` and its failures' codes; the status's entries, upstream, conflicts, submodules, paths that aren't UTF-8, line counts, operation, remote and fingerprint; running git with its limits, its time limit and a missing program; the repository's folders and git's version; and each parser against git's output, including output that was cut or that it can't read.
- The GitHub module's agent tools through Noldova Desktop's own tool registry against a fake GitHub: what each offers, its answer, each argument its schema refuses, each failure, the bound folder's refusals, the pull request's permission request and each answer to it, and its withdrawal, as a unit test; and from the installed package, that the runtime part withdraws every tool it registered on deactivation.

Git's answers are scripted or a failure is stood in only where real git or the platform can't give it:

- cut, malformed or old git's output, a single command's exit 128 or 129, and one `diff --no-index` answer that git on Windows gives differently;
- `diff.reader` and `pull.writer` meeting dubious ownership, which can change only between the repository read and the later command;
- `operation.reader`'s `head-name` of `refs/heads/` and a folder in place of `MERGE_HEAD`, which git never writes;
- `repository.reader`'s denied folder on Windows, since Windows can't deny it as POSIX does, and `changes-digest`'s denied file read on Windows, since an elevated Windows run read past a deny entry for its own account;
- `change-monitor`'s backstop, which removes a watcher's listener, its failed cookie writes, first and repeated, a nameless event emitted on a real watcher, and macOS losing a cookie's event while Node restarts its shared file-system event stream, stood in by dropping a watcher's first cookie events, since the restart can't be forced on demand.

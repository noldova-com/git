# @noldova/git.github

The GitHub module for apps on Noldova Desktop: the sign-in to GitHub, a branch's pull request and its checks, and agent tools that use GitHub through permission requests.
It holds the module's `module.json` and `settings.json`, and its runtime part, which signs in through GitHub's device flow and reads GitHub for the other parts.

It exports `./runtime`, the runtime part, and `./window`, which re-exports the published API of the window part, [`@noldova/git.github.window`](https://github.com/noldova-com/git/tree/main/src/noldova.git.github.window).
It depends on the Git module, [`@noldova/git`](https://github.com/noldova-com/git/tree/main/src/noldova.git), and pins its own window part and [`@noldova/git.github.protocol`](https://github.com/noldova-com/git/tree/main/src/noldova.git.github.protocol) at its own version.

An app installs it pinned exactly beside `@noldova/git` and lists both in `desktop.modules`, as the [README](https://github.com/noldova-com/git#readme) says.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how it is built.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

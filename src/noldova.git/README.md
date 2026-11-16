# @noldova/git

The Git module for apps on Noldova Desktop: a folder's Git state and changes, and agent tools that run Git through permission requests.
It holds the module's `module.json` and its runtime part, which runs the person's own `git` and registers the agent tools.

It exports `./runtime`, the runtime part, and `./window`, which re-exports the published API of the window part, [`@noldova/git.window`](https://github.com/noldova-com/git/tree/main/src/noldova.git.window).
It pins that package and [`@noldova/git.protocol`](https://github.com/noldova-com/git/tree/main/src/noldova.git.protocol) at its own version.

An app installs it pinned exactly and lists it in `desktop.modules`, as the [README](https://github.com/noldova-com/git#readme) says.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how it is built.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

# @noldova/git.azure-devops

The Azure DevOps module for apps on Noldova Desktop: the sign-in to Azure DevOps with a personal access token, and its pull requests with their reviewers' votes, policies and builds.
It holds the module's `module.json` and `settings.json`, and its runtime part, which keeps the token in this computer's secrets and reads Azure DevOps for the other parts.

It exports `./runtime`, the runtime part, and `./window`, which re-exports the published API of the window part, [`@noldova/git.azure-devops.window`](https://github.com/noldova-com/git/tree/main/src/noldova.git.azure-devops.window).
It depends on the Git module, [`@noldova/git`](https://github.com/noldova-com/git/tree/main/src/noldova.git), and pins its own window part and [`@noldova/git.azure-devops.protocol`](https://github.com/noldova-com/git/tree/main/src/noldova.git.azure-devops.protocol) at its own version.

An app installs it pinned exactly beside `@noldova/git` and lists both in `desktop.modules`, as the [README](https://github.com/noldova-com/git#readme) says.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how it is built.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

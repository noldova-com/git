# @noldova/git.azure-devops.window

The Azure DevOps module's window part, in Angular: the account on Settings → Accounts and hosts, whose dialog signs in to Azure DevOps with a personal access token, sees the account and signs out, and the Git view's row with a branch's pull request and its builds and policies, and its reference chips for work items, `#N` and `AB#N` in a commit's message among them.
It is compiled by Angular's compiler in partial compilation mode; Angular, Noldova Desktop's and context's packages, the interface kit and the Git module's window part are optional peers, which the app's window workspace provides.

An app reaches its API through [`@noldova/git.azure-devops`](https://github.com/noldova-com/git/tree/main/src/noldova.git.azure-devops)'s `./window` export, and the module pins it at its own version.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how it is built, and the [README](https://github.com/noldova-com/git#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

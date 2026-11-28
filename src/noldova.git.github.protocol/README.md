# @noldova/git.github.protocol

What the GitHub module's parts share:

- `GitHubNames`: the module's id, Noldova's GitHub app's client id, the sign-in's, the reads', the pull request's and the accounts' method names (`readAccounts`, `addAccount`, `signInWithToken`, `readRepositoryAccount`, `pickAccount` and `useFolder`), the `signInChanged` and `accountsChanged` events, the agent tools' names and the page where the person manages the app's access.
- `IGitHubAccess`, the `git-github.access` service through which another module's runtime part reads a token: `accessAsync` the first account's, and `accessForAsync` that of the account the module reads a repository with, reading the user name in a checkout's remote first when given its folder.
  Each answers a `GitHubAccessGrant` with the token, the account's login and its host, or a `GitHubAccessRefusal` saying why there is none.

Both parts of [`@noldova/git.github`](https://github.com/noldova-com/git/tree/main/src/noldova.git.github) import it by its name, and the module pins it at its own version.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how the parts talk, and the [README](https://github.com/noldova-com/git#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

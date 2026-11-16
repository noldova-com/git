# @noldova/git.github.protocol

What the GitHub module's parts share: `GitHubNames`, the module's id, Noldova's GitHub app's client id, the sign-in's, the reads' and the pull request's method names, the sign-in's event, the agent tools' names and the page where the person manages the app's access; and `IGitHubAccess`, the `git-github.access` service through which another module's runtime part reads the signed-in token, answered as a `GitHubAccessGrant` with the account's login or a `GitHubAccessRefusal` saying why there is none.

Both parts of [`@noldova/git.github`](https://github.com/noldova-com/git/tree/main/src/noldova.git.github) import it by its name, and the module pins it at its own version.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how the parts talk, and the [README](https://github.com/noldova-com/git#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

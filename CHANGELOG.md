# Changelog

**Scope:** What each published version of Git's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## Next version

- **Breaking, `@noldova/git.protocol`:** `ProtocolException` is now abstract and has no `code`; a refused field throws `ProtocolFieldException`, whose `field` and `expectation` name what was refused. Catch `ProtocolException` as before, or `ProtocolFieldException` for the field.
- **Breaking, `@noldova/git.hosting.protocol`:** `HostingProtocolException` is now an abstract base; a refused field throws `HostingFieldException`, and `ArgumentException` is renamed `HostingArgumentException`. Replace `ArgumentException` with `HostingArgumentException`, and catch `HostingProtocolException` for either.
- **Added, `@noldova/git.protocol`:** `GitCode.FolderUnreadable`, for a folder the person's account may not read; the Git window shows it as its own empty state.
- **Added, `@noldova/git.hosting.protocol`:** `SignInFailure.Unforgotten`, for a sign-out whose token couldn't be removed from this computer's secrets; the GitHub window names it.
- **Breaking, every module package:** the modules run on Noldova Desktop 0.0.1, `@noldova/desktop.*` from npm, in place of the earlier `@noldova-com/desktop-*` packages: the peers on its packages are `>=0.0.1 <0.1.0`, `module.json` names that range as `noldovaDesktop`, and the peers on context's packages are `>=0.0.7 <0.1.0`, the version Noldova Desktop 0.0.1 takes. Install `@noldova/desktop.*` 0.0.1 and context 0.0.7 or later below 0.1.0.
- **Breaking, `@noldova/git.protocol` and `@noldova/git.hosting.protocol`:** `DiffScope`'s JSON leaves out `from` and `to` unless the kind is `Range`, and refuses `null`; `pathBytes`, `oldPathBytes` and `originalPathBytes` are `undefined` when absent; `HostPerson`'s `url` is a required argument; `HostSignIn.signedOut`'s failure is optional. Check these for `undefined` in place of `null`, and pass a `url` to `HostPerson`.
- A repository git calls unsafe, and a pull's host-key, refused-key and sign-in failures, are now classified as fetch and push classify them.
- `git.watch` answers once the watch has started, so a change made right after it is heard on macOS too.
- **Changed, `@noldova/git.window` and `@noldova/git.github.window`:** context's packages are peers at `>=0.0.7 <0.1.0`, never dependencies, so an app on context 0.0.8, whose packages pin their siblings exactly, holds one copy of `@noldova/context.core`.
- **Changed, `@noldova/git.github.protocol`:** `IGitHubAccess.accessAsync` answers a `GitHubAccessGrant`, which holds the token, or a `GitHubAccessRefusal`; a check for `"token" in answer` still tells them apart.
- The GitHub module keeps the token it was saving when the app quits mid-save, rather than removing it.
- The GitHub sign-in in Settings no longer says the sign-in didn't answer when a newer sign-in has already arrived.
- Each package's exceptions extend one base, and `@noldova/context.exceptions` is a peer of `@noldova/git`, `@noldova/git.github`, `@noldova/git.protocol` and `@noldova/git.hosting.protocol`; `@noldova/git` also takes `@noldova/context.json` as a peer.

## 0.0.1

- The first version of Git's seven packages, the Git and GitHub modules, their protocols and window parts, and the hosting protocol, published to npm under the MIT License.
- The seven packages move together, as always.

# Security model

**Scope:** Who may write to a person's repositories through the Git modules, each write's risk and permission, what a write refuses even with permission, how the person's own git runs, what failures and logs never carry, and which changes count as risky in review.

The organization's security standard, `https://github.com/noldova-com/.github/blob/main/standards/SECURITY.md`, applies here in full.
The packages, parts, methods and limits are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Threats

The modules act in the person's repositories and on their accounts, for the person and for agents.
They defend against:

- **An agent that oversteps:** it writes without the person's approval, pushes somewhere the person didn't see, forces, resets or rewrites history.
- **A caller that isn't the person:** another client of the runtime calls a write method as if the person had clicked.
- **A request that changes under the person:** what runs differs from what the card showed, because the branch, the staged files or the remote moved before the answer.
- **A repository that steers the module:** its file names, commit messages or git's output tell the module or the agent to act, or its configuration runs a command the person never chose to run.
- **A leak:** a URL's name, password or token, or a host key's trust, that reaches a message, a log, a card or a remote.

The modules trust the app's main process, the person's answers to permission requests and the person's own git and its configuration, as the person's own `git` in a terminal would.
They trust nothing that comes from a repository's contents, from git's output, from an agent's arguments or from a remote.

**The trust boundary:** a person's click, or a write the person allowed, is the person's own git command, so the repository's hooks and filters run as they would from the person's terminal, and every request an agent's write raises names each hook that will run, a checked-out submodule's too when a switch recurses into it, and a stage's or switch's request each filter that will run whose command the repository's own configuration gives.
A read runs nothing the repository names, so no read starts a command from the repository's configuration: before each status and diff, the module switches off the clean and process filters the repository's own configuration names, as ARCHITECTURE.md says.

## Who may write

The write methods, `git.stage`, `git.unstage`, `git.createBranch`, `git.switchBranch`, `git.commit` and `git.push`, are the person's own clicks in the Git view.
Each answers `Unauthorized` to any caller but the app's main process acting for a window, before it reads its parameters, so the command line, another client or a client with no window can't write as the person.
The check rests on the client name the connection's handshake gives, which Noldova Desktop checks for the main process; it keeps out other clients, not other programs that run as the same person.
A person's own click never asks.

An agent writes only through its tools, `git_stage`, `git_unstage`, `git_create_branch`, `git_switch_branch`, `git_commit`, `git_push` and `git_pull`, which act only in the repository that holds the session's `git.folder` binding, never one an argument names; each of its writes that asks raises Noldova Desktop's permission request through the tool's call before anything runs, and marks its point of no return only after the person's answer and the stale checks, just before git starts.

## Each write's risk and permission

| Write | Risk | The request |
|---|---|---|
| Stage, unstage, create a branch | Low | None, since the person undoes each in the Git view; but when a hook of the repository would run, `post-index-change` for each, and `post-checkout` or `reference-transaction` for a new branch, it asks, naming the hooks, with the paths of a stage or unstage; it asks too when the hooks can't be read, such as when git can't name their folder or a hook's file can't be read, saying they are unknown, and never takes that for no hooks; a stage asks the same way when the repository's own configuration names a `clean` or `process` filter, naming the filters; "Always allow" holds for the repository. |
| Switch a branch | Medium | Asks, with the branch it switches from and to, how many unstaged changes stay, the hooks that will run and the `smudge` or `process` filters the repository's own configuration names, and with `submodule.recurse` each checked-out submodule's filters and the hooks that move it, `post-index-change` and `reference-transaction`, with its path, since a switch moves a submodule by read-tree and update-ref, not a checkout; "Always allow" holds for the repository. |
| Commit | Medium | Asks, with the message as the agent wrote it, every staged file, the author from the person's Git settings and the hooks that will run; "Always allow" holds for the repository. |
| Pull | Medium | Asks an agent's pull, with the branch, its upstream, the hooks that will run, `post-merge`, `post-index-change` and `reference-transaction`, and the smudge or process filters its checkout will run; with `submodule.recurse` it names each checked-out submodule's filters and checkout hooks, `post-checkout`, `post-index-change` and `reference-transaction`, with the submodule's path, since the pull's submodule update checks each one out after its merge; "Always allow" holds for the repository. The person's own Pull in the Git view never asks. A pull only fast-forwards, so it never makes a commit or drops one. |
| Push | High, or Medium for the session's own branch | Asks with the remote's name and push URL, the branch and the branch it goes to, the commits it sends and the hooks that will run. "Always allow" is offered only for a branch the agent's session made itself, pushed under its own name, and never for the remote's default branch, nor when the module can't tell the default branch; that push is Medium risk, so a host's unrestricted mode, one that asks for nothing, pushes it without a card, as it does a commit, a switch or a pull. Every other push is High risk and always asks, in every mode. |
| Open a pull request | High | Always asks, with the repository on GitHub, the branch it comes from and the branch it goes into, the title and the whole body as the agent wrote them, and whether it is a draft, so the person can read everything the pull request will publish; the title can't hold a line break. It offers only "Allow once" and "Deny", never "Always allow", so no remembered answer opens a pull request. |

A branch counts as the session's only when no remote had a branch of that name when the session made it, so a push never offers "Always allow" for someone else's branch.
Noldova Desktop remembers an "Always allow" by the action, the subject and the conversation, so the push request that offers it names the session in its subject: the remembered answer holds only for that session's later pushes of the branch, and never for another session's in the same conversation.
A Low- or Medium-risk request that offers it gives its words, "Always allow in this repository", since a host leaves out an Always option that comes without them. For the other writes the grant holds for the repository; for a push it holds only for that session's later pushes of that branch to that remote, as above.
Noldova Desktop refuses a High-risk request that gives words and offers Always allow, and that rule stays as it is. So only the push of the session's own branch, at Medium risk, offers Always allow, with the words "Always allow in this repository"; every other push is High risk and offers only Allow once and Deny.
The module remembers which branches each session made only while it runs, and a restart starts new sessions, so after a restart every push asks.

## What a write refuses

- **A request that moved:** each write names the status it is based on by its fingerprint. A status that moved since fails as `Stale`, and after the person allows a request the module reads the status and the request again, one write at a time per repository, and runs nothing when either changed. An agent's request is read again even when it asked nothing, so a write that came to need an ask while it waited runs nothing.
- **A request it can't show exactly:** a request whose details pass Noldova Desktop's limits, such as a commit of more files than the card holds, or a commit whose status was cut short, is refused before it is raised.
- **History:** no write forces, resets, amends or rewrites history. A push sends only the current branch's commit as the status read it, through a refspec the module builds from that commit and the checked branch name, never with `+`, with no tags and no submodules, so a commit that reached the branch after the request was shown is never sent; it publishes a branch without an upstream under its own name and sets that as its upstream.
- **A push it would lose:** a push behind its upstream, as of the last fetch, is refused as `PushRejected`, and a push the remote refuses fails the same way.
- **A switch during a merge, rebase, cherry-pick or revert**, and a commit with nothing staged or with conflicts left.
- **A held lock or an unsafe repository:** a write git refuses because `index.lock` is held, as its error says, is reported as `IndexLocked` and the lock is never deleted, and a repository git calls unsafe fails as `NotRepository` with the Git code `UnsafeRepository`, naming the folder, and is never added to `safe.directory`.
- **A host key:** the module never trusts a host key; an unknown or changed key fails as `HostKeyUnknown` with git's output, and the person checks and trusts it from their own terminal.

## The person's own git

The module runs the person's `git` through Noldova Desktop's `startProcessAsync`, never a shell, with no terminal prompt, `GCM_INTERACTIVE=never` and `GIT_LITERAL_PATHSPECS=1`; arguments that name a path come after `--`, and a revision after `--end-of-options`.
Every run, a write too, passes `-c core.fsmonitor=false`, so a command that a repository's own configuration names as its fsmonitor never runs from the module.
Starting a watch writes one empty file into the repository's git folder, `noldova-watch-<random>`, and one into `refs/heads`, `noldova-watch-<random>.lock`, a name git never reads as a branch, and removes both as soon as the watch reports them; the module removes no other file there, except such files an earlier run left behind.
Everything else is the person's own git behaviour, as a commit or push from their terminal would be:

- hooks run: `pre-commit`, `prepare-commit-msg`, `commit-msg` and `post-commit` on a commit, `post-checkout` on a switch or a new branch, `pre-push` on a push, `post-index-change` on each write that writes the index, and `reference-transaction` on each that moves a ref; the module never passes `--no-verify`, and each request an agent's write raises names the hooks of these that the repository has;
- the person's identity, signing settings and credential helper apply, from the home the module passes on as `HOME`, or on Windows `HOMEDRIVE` and `HOMEPATH`, and a remote that asks for a name or password with no helper to answer fails as `CredentialsNeeded`;
- a filter driver the repository names, such as Git LFS's, runs when a write stores or checks out a file, since switching it off would store or check out something else: a stage without LFS's clean filter would commit the whole file instead of its pointer; an agent's stage or switch names the repository's own filters in its request.

So a repository's hooks and filters run code the repository names, with the person's rights, as they do for the person's own git; the module adds no sandbox around them, and turns none of them off for a write, since a hook such as Git LFS's is part of how the repository works.

## What failures and logs never carry

- A URL's name, password or token, also when git prints one: a push request shows the push URL without them, and every failure message, and the git output an agent tool's failure carries, strips them.
- git's output comes with a failure as untrusted text, marked as the repository's, never as the module's words or instructions.
- A file name, commit subject or author in a request or a message has each control character replaced before the module shows it.

## Risky changes

A change to any of these is risky in review:

- who may call a write method, or the check of the caller;
- the risk table, which writes ask, what a request shows and what "Always allow" holds for;
- the stale checks, or what a write runs between the person's answer and git;
- the arguments a write passes to git, above all a push's refspec, its remote and its options;
- which of the person's git settings, hooks or filters run, or are turned off;
- what failures, cards and logs carry from git's output or a remote's URL;
- a new write;
- which modules can read the GitHub token through `git-github.access`, or what it answers.
- which hosts the GitHub token goes to, or what the avatar read sends, follows or takes.

A risky change comes with tests that drive its failure path: a caller that isn't the main process, a status or request that moved, each denied, expired or withdrawn answer, each refusal above, and a request over Noldova Desktop's limits.

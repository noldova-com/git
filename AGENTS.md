# Agent instructions

Noldova owns this repository and makes the final decisions.

## Documents

Read the owner before you work on its subject, and change a rule there.

| When you… | Read |
|---|---|
| explain what Git is or who uses it | [README.md](README.md) |
| change the modules' parts or their boundaries, or write code in this repository | [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) |
| change what a write runs, what asks the person, what "Always allow" holds for, or what failures and logs carry, or review a change for risk | [documents/SECURITY-MODEL.md](documents/SECURITY-MODEL.md) |
| write tests or change what the checks cover | [documents/TESTING.md](documents/TESTING.md) |
| write code, tests, styles, documents or commits | the organization's standards, `https://github.com/noldova-com/.github/blob/main/standards/AGENTS.md` |
| build or change anything a person sees | the organization's UI standard, `https://github.com/noldova-com/.github/blob/main/standards/UI.md` |
| prepare or run a release | [README.md, Releases](README.md#releases) |

## Work

- Every pull request names the issue it resolves in this repository, such as `Closes #N`, and passes the checks [TESTING.md](documents/TESTING.md#the-pull-request-checks) lists.

## Git

- The repository holds the local Git module and the GitHub module, each in its own folders in `src`; the GitHub module depends on the local module and the shared hosting protocol.
- Git is a set of modules on Noldova Desktop: they install Noldova Desktop's packages and `@noldova/ui.components.angular` as published versions; never copy, fork or override their files, tokens or styles, and ask for a change through an issue in their repositories.
- The modules name no app; an app that includes one configures it through its published API.
- Git's public API is everything its packages export.
  A change that breaks it gets a new major version, release notes and a migration path for every app that uses it.
- Git writes to the person's repositories and acts on their accounts: a change to which repositories or accounts an agent reaches, what a permission request shows or binds, how a sign-in or token is kept, or what a push, merge or comment sends is a risky change, and its review says so.

# @noldova/git.hosting.protocol

What every host module of Git shares: a reference to an issue or pull request on a host, the item and its checks, a branch's pull request, a pull request draft, and the sign-in's account and device code.

A host module, such as [`@noldova/git.github`](https://github.com/noldova-com/git/tree/main/src/noldova.git.github), implements it: its runtime part reads the host into these models, and its window part shows them.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how the parts talk, and the [README](https://github.com/noldova-com/git#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

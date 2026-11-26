# @noldova/git.azure-devops.protocol

What the Azure DevOps module's parts share: `AzureDevOpsNames`, the module's id, the token sign-in's and the reads' method names, the sign-in's event and the capabilities the module offers, as `HostCapabilities` from [`@noldova/git.hosting.protocol`](https://github.com/noldova-com/git/tree/main/src/noldova.git.hosting.protocol).

Both parts of [`@noldova/git.azure-devops`](https://github.com/noldova-com/git/tree/main/src/noldova.git.azure-devops) import it by its name, and the module pins it at its own version.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/git/blob/main/documents/ARCHITECTURE.md) says how the parts talk, and the [README](https://github.com/noldova-com/git#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/git/blob/main/LICENSE).

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { WorkItemCategory } from "@noldova/git.hosting.protocol";
import { GitNames, GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { afterEach, describe, expect, it } from "vitest";

import { BranchRequest } from "../../../../src/app/models/branch-request.ts";
import { AzureDevOpsCommitPrefixes } from "../../../../src/app/services/azure-devops-commit-prefixes.ts";
import { BranchDialog, BranchDialogData, BranchDialogReads } from "../../../fixtures/branch-dialog.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const reads: string[] = [GitNames.statusMethod, GitNames.branchesMethod, AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readWorkItemMethod,
  AzureDevOpsNames.readWorkItemsMethod];
const name: string = "users/mona-lisa/7532-tag-filter-ignores-case-in-note-titles";
const choices: readonly string[] = ["Link the branch to 7532 in Azure Boards", "Set 7532 to Active and assign it to me", "Start commit messages with #7532",
  "Push and track it on origin"];

class Step {
  public readonly method: string;
  public readonly shown: string;

  public constructor(method: string, shown: string) {
    this.method = method;
    this.shown = shown;
  }
}

function readsWith(change: (reads: BranchDialogReads) => void): BranchDialogReads {
  const made = new BranchDialogReads();
  change(made);
  return made;
}

function answerWrites(dialog: BranchDialog): void {
  dialog.requests.answer(GitNames.createBranchMethod, null);
  dialog.requests.answer(AzureDevOpsNames.linkBranchMethod, null);
  dialog.requests.answer(AzureDevOpsNames.updateWorkItemMethod, null);
}

describe("AzureDevOpsBranchComponent", () => {
  afterEach(() => {
    BranchDialog.closeAll();
    localStorage.clear();
    AzureDevOpsCommitPrefixes.restore();
  });

  it("names the work item and its parent, suggests a name from the signed-in person, the id and the title, and starts from the parent's branch", async () => {
    const dialog = await new BranchDialog().openAsync();

    expect([dialog.title, dialog.field.value, dialog.base, dialog.texts]).toEqual(["Create a branch for 7532", name, BranchDialogData.parentBranch,
      ["Tag filter ignores case in note titles · task under 7521", "From the pattern users/{you}/{id}-{title}", "The parent user story's branch"]]);
    expect([dialog.choices, dialog.checked, dialog.disabledChoices, dialog.labels]).toEqual([choices, [true, true, true, false], [false, false, false, false],
      ["Cancel", "Create and switch"]]);
    expect([dialog.requests.methods, dialog.requests.payloads]).toEqual([reads, [{ folder: "/repository" }, { folder: "/repository" }, null,
      { host: "git-azure-devops", organization: "fabrikam", id: 7532 },
      { host: "git-azure-devops", organization: "fabrikam", project: "Sample Project", scope: "Ids", ids: [7521] }]]);
  });

  it("names the work item's type alone when it has no parent, and reads no parent", async () => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.item = BranchDialogData.itemOf(null);
    }));

    expect([dialog.texts[0], dialog.base, dialog.texts.at(-1), dialog.requests.methods]).toEqual(["Tag filter ignores case in note titles · task", "main",
      "The current branch", reads.slice(0, 4)]);
  });

  it("shows the card's title alone when Azure DevOps has no such work item, and no line for an empty title", async () => {
    const missing = await new BranchDialog().openAsync(readsWith(t => {
      t.item = null;
    }));
    const line = missing.texts[0];
    const untitled = await new BranchDialog().openAsync(readsWith(t => {
      t.item = null;
    }), new BranchRequest("/repository", "fabrikam", 7532, ""));

    expect([line, untitled.texts[0], untitled.field.value]).toEqual(["Tag filter ignores case in note titles", "From the pattern users/{you}/{id}-{title}",
      "users/mona-lisa/7532"]);
  });

  it("suggests the id and title alone, with no pattern note, when signed out or when the login has none of the name's letters", async () => {
    const signedOut = await new BranchDialog().openAsync(readsWith(t => {
      t.signIn = BranchDialogData.signedOut();
    }));
    const unnamed = await new BranchDialog().openAsync(readsWith(t => {
      t.signIn = BranchDialogData.signedIn("Привет@fabrikam.com");
    }));

    expect([signedOut.field.value, signedOut.texts.includes("From the pattern users/{you}/{id}-{title}"), unnamed.field.value])
      .toEqual(["7532-tag-filter-ignores-case-in-note-titles", false, "7532-tag-filter-ignores-case-in-note-titles"]);
  });

  it("keeps a name the person typed when the sign-in answers later", async () => {
    const dialog = new BranchDialog();
    const reading = new BranchDialogReads();
    dialog.requests.answer(GitNames.statusMethod, reading.status);
    dialog.requests.answer(GitNames.branchesMethod, reading.branches);
    const release = dialog.requests.hold(AzureDevOpsNames.readSignInMethod);
    dialog.requests.answer(AzureDevOpsNames.readWorkItemMethod, reading.item);
    dialog.requests.answer(AzureDevOpsNames.readWorkItemsMethod, reading.parents);
    dialog.open();
    await dialog.requests.askedAsync(5);
    dialog.field.value = "7532-mine";
    dialog.field.dispatchEvent(new Event("input"));
    dialog.render();
    release(reading.signIn);
    await dialog.settleAsync();

    expect(dialog.field.value).toBe("7532-mine");
  });

  it("starts from the current branch when the parent's branches aren't local, or the parent can't be found among the answers", async () => {
    const elsewhere = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.parentsOf("users/kim/gone");
    }));
    const found = [elsewhere.base, elsewhere.texts.at(-1)];
    const none = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.noParents;
    }));

    expect([found, none.base]).toEqual([["main", "The current branch"], "main"]);
  });

  it("says a detached HEAD's branch starts from its commit, and says nothing of a repository with no commit", async () => {
    const detached = await new BranchDialog().openAsync(readsWith(t => {
      t.status = BranchDialogData.statusOf(BranchDialogData.azure, null).toJson();
      t.parents = BranchDialogData.noParents;
    }));
    const unborn = await new BranchDialog().openAsync(readsWith(t => {
      t.status = BranchDialogData.statusOf(BranchDialogData.azure, null, null).toJson();
      t.parents = BranchDialogData.noParents;
    }));

    expect([detached.base, detached.texts.at(-1), unborn.base, unborn.texts.at(-1)]).toEqual([null, "From commit 1a2b3c4, and switches to it.", null,
      "From the pattern users/{you}/{id}-{title}"]);
  });

  it("offers the base it starts from when the branches can't be read, and logs why", async () => {
    const dialog = new BranchDialog();
    dialog.requests.fail(GitNames.branchesMethod, new WindowFailure("Not connected."));
    const reading = new BranchDialogReads();
    dialog.requests.answer(GitNames.statusMethod, reading.status);
    dialog.requests.answer(AzureDevOpsNames.readSignInMethod, reading.signIn);
    dialog.requests.answer(AzureDevOpsNames.readWorkItemMethod, reading.item);
    dialog.requests.answer(AzureDevOpsNames.readWorkItemsMethod, reading.parents);
    await dialog.openAsync(null);

    expect([dialog.base, dialog.logs]).toEqual(["main", ["The Azure DevOps branch dialog's git.branches failed: WindowFailure: Not connected."]]);
    expect(dialog.find(".nol-git-azure-devops-branch-base button", HTMLButtonElement).textContent).toContain("main");
  });

  it("makes the branch at the chosen base's tip, checks it out on the status after it, links it, sets the work item Active, keeps the prefix, and closes",
    async () => {
      const dialog = await new BranchDialog().openAsync();
      await dialog.chooseBaseAsync("release");
      const note = dialog.texts.at(-1);
      dialog.requests.answer(GitNames.createBranchAtMethod, null);
      dialog.requests.answer(GitNames.statusMethod, BranchDialogData.statusOf(BranchDialogData.azure, "main", BranchDialogData.head, "f2").toJson());
      dialog.requests.answer(GitNames.switchBranchMethod, null);
      dialog.requests.answer(AzureDevOpsNames.linkBranchMethod, null);
      dialog.requests.answer(AzureDevOpsNames.updateWorkItemMethod, null);

      await dialog.clickAsync("Create and switch");

      expect(note).toBe("From the pattern users/{you}/{id}-{title}");
      expect([dialog.requests.methods.slice(5), dialog.requests.payloads.slice(5)]).toEqual([[GitNames.createBranchAtMethod, GitNames.statusMethod,
        GitNames.switchBranchMethod, AzureDevOpsNames.linkBranchMethod, AzureDevOpsNames.updateWorkItemMethod], [
        { folder: "/repository", name, id: BranchDialogData.tipOf(2), basedOn: "f1" }, { folder: "/repository" }, { folder: "/repository", name, basedOn: "f2" },
        { host: "dev.azure.com", path: "fabrikam/Sample Project/_git/garden-web", id: 7532, branch: name },
        { host: "git-azure-devops", organization: "fabrikam", id: 7532, state: "Active", assignToMe: true }]]);
      expect([dialog.closes, dialog.isOpen, new AzureDevOpsCommitPrefixes().prefixFor("/repository", name)]).toEqual([1, false, "#7532 "]);
    });

  it("refuses a base the branches' read gave no commit for, and writes nothing", async () => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.branches = BranchDialogData.untippedBranchesOf("main", BranchDialogData.parentBranch);
    }));

    await dialog.clickAsync("Create and switch");

    expect([dialog.texts.at(-1), dialog.requests.methods, dialog.button("Create and switch").disabled]).toEqual([
      "The branch to start from has no commit this dialog read; choose another branch.", reads, false]);
  });

  it("says the current branch when the person chooses it over the parent's, and creates on it without checking out", async () => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.item = BranchDialogData.itemOf(7521, WorkItemCategory.InProgress);
    }));
    await dialog.chooseBaseAsync("main");
    const note = dialog.texts.at(-1);
    answerWrites(dialog);

    await dialog.typeAsync("  7532-tag-filter  ");
    await dialog.pressAsync("Enter");

    expect(note).toBe("The current branch");
    expect([dialog.requests.methods.slice(5), dialog.requests.payloads.at(-1), dialog.closes]).toEqual([[GitNames.createBranchMethod,
      AzureDevOpsNames.linkBranchMethod, AzureDevOpsNames.updateWorkItemMethod], { host: "git-azure-devops", organization: "fabrikam", id: 7532, state: null,
      assignToMe: true }, 1]);
  });

  it("pushes on the status after the branch is made when asked, writes nothing to Azure DevOps with its choices off, and drops a kept prefix", async () => {
    AzureDevOpsCommitPrefixes.keep("/repository", name, 7532);
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.noParents;
    }));
    await dialog.toggleAsync("push");
    await dialog.toggleAsync("link");
    await dialog.toggleAsync("active");
    await dialog.toggleAsync("prefix");
    const checked = dialog.checked;
    dialog.requests.answer(GitNames.createBranchMethod, null);
    dialog.requests.answer(GitNames.statusMethod, BranchDialogData.statusOf(BranchDialogData.azure, name, BranchDialogData.head, "f3").toJson());
    dialog.requests.answer(GitNames.pushMethod, null);

    await dialog.clickAsync("Create and switch");

    expect(checked).toEqual([false, false, false, true]);
    expect([dialog.requests.methods.slice(5), dialog.requests.payloads.at(-1), dialog.closes]).toEqual([[GitNames.createBranchMethod, GitNames.statusMethod,
      GitNames.pushMethod], { folder: "/repository", basedOn: "f3" }, 1]);
    expect(new AzureDevOpsCommitPrefixes().prefixFor("/repository", name)).toBeNull();
  });

  it("offers no link when the remote is in another organization or on another host, and no push without a remote", async () => {
    const remotes = [new GitRemote("origin", "dev.azure.com", "contoso/web/_git/site", RemoteTransport.Https),
      new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https), null];

    const shown: unknown[] = [];
    for (const remote of remotes) {
      const dialog = await new BranchDialog().openAsync(readsWith(t => {
        t.status = BranchDialogData.statusOf(remote).toJson();
        t.parents = BranchDialogData.noParents;
      }));
      const offered = [dialog.checked, dialog.disabledChoices];
      dialog.requests.answer(GitNames.createBranchMethod, null);
      dialog.requests.answer(AzureDevOpsNames.updateWorkItemMethod, null);
      await dialog.clickAsync("Create and switch");
      shown.push([...offered, dialog.requests.methods.slice(5)]);
    }

    const written = [GitNames.createBranchMethod, AzureDevOpsNames.updateWorkItemMethod];
    expect(shown).toEqual([[[false, true, true, false], [true, false, false, false], written],
      [[false, true, true, false], [true, false, false, false], written], [[false, true, true, false], [true, false, false, true], written]]);
  });

  it("offers the link for the remote's organization in another case than the work item's", async () => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.status = BranchDialogData.statusOf(new GitRemote("origin", "dev.azure.com", "Fabrikam/web/_git/site", RemoteTransport.Https)).toJson();
    }));

    expect([dialog.checked[0], dialog.disabledChoices[0]]).toEqual([true, false]);
  });

  it.each([
    new Step(GitNames.createBranchAtMethod, "the parent's branch"),
    new Step(GitNames.createBranchMethod, "the current branch")
  ])("says plainly that $method couldn't make the branch from $shown when the window fails, logs why, keeps no prefix, and stays open",
    async (step: Step) => {
      const dialog = await new BranchDialog().openAsync(readsWith(t => {
        if (step.method === GitNames.createBranchMethod)
          t.parents = BranchDialogData.noParents;
      }));
      dialog.requests.fail(step.method, new WindowFailure("Not connected."));

      await dialog.clickAsync("Create and switch");

      expect([dialog.texts.at(-1), dialog.logs, dialog.closes, dialog.field.disabled, new AzureDevOpsCommitPrefixes().prefixFor("/repository", name)])
        .toEqual(["The branch couldn't be created; the app's log has the details.",
          [`The Azure DevOps branch dialog's ${step.method} failed: WindowFailure: Not connected.`], 0, false, null]);
    });

  it.each([
    new Step(GitNames.statusMethod, "The repository couldn't be read; the app's log has the details."),
    new Step(GitNames.switchBranchMethod, "It couldn't be checked out; the app's log has the details.")
  ])("says the branch made at the base's tip is created but that $method failed, and on a second try checks it out and goes on", async (step: Step) => {
    const dialog = await new BranchDialog().openAsync();
    dialog.requests.answer(GitNames.createBranchAtMethod, null);
    if (step.method === GitNames.switchBranchMethod)
      dialog.requests.answer(GitNames.statusMethod, BranchDialogData.statusOf(BranchDialogData.azure).toJson());
    dialog.requests.fail(step.method, new WindowFailure("Not connected."));
    await dialog.clickAsync("Create and switch");
    const shown = [dialog.texts.at(-1), dialog.closes];
    dialog.requests.answer(GitNames.statusMethod, BranchDialogData.statusOf(BranchDialogData.azure).toJson());
    dialog.requests.answer(GitNames.switchBranchMethod, null);
    dialog.requests.answer(AzureDevOpsNames.linkBranchMethod, null);
    dialog.requests.answer(AzureDevOpsNames.updateWorkItemMethod, null);
    const asked = dialog.requests.methods.length;

    await dialog.clickAsync("Create and switch");

    expect(shown).toEqual([`${name} is created. ${step.shown}`, 0]);
    expect([dialog.requests.methods.slice(asked), dialog.closes]).toEqual([[GitNames.statusMethod, GitNames.switchBranchMethod,
      AzureDevOpsNames.linkBranchMethod, AzureDevOpsNames.updateWorkItemMethod], 1]);
  });

  it.each([
    new Step(GitNames.statusMethod, "The repository couldn't be read; the app's log has the details."),
    new Step(GitNames.pushMethod, "The branch couldn't be pushed; the app's log has the details."),
    new Step(AzureDevOpsNames.linkBranchMethod, "The branch couldn't be linked; the app's log has the details."),
    new Step(AzureDevOpsNames.updateWorkItemMethod, "The work item couldn't be updated; the app's log has the details.")
  ])("says the branch is made and that $method failed, and on a second try does only what is left, reading the status again before a push", async (step: Step) => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.noParents;
    }));
    await dialog.toggleAsync("push");
    dialog.requests.answer(GitNames.createBranchMethod, null);
    const later = [GitNames.statusMethod, GitNames.pushMethod, AzureDevOpsNames.linkBranchMethod, AzureDevOpsNames.updateWorkItemMethod];
    const failing = later.indexOf(step.method);
    for (const method of later.slice(0, failing))
      dialog.requests.answer(method, method === GitNames.statusMethod ? BranchDialogData.statusOf(BranchDialogData.azure, name).toJson() : null);
    dialog.requests.fail(step.method, new WindowFailure("Not connected."));
    await dialog.clickAsync("Create and switch");
    const shown = [dialog.texts.at(-1), dialog.field.disabled, dialog.base, dialog.closes];
    const again = step.method === GitNames.pushMethod ? [GitNames.statusMethod, ...later.slice(failing)] : later.slice(failing);
    for (const method of again)
      dialog.requests.answer(method, method === GitNames.statusMethod ? BranchDialogData.statusOf(BranchDialogData.azure, name).toJson() : null);
    const asked = dialog.requests.methods.length;

    await dialog.clickAsync("Create and switch");

    expect(shown).toEqual([`${name} is created and checked out. ${step.shown}`, true, failing === 0 ? "main" : name, 0]);
    expect([dialog.requests.methods.slice(asked), dialog.closes]).toEqual([again, 1]);
  });

  it("shows the runtime's message when a write is refused, and logs it", async () => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.noParents;
    }));
    dialog.requests.fail(GitNames.createBranchMethod, new RuntimeRequestException(FailureCode.Conflict, `A branch named ${name} already exists.`));

    await dialog.clickAsync("Create and switch");

    expect([dialog.texts.at(-1), dialog.logs, dialog.button("Create and switch").disabled]).toEqual([`A branch named ${name} already exists.`,
      [`The Azure DevOps branch dialog's git.createBranch failed: RuntimeRequestException: A branch named ${name} already exists.`], false]);
  });

  it("says the repository couldn't be read and creates nothing when the status fails, shows the runtime's message for it, and logs every failed read", async () => {
    const failed = new BranchDialog();
    failed.requests.fail(GitNames.statusMethod, new WindowFailure("Not connected."));
    failed.requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Not connected."));
    failed.requests.fail(AzureDevOpsNames.readWorkItemMethod, new WindowFailure("Not connected."));
    failed.requests.answer(GitNames.branchesMethod, BranchDialogData.branchesOf("main"));
    await failed.openAsync(null);
    await failed.pressAsync("Enter");
    const refused = new BranchDialog();
    refused.requests.fail(GitNames.statusMethod, new RuntimeRequestException(FailureCode.NotFound, "The folder isn't a Git repository."));
    refused.requests.answer(GitNames.branchesMethod, BranchDialogData.branchesOf("main"));
    refused.requests.answer(AzureDevOpsNames.readSignInMethod, BranchDialogData.signedOut());
    refused.requests.answer(AzureDevOpsNames.readWorkItemMethod, BranchDialogData.itemOf(7521));
    refused.requests.fail(AzureDevOpsNames.readWorkItemsMethod, new WindowFailure("Not connected."));
    await refused.openAsync(null);

    expect([failed.texts, failed.button("Create and switch").disabled, failed.requests.methods.length, failed.logs.toSorted()]).toEqual([
      ["Tag filter ignores case in note titles", "The repository couldn't be read; the app's log has the details."], true, 4, [
        "The Azure DevOps branch dialog's git-azure-devops.readSignIn failed: WindowFailure: Not connected.",
        "The Azure DevOps branch dialog's git-azure-devops.readWorkItem failed: WindowFailure: Not connected.",
        "The Azure DevOps branch dialog's git.status failed: WindowFailure: Not connected."]]);
    expect([refused.texts.at(-1), refused.logs.at(-1)]).toEqual(["The folder isn't a Git repository.",
      "The Azure DevOps branch dialog's git-azure-devops.readWorkItems failed: WindowFailure: Not connected."]);
  });

  it("passes on a failure that isn't the window's, from a read or a write, and lets the person try again", async () => {
    const unexpected = new TypeError("Unexpected.");
    const reading = new BranchDialog();
    reading.requests.fail(GitNames.statusMethod, unexpected);
    reading.requests.answer(GitNames.branchesMethod, BranchDialogData.branchesOf("main"));
    reading.requests.answer(AzureDevOpsNames.readSignInMethod, BranchDialogData.signedOut());
    reading.requests.answer(AzureDevOpsNames.readWorkItemMethod, null);
    const readRejected = UnhandledRejections.nextAsync();
    await reading.openAsync(null);
    const read = await readRejected;
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.noParents;
    }));
    dialog.requests.fail(GitNames.createBranchMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();
    await dialog.clickAsync("Create and switch");

    expect([read, await rejected, dialog.logs, dialog.button("Create and switch").disabled]).toEqual([unexpected, unexpected, [], false]);
  });

  it("asks once while a write is out, with every button and choice disabled, and offers Create only for a name with more than spaces", async () => {
    const dialog = await new BranchDialog().openAsync(readsWith(t => {
      t.parents = BranchDialogData.noParents;
    }));
    await dialog.typeAsync("   ");
    const blank = dialog.button("Create and switch").disabled;
    await dialog.pressAsync("Enter");
    await dialog.typeAsync("7532-x");
    const release = dialog.requests.hold(GitNames.createBranchMethod);
    dialog.button("Create and switch").click();
    dialog.render();
    await dialog.requests.askedAsync(6);
    dialog.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    dialog.render();
    const busy = [dialog.labels.map(t => dialog.button(t).disabled), dialog.disabledChoices, dialog.field.disabled];
    dialog.requests.answer(AzureDevOpsNames.linkBranchMethod, null);
    dialog.requests.answer(AzureDevOpsNames.updateWorkItemMethod, null);
    release(null);
    await dialog.settleAsync();

    expect([blank, busy]).toEqual([true, [[true, true], [true, true, true, true], true]]);
    expect(dialog.requests.methods.slice(5)).toEqual([GitNames.createBranchMethod, AzureDevOpsNames.linkBranchMethod, AzureDevOpsNames.updateWorkItemMethod]);
  });

  it("closes on Cancel while it is still reading the repository", async () => {
    const dialog = new BranchDialog();
    const reads = new BranchDialogReads();
    const release = dialog.requests.hold(GitNames.statusMethod);
    dialog.requests.answer(GitNames.branchesMethod, reads.branches);
    dialog.requests.answer(AzureDevOpsNames.readSignInMethod, reads.signIn);
    dialog.requests.answer(AzureDevOpsNames.readWorkItemMethod, reads.item);
    dialog.requests.answer(AzureDevOpsNames.readWorkItemsMethod, reads.parents);
    dialog.open();
    await dialog.requests.askedAsync(5);
    dialog.render();
    const reading = dialog.button("Cancel").disabled;
    dialog.button("Cancel").click();
    release(reads.status);
    await dialog.settleAsync();

    expect([reading, dialog.closes]).toEqual([false, 1]);
  });

  it("creates nothing and closes on Cancel or Escape", async () => {
    const cancelled = await new BranchDialog().openAsync();
    await cancelled.clickAsync("Cancel");
    const escaped = await new BranchDialog().openAsync();
    await escaped.pressAsync("Escape");

    expect([cancelled.requests.methods, cancelled.closes, escaped.requests.methods, escaped.closes, escaped.isOpen]).toEqual([reads, 1, reads, 1, false]);
  });
});

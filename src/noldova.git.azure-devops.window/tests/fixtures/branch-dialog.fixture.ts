/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostReference, HostSignIn, HostWorkItem, HostWorkItemDetail, HostWorkItemList, HostWorkItemType, SignInState, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { GitBranches, GitBranchTip, GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { DialogService } from "@noldova/ui.components.angular";

import { AzureDevOpsBranchComponent } from "../../src/app/components/azure-devops-branch/azure-devops-branch.component.ts";
import { BranchRequest } from "../../src/app/models/branch-request.ts";
import { RequestAnswers } from "./request-answers.fixture.ts";

export class BranchDialogData {
  public static readonly request: BranchRequest = new BranchRequest("/repository", "fabrikam", 4832, "Tag filter ignores case in note titles");
  public static readonly azure: GitRemote = new GitRemote("origin", "dev.azure.com", "fabrikam/Sample Project/_git/portal-web", RemoteTransport.Https);
  public static readonly head: string = "1a2b3c4d".repeat(5);
  public static readonly parentBranch: string = "users/ana/4821-export-notes-markdown";
  public static readonly task: HostWorkItemType = new HostWorkItemType("Task", "A4880A", "icon_clipboard");
  public static readonly story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");

  public static statusOf(remote: GitRemote | null, branch: string | null = "main", head: string | null = BranchDialogData.head, fingerprint: string = "f1"): GitStatus {
    return new GitStatus(branch, head, null, [], false, fingerprint, null, remote);
  }

  public static branchesOf(...names: readonly string[]): JsonValue {
    return new GitBranches("main", names, ["origin"], [], [], names.map((t, i) => new GitBranchTip(t, BranchDialogData.tipOf(i), "2026-11-23T10:00:00+01:00"))).toJson();
  }

  public static untippedBranchesOf(...names: readonly string[]): JsonValue {
    return new GitBranches("main", names, ["origin"], [], []).toJson();
  }

  public static tipOf(index: number): string {
    return String(index + 1).repeat(40);
  }

  public static signedIn(login: string): JsonValue {
    return new HostSignIn(SignInState.SignedIn, null, null, new HostAccount(login, null, null, []), null).toJson();
  }

  public static signedOut(): JsonValue {
    return new HostSignIn(SignInState.SignedOut, null, null, null, null).toJson();
  }

  public static itemOf(parent: number | null, category: WorkItemCategory = WorkItemCategory.Proposed, title: string = "Tag filter ignores case in note titles"): JsonValue {
    return new HostWorkItem(AzureDevOpsNames.moduleId, "fabrikam", "Sample Project", 4832, BranchDialogData.task, title, "New", category,
      "https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/4832", null, "Sample Project\\Sprint 47", "Sample Project\\Notes app", parent).toJson();
  }

  public static parentsOf(...branches: readonly string[]): JsonValue {
    const item = new HostWorkItem(AzureDevOpsNames.moduleId, "fabrikam", "Sample Project", 4821, BranchDialogData.story, "Export notes as Markdown files", "Active",
      WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/4821", null, null, null, 4790);
    const pullRequest = new HostReference(AzureDevOpsNames.moduleId, "fabrikam", "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0", 482);
    return new HostWorkItemList([new HostWorkItemDetail(item, 5, 6, 8, null, null, [4830, 4831, 4832], [pullRequest], 5, branches)], false).toJson();
  }

  public static readonly noParents: JsonValue = new HostWorkItemList([], false).toJson();
}

export class BranchDialogReads {
  public status: JsonValue = BranchDialogData.statusOf(BranchDialogData.azure).toJson();
  public branches: JsonValue = BranchDialogData.branchesOf("main", BranchDialogData.parentBranch, "release");
  public signIn: JsonValue = BranchDialogData.signedIn("Mona.Lisa@fabrikam.com");
  public item: JsonValue = BranchDialogData.itemOf(4821);
  public parents: JsonValue = BranchDialogData.parentsOf("users/ana/gone", BranchDialogData.parentBranch);
}

export class BranchDialog {
  private static readonly opened: DialogRef<unknown, AzureDevOpsBranchComponent>[] = [];

  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public closes: number = 0;
  private host: HTMLElement | null = null;

  public get element(): HTMLElement {
    if (this.host === null || !this.host.isConnected)
      throw new Error("The dialog isn't open.");
    return this.host;
  }

  public get isOpen(): boolean {
    return this.host !== null && this.host.isConnected;
  }

  public get field(): HTMLInputElement {
    return this.find(".nol-git-azure-devops-branch-field input", HTMLInputElement);
  }

  public get title(): string {
    return (this.element.querySelector(".nol-dialog-title")?.textContent ?? "").trim();
  }

  public get texts(): readonly string[] {
    return [...this.element.querySelectorAll(".nol-git-azure-devops-branch p")].map(t => (t.textContent ?? "").trim());
  }

  public get base(): string | null {
    const value = this.element.querySelector(".nol-git-azure-devops-branch-base .nol-select-value");
    return value === null ? null : (value.textContent ?? "").trim();
  }

  public get choices(): readonly string[] {
    return [...this.element.querySelectorAll("nol-checkbox")].map(t => (t.textContent ?? "").trim());
  }

  public get checked(): readonly boolean[] {
    return [...this.element.querySelectorAll("nol-checkbox input")].map(t => t instanceof HTMLInputElement && t.checked);
  }

  public get disabledChoices(): readonly boolean[] {
    return [...this.element.querySelectorAll("nol-checkbox input")].map(t => t.getAttribute("aria-disabled") === "true");
  }

  public get labels(): readonly string[] {
    return [...this.element.querySelectorAll(".nol-dialog-actions > button[nolDialogAction]")].map(t => (t.textContent ?? "").trim());
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public button(label: string): HTMLButtonElement {
    const button = [...this.element.querySelectorAll(".nol-dialog-actions > button[nolDialogAction]")].find(t => (t.textContent ?? "").trim() === label);
    if (!(button instanceof HTMLButtonElement))
      throw new Error(`The dialog has no ${label} button.`);
    return button;
  }

  public find<T extends Element>(selector: string, type: abstract new () => T): T {
    const element = this.element.querySelector(selector);
    if (!(element instanceof type))
      throw new Error(`The dialog has no ${selector}.`);
    return element;
  }

  public answerReads(reads: BranchDialogReads): this {
    this.requests.answer(GitNames.statusMethod, reads.status);
    this.requests.answer(GitNames.branchesMethod, reads.branches);
    this.requests.answer(AzureDevOpsNames.readSignInMethod, reads.signIn);
    this.requests.answer(AzureDevOpsNames.readWorkItemMethod, reads.item);
    this.requests.answer(AzureDevOpsNames.readWorkItemsMethod, reads.parents);
    return this;
  }

  public async openAsync(reads: BranchDialogReads | null = new BranchDialogReads(), request: BranchRequest = BranchDialogData.request): Promise<this> {
    if (reads !== null)
      this.answerReads(reads);
    this.open(request);
    await this.settleAsync();
    return this;
  }

  public open(request: BranchRequest = BranchDialogData.request): void {
    const dialog = TestBed.inject(DialogService).open(AzureDevOpsBranchComponent, ".nol-git-azure-devops-branch-field input");
    BranchDialog.opened.push(dialog);
    const host: unknown = dialog.componentRef?.location.nativeElement;
    this.host = host instanceof HTMLElement ? host : null;
    dialog.componentRef?.setInput("request", request);
    dialog.componentRef?.setInput("context", this.context);
    dialog.componentInstance?.closed.subscribe(() => {
      this.closes++;
      dialog.close();
    });
    this.render();
  }

  public async clickAsync(label: string): Promise<void> {
    this.button(label).click();
    await this.settleAsync();
  }

  public async toggleAsync(choice: string): Promise<void> {
    this.find(`.nol-git-azure-devops-branch-${choice} input`, HTMLInputElement).click();
    await this.settleAsync();
  }

  public async chooseBaseAsync(branch: string): Promise<void> {
    this.find(".nol-git-azure-devops-branch-base button", HTMLButtonElement).click();
    await this.settleAsync();
    const option = document.querySelector(`.nol-select-option[data-value="${branch}"]`);
    if (!(option instanceof HTMLElement))
      throw new Error(`The list has no ${branch}.`);
    option.click();
    await this.settleAsync();
  }

  public async typeAsync(text: string): Promise<void> {
    this.field.value = text;
    this.field.dispatchEvent(new Event("input"));
    await this.settleAsync();
  }

  public async pressAsync(key: string): Promise<void> {
    this.field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    await this.settleAsync();
  }

  public render(): void {
    TestBed.inject(ApplicationRef).tick();
  }

  public async settleAsync(): Promise<void> {
    const application = TestBed.inject(ApplicationRef);
    await application.whenStable();
    application.tick();
    await application.whenStable();
  }

  public static closeAll(): void {
    for (const dialog of BranchDialog.opened.splice(0))
      dialog.close();
  }
}

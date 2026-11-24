/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Component, computed, ElementRef, inject, input, type InputSignal, type OnInit, output, type OutputEmitterRef, PendingTasks, signal, type Signal, viewChild,
  type WritableSignal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { type IWindowPartContext, RuntimeRequestException, WindowException } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostSignIn, HostWorkItem, type HostWorkItemDetail, HostWorkItemList, WorkItemCategory, WorkItemQuery, WorkItemScope, WorkItemsQuery, WorkItemUpdate } from "@noldova/git.hosting.protocol";
import { GitBranchAtParams, GitBranches, GitBranchParams, type GitBranchTip, GitFolderParams, GitNames, GitPushParams, type GitRemote, GitStatus } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, CheckboxComponent, DialogComponent, SelectComponent, SelectOption, TextFieldComponent } from "@noldova/ui.components.angular";

import { BranchRequest } from "../../models/branch-request.ts";
import { Resources } from "../../../resources.ts";
import { AzureDevOpsCommitPrefixes } from "../../services/azure-devops-commit-prefixes.ts";
import { AzureDevOpsReferenceLinks } from "../../services/azure-devops-reference-links.ts";

@Component({
  selector: "nol-git-azure-devops-branch",
  templateUrl: "./azure-devops-branch.component.html",
  styleUrl: "./azure-devops-branch.component.css",
  imports: [ButtonComponent, CheckboxComponent, DialogComponent, SelectComponent, TextFieldComponent]
})
export class AzureDevOpsBranchComponent implements OnInit {
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private readonly nameField: Signal<ElementRef<HTMLInputElement>> = viewChild.required("nameField", { read: ElementRef });
  private readonly status: WritableSignal<GitStatus | null> = signal<GitStatus | null>(null);
  private readonly branches: WritableSignal<readonly string[]> = signal<readonly string[]>([]);
  private readonly tips: WritableSignal<readonly GitBranchTip[]> = signal<readonly GitBranchTip[]>([]);
  private readonly item: WritableSignal<HostWorkItem | null> = signal<HostWorkItem | null>(null);
  private readonly parent: WritableSignal<HostWorkItemDetail | null> = signal<HostWorkItemDetail | null>(null);
  private readonly chosenBase: WritableSignal<string | null> = signal<string | null>(null);
  private readonly isNamed: WritableSignal<boolean> = signal<boolean>(false);
  private readonly finished: Set<string> = new Set();

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly name: WritableSignal<string> = signal<string>("");
  protected readonly owner: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly hasName: Signal<boolean> = computed(() => this.name().trim() !== "");
  protected readonly isRead: Signal<boolean> = computed(() => !Object.isNull(this.status()));
  protected readonly created: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly isBusy: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly failure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly wantsLink: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly wantsActive: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly wantsPrefix: WritableSignal<boolean> = signal<boolean>(true);
  protected readonly wantsPush: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly line: Signal<string | null> = computed(() => {
    const item = this.item();
    const title = this.request().title;
    if (!Object.isNull(item))
      return Resources.formatBranchItemLine(item.title, item.type.name, item.parent);
    return title === "" ? null : title;
  });
  protected readonly parentBranch: Signal<string | null> = computed(() => this.parent()?.branches.find(t => this.branches().includes(t)) ?? null);
  protected readonly base: Signal<string | null> = computed(() => this.chosenBase() ?? this.parentBranch() ?? this.status()?.branch ?? null);
  protected readonly baseOptions: Signal<readonly SelectOption[]> = computed(() => {
    const names = this.branches();
    const base = this.base();
    return (Object.isNull(base) || names.includes(base) ? names : [base, ...names]).map(t => new SelectOption(t, t));
  });
  protected readonly baseNote: Signal<string | null> = computed(() => {
    const base = this.base();
    const parent = this.parent();
    if (!Object.isNull(parent) && base === this.parentBranch())
      return Resources.formatParentBranchNote(parent.item.type.name);
    return base === this.status()?.branch ? Resources.currentBranchNote : null;
  });
  protected readonly commitNote: Signal<string | null> = computed(() => {
    const head = this.status()?.head ?? null;
    return Object.isNull(head) ? null : Resources.formatCommitBase(head);
  });
  protected readonly linkRemote: Signal<GitRemote | null> = computed(() => {
    const remote = this.status()?.remote ?? null;
    return AzureDevOpsReferenceLinks.homeOf(remote)?.toLowerCase() === this.request().organization.toLowerCase() ? remote : null;
  });
  protected readonly canPush: Signal<boolean> = computed(() => !Object.isNull(this.status()?.remote ?? null));
  protected readonly isLinking: Signal<boolean> = computed(() => this.wantsLink() && !Object.isNull(this.linkRemote()));
  protected readonly isPushing: Signal<boolean> = computed(() => this.wantsPush() && this.canPush());

  public readonly request: InputSignal<BranchRequest> = input.required<BranchRequest>();
  public readonly context: InputSignal<IWindowPartContext> = input.required<IWindowPartContext>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  public ngOnInit(): void {
    this.name.set(this.request().suggestedName);
    void this.readAsync(GitNames.statusMethod, async () => {
      this.status.set(await this.readStatusAsync());
    }, Resources.statusNotRead);
    void this.readAsync(GitNames.branchesMethod, async () => {
      const branches = GitBranches.fromJson(await this.context().requestAsync(GitNames.branchesMethod, new GitFolderParams(this.request().folder).toJson()));
      this.branches.set(branches.branches);
      this.tips.set(branches.tips);
    }, null);
    void this.readAsync(AzureDevOpsNames.readSignInMethod, async () => {
      const account = HostSignIn.fromJson(await this.context().requestAsync(AzureDevOpsNames.readSignInMethod, null)).account;
      const owner = Object.isNull(account) ? null : BranchRequest.ownerOf(account.login);
      this.owner.set(owner);
      if (!this.isNamed())
        this.name.set(this.request().nameFor(owner));
    }, null);
    void this.readWorkItemAsync();
  }

  protected noteName(): void {
    this.isNamed.set(true);
    this.name.set(this.nameField().nativeElement.value);
  }

  protected chooseBase(branch: string): void {
    this.chosenBase.set(branch);
  }

  protected async createAsync(): Promise<void> {
    const name = this.created() ?? this.name().trim();
    const status = this.status();
    if (name === "" || Object.isNull(status) || this.isBusy())
      return;
    const done = this.tasks.add();
    this.isBusy.set(true);
    this.failure.set(null);
    let step: string = GitNames.statusMethod;
    try {
      const { folder, id } = this.request();
      let fingerprint = status.fingerprint;
      if (Object.isNull(this.created())) {
        const base = this.base();
        if (Object.isNull(base) || base === status.branch) {
          step = GitNames.createBranchMethod;
          await this.context().requestAsync(GitNames.createBranchMethod, new GitBranchParams(folder, name, fingerprint).toJson());
          this.finished.add(GitNames.switchBranchMethod);
        }
        else {
          const tip = this.tips().find(t => t.branch === base);
          if (tip === undefined) {
            this.failure.set(Resources.baseNotFound);
            return;
          }
          step = GitNames.createBranchAtMethod;
          await this.context().requestAsync(GitNames.createBranchAtMethod, new GitBranchAtParams(folder, name, tip.id, fingerprint).toJson());
        }
        this.created.set(name);
        if (this.wantsPrefix())
          AzureDevOpsCommitPrefixes.keep(folder, name, id);
        else
          AzureDevOpsCommitPrefixes.drop(folder, name);
      }
      if (!this.finished.has(GitNames.switchBranchMethod)) {
        step = GitNames.statusMethod;
        fingerprint = (await this.readStatusAsync()).fingerprint;
        step = GitNames.switchBranchMethod;
        await this.context().requestAsync(GitNames.switchBranchMethod, new GitBranchParams(folder, name, fingerprint).toJson());
        this.finished.add(GitNames.switchBranchMethod);
      }
      if (this.isPushing() && !this.finished.has(GitNames.pushMethod)) {
        step = GitNames.statusMethod;
        fingerprint = (await this.readStatusAsync()).fingerprint;
        step = GitNames.pushMethod;
        await this.context().requestAsync(GitNames.pushMethod, new GitPushParams(folder, fingerprint).toJson());
        this.finished.add(GitNames.pushMethod);
      }
      const remote = this.wantsLink() ? this.linkRemote() : null;
      if (!Object.isNull(remote) && !this.finished.has(AzureDevOpsNames.linkBranchMethod)) {
        step = AzureDevOpsNames.linkBranchMethod;
        const link: JsonValue = { host: remote.host, path: remote.path, id, branch: name };
        await this.context().requestAsync(AzureDevOpsNames.linkBranchMethod, link);
        this.finished.add(AzureDevOpsNames.linkBranchMethod);
      }
      if (this.wantsActive()) {
        step = AzureDevOpsNames.updateWorkItemMethod;
        const state = this.item()?.category === WorkItemCategory.InProgress ? null : Resources.activeState;
        await this.context().requestAsync(AzureDevOpsNames.updateWorkItemMethod,
          new WorkItemUpdate(AzureDevOpsNames.moduleId, this.request().organization, id, state, true).toJson());
      }
      this.closed.emit();
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context().log(Resources.formatBranchFailed(step, String(error)));
      const message = error instanceof RuntimeRequestException ? error.message : AzureDevOpsBranchComponent.unansweredOf(step);
      const branch = this.created();
      this.failure.set(Object.isNull(branch) ? message : Resources.formatBranchKept(branch, this.finished.has(GitNames.switchBranchMethod), message));
    }
    finally {
      this.isBusy.set(false);
      done();
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  private async readStatusAsync(): Promise<GitStatus> {
    const status = GitStatus.fromJson(await this.context().requestAsync(GitNames.statusMethod, new GitFolderParams(this.request().folder).toJson()));
    this.status.set(status);
    return status;
  }

  private async readWorkItemAsync(): Promise<void> {
    const { organization, id } = this.request();
    await this.readAsync(AzureDevOpsNames.readWorkItemMethod, async () => {
      const answer = await this.context().requestAsync(AzureDevOpsNames.readWorkItemMethod, new WorkItemQuery(AzureDevOpsNames.moduleId, organization, id).toJson());
      this.item.set(Object.isNull(answer) ? null : HostWorkItem.fromJson(answer));
    }, null);
    const item = this.item();
    const parent = item?.parent ?? null;
    if (Object.isNull(item) || Object.isNull(parent))
      return;
    await this.readAsync(AzureDevOpsNames.readWorkItemsMethod, async () => {
      const query = new WorkItemsQuery(AzureDevOpsNames.moduleId, organization, item.project, WorkItemScope.Ids, [parent]);
      const answer = await this.context().requestAsync(AzureDevOpsNames.readWorkItemsMethod, query.toJson());
      this.parent.set(HostWorkItemList.fromJson(answer).items.find(t => t.item.id === parent) ?? null);
    }, null);
  }

  private async readAsync(step: string, read: () => Promise<void>, unanswered: string | null): Promise<void> {
    const done = this.tasks.add();
    try {
      await read();
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context().log(Resources.formatBranchFailed(step, String(error)));
      if (!Object.isNull(unanswered))
        this.failure.set(error instanceof RuntimeRequestException ? error.message : unanswered);
    }
    finally {
      done();
    }
  }

  private static unansweredOf(step: string): string {
    switch (step) {
      case GitNames.switchBranchMethod:
        return Resources.branchNotSwitched;
      case GitNames.createBranchMethod:
      case GitNames.createBranchAtMethod:
        return Resources.branchNotCreated;
      case GitNames.pushMethod:
        return Resources.branchNotPushed;
      case AzureDevOpsNames.linkBranchMethod:
        return Resources.branchNotLinked;
      case AzureDevOpsNames.updateWorkItemMethod:
        return Resources.workItemNotUpdated;
      default:
        return Resources.statusNotRead;
    }
  }
}

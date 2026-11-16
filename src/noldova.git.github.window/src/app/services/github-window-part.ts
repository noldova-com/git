/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding, type IWindowPart, type IWindowPartContext, SettingsPageContribution, SettingsRow, WindowException } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { HostSignIn } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";
import { GitHostRows } from "@noldova/git.window";

import { GitHubHostRowComponent } from "../components/github-host-row/github-host-row.component.ts";
import { GitHubSignInComponent } from "../components/github-sign-in/github-sign-in.component.ts";
import { Resources } from "../../resources.ts";
import { SignInEvents } from "./sign-in-events.ts";

export class GitHubWindowPart implements IWindowPart {
  private context: IWindowPartContext | null = null;
  private withdraw: (() => void) | null = null;
  private unfollow: (() => void) | null = null;
  private changes: number = 0;

  public readonly moduleId: string = GitHubNames.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerSettingsPage(new SettingsPageContribution(Resources.settingsPage, () => Promise.resolve(GitHubSignInComponent)));
    this.withdraw = GitHostRows.provide(context, { claims: (remote: GitRemote) => remote.host === Resources.gitHubHost, component: GitHubHostRowComponent });
    this.context = context;
    context.setSettingsRows(Resources.settingsPage, GitHubWindowPart.rowsFor(null));
    this.unfollow = SignInEvents.follow(context, signIn => {
      this.changes++;
      this.showRows(context, GitHubWindowPart.rowsFor(signIn));
    });
    void this.readRowsAsync(context);
  }

  public async reconnectAsync(): Promise<boolean> {
    return this.context !== null;
  }

  public async deactivateAsync(): Promise<void> {
    this.withdraw?.();
    this.withdraw = null;
    this.unfollow?.();
    this.unfollow = null;
    this.context = null;
  }

  private static rowsFor(signIn: HostSignIn | null): SettingsRow[] {
    const account = signIn?.account ?? null;
    if (account !== null)
      return [
        new SettingsRow(Resources.accountRow, Resources.accountTitle, Resources.formatAccess(account.scopes)),
        new SettingsRow(Resources.signOutRow, Resources.signOut),
        new SettingsRow(Resources.manageAccessRow, Resources.manageAccess)
      ];
    const code = signIn?.deviceCode ?? null;
    if (code !== null)
      return [new SettingsRow(Resources.accountRow, Resources.accountTitle, Resources.formatCodeNote(code.verificationUri, code.userCode, false))];
    return [new SettingsRow(Resources.accountRow, Resources.accountTitle, Resources.signedOutNote), new SettingsRow(Resources.signInRow, Resources.signIn)];
  }

  private static unreadRows(): SettingsRow[] {
    return [new SettingsRow(Resources.accountRow, Resources.accountTitle, Resources.signInUnread), new SettingsRow(Resources.signInRow, Resources.signIn)];
  }

  private async readRowsAsync(context: IWindowPartContext): Promise<void> {
    const changes: number = this.changes;
    let signIn: HostSignIn;
    try {
      signIn = HostSignIn.fromJson(await context.requestAsync(GitHubNames.readSignInMethod, null));
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(GitHubNames.readSignInMethod, String(error)));
      if (this.changes === changes)
        this.showRows(context, GitHubWindowPart.unreadRows());
      return;
    }
    if (this.changes === changes)
      this.showRows(context, GitHubWindowPart.rowsFor(signIn));
  }

  private showRows(context: IWindowPartContext, rows: SettingsRow[]): void {
    if (this.context === context)
      context.setSettingsRows(Resources.settingsPage, rows);
  }
}

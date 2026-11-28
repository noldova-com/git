/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { FailureCode, SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
import { type IAppWindows, type IModuleLog, type IModuleSecrets, MethodFailureException } from "@noldova/desktop.runtime";
import { AccountPick, HostAccountEntry, HostAccountList, HostingProtocolException, type HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";

import type { IAzureTokens } from "../interfaces/i-azure-tokens.ts";
import type { AzureCredential } from "../models/azure-credential.ts";
import { AzureRepository } from "../models/azure-repository.ts";
import { KeptAccount } from "../models/kept-account.ts";
import { KeptAccounts } from "../models/kept-accounts.ts";
import { Resources } from "../resources.ts";
import { AzureApi } from "./azure-api.ts";
import type { EntraFlow } from "./entra-flow.ts";
import { AzureSignIn } from "./azure-sign-in.ts";

export class AzureAccounts implements IAzureTokens {
  private static readonly firstId: number = 1;

  private readonly api: AzureApi;
  private readonly flow: EntraFlow;
  private readonly secrets: IModuleSecrets;
  private readonly appWindows: IAppWindows;
  private readonly log: IModuleLog;
  private readonly changed: (id: number, signIn: HostSignIn) => void;
  private readonly entries: Map<number, AzureSignIn> = new Map();
  private readonly dropping: Map<number, Promise<void>> = new Map();
  private picks: readonly AccountPick[] = [];
  private kept: string | null = null;
  private saving: Promise<void> = Promise.resolve();
  private unfollowWindows: (() => void) | null = null;
  private stopped: boolean = false;

  public constructor(api: AzureApi, flow: EntraFlow, secrets: IModuleSecrets, appWindows: IAppWindows, log: IModuleLog,
    changed: (id: number, signIn: HostSignIn) => void) {
    this.api = api;
    this.flow = flow;
    this.secrets = secrets;
    this.appWindows = appWindows;
    this.log = log;
    this.changed = changed;
    this.entries.set(AzureAccounts.firstId, this.make(AzureAccounts.firstId));
  }

  public get list(): HostAccountList {
    return new HostAccountList([...this.entries].map(([id, signIn]) => new HostAccountEntry(id, signIn.current, signIn.place)));
  }

  public get isSignedIn(): boolean {
    return [...this.entries.values()].some(t => t.token !== null);
  }

  public async restoreAsync(): Promise<void> {
    if (this.stopped)
      return;
    const kept: KeptAccounts | null = await this.readKeptAsync();
    if (this.stopped)
      return;
    for (const account of kept?.accounts ?? []) {
      if (!this.entries.has(account.id))
        this.entries.set(account.id, this.make(account.id));
    }
    this.picks = kept?.picks ?? [];
    await Promise.all([...this.entries.values()].map(t => t.restoreAsync()));
    for (const [id, signIn] of this.entries) {
      if (id !== AzureAccounts.firstId && signIn.current.state === SignInState.SignedOut && signIn.current.failure === null && !signIn.keptUnreadable)
        this.leave(id);
    }
    this.save();
  }

  public signInOf(id: number): AzureSignIn {
    const signIn: AzureSignIn | undefined = this.entries.get(id);
    if (signIn === undefined)
      throw AzureApi.failure(FailureCode.NotFound, Resources.unknownAccountMessage);
    return signIn;
  }

  public async addAsync(signIn: (account: AzureSignIn) => Promise<HostSignIn>): Promise<HostAccountEntry> {
    const id: number = Math.max(...this.entries.keys()) + 1;
    const added: AzureSignIn = this.make(id);
    this.entries.set(id, added);
    try {
      await signIn(added);
    }
    catch (error) {
      this.leave(id);
      throw error;
    }
    await this.dropping.get(id);
    const entry: HostAccountEntry = new HostAccountEntry(id, added.current, added.place);
    if (added.current.state === SignInState.SignedOut && this.entries.has(id)) {
      this.leave(id);
      this.publish(id, added.current);
    }
    return entry;
  }

  public async signOutAsync(id: number): Promise<HostSignIn> {
    const signIn: AzureSignIn = this.signInOf(id);
    const answer: HostSignIn = await signIn.signOutAsync();
    if (id !== AzureAccounts.firstId && this.entries.has(id)) {
      this.leave(id);
      this.publish(id, answer);
    }
    return answer;
  }

  public pick(pick: AccountPick): number | null {
    this.signInOf(pick.account);
    const others: readonly AccountPick[] = this.picks.filter(t => !AzureAccounts.isSameRepository(t, pick.host, pick.path));
    this.picks = [...others, pick].slice(-Resources.picksCap);
    this.save();
    return this.accountFor(pick.host, pick.path);
  }

  public accountFor(host: string, path: string): number | null {
    const repository: AzureRepository | null = AzureRepository.parse(host, path);
    if (repository === null)
      return null;
    const inOrganization: readonly number[] = this.signedInTo(repository.organization);
    const pick: number | undefined = this.picks.find(t => AzureAccounts.isSameRepository(t, host, path))?.account;
    return pick !== undefined && inOrganization.includes(pick) ? pick : inOrganization[0] ?? null;
  }

  public tokenFor(organization: string, host: string | null = null, path: string | null = null): AzureCredential | null {
    const inOrganization: readonly number[] = this.signedInTo(organization);
    const picked: number | undefined = host !== null && path !== null && AzureRepository.parse(host, path) !== null
      ? this.picks.find(t => AzureAccounts.isSameRepository(t, host, path))?.account
      : this.picks.findLast(t => Resources.isSameOrganization(AzureRepository.parse(t.host, t.path)?.organization ?? Resources.emptyText, organization))?.account;
    const id: number | undefined = picked !== undefined && inOrganization.includes(picked) ? picked : inOrganization[0];
    return id === undefined ? null : this.signInOf(id).token;
  }

  public holds(token: AzureCredential): boolean {
    return [...this.entries.values()].some(t => t.token === token);
  }

  public async refusedAsync(token: AzureCredential): Promise<void> {
    await Promise.all([...this.entries.values()].map(t => t.refusedAsync(token)));
  }

  public async readyAsync(): Promise<void> {
    await Promise.all([...this.entries.values()].map(t => t.readyAsync()));
  }

  public dispose(): void {
    this.stopped = true;
    this.unfollowWindows?.();
    this.unfollowWindows = null;
    for (const signIn of this.entries.values())
      signIn.dispose();
  }

  private signedInTo(organization: string): readonly number[] {
    return [...this.entries].filter(([, signIn]) => signIn.organization !== null && Resources.isSameOrganization(signIn.organization, organization))
      .map(([id]) => id);
  }

  private make(id: number): AzureSignIn {
    const first: boolean = id === AzureAccounts.firstId;
    return new AzureSignIn(this.api, this.flow, this.secrets, this.appWindows, this.log, t => this.onChanged(id, t),
      first ? Resources.signInSecret : Resources.formatAccountSecret(id), first ? Resources.microsoftSignInSecret : Resources.formatMicrosoftAccountSecret(id));
  }

  private onChanged(id: number, signIn: HostSignIn): void {
    const twin: number | undefined = this.twinOf(id, signIn);
    if (twin !== undefined) {
      this.drop(twin);
      if (twin === id)
        return;
    }
    if (id !== AzureAccounts.firstId && signIn.state === SignInState.SignedOut && (signIn.failure === null || signIn.failure === SignInFailure.AlreadyKept))
      this.leave(id);
    this.publish(id, signIn);
  }

  private publish(id: number, signIn: HostSignIn): void {
    this.save();
    this.changed(id, signIn);
  }

  private twinOf(id: number, signIn: HostSignIn): number | undefined {
    const key: string | null = AzureAccounts.keyOfAccount(signIn, this.signInOf(id).place);
    const other: number | undefined = key === null ? undefined
      : [...this.entries].find(([t, u]) => t !== id && AzureAccounts.keyOfAccount(u.current, u.place) === key)?.[0];
    if (other === undefined)
      return undefined;
    return id === AzureAccounts.firstId ? other : id;
  }

  private drop(id: number): void {
    const signIn: AzureSignIn = this.signInOf(id);
    this.log.write(Resources.accountAlreadyKept);
    const dropped: Promise<void> = Promise.resolve().then(() => signIn.alreadyKeptAsync()).catch((error: unknown) =>
      this.log.write(Resources.formatSignInBroken(String(error)))).finally(() => this.dropping.delete(id));
    this.dropping.set(id, dropped);
  }

  private leave(id: number): void {
    this.signInOf(id).dispose();
    this.entries.delete(id);
    this.picks = this.picks.filter(t => t.account !== id);
  }

  private async readKeptAsync(): Promise<KeptAccounts | null> {
    let kept: string | null;
    try {
      kept = await this.secrets.readAsync(Resources.accountsSecret);
    }
    catch (error) {
      if (!(error instanceof MethodFailureException))
        throw error;
      if (SecretFailures.reasonOf(error.failure) === SecretFailureReason.NotConnected && this.unfollowWindows === null)
        this.unfollowWindows = this.appWindows.onChanged(() => this.restoreOnceConnected());
      else
        this.log.write(Resources.formatKeptAccountsUnread(error.failure.message));
      return null;
    }
    this.kept = kept;
    if (kept === null)
      return null;
    try {
      return KeptAccounts.fromJson(JsonReader.parseValue(kept));
    }
    catch (error) {
      if (!(error instanceof JsonException || error instanceof HostingProtocolException))
        throw error;
      this.log.write(Resources.keptAccountsUnreadable);
      return null;
    }
  }

  private restoreOnceConnected(): void {
    this.unfollowWindows?.();
    this.unfollowWindows = null;
    this.restoreAsync().catch((error: unknown) => this.log.write(Resources.formatSignInBroken(String(error))));
  }

  private save(): void {
    const accounts: KeptAccount[] = [];
    for (const [id, signIn] of this.entries) {
      const login: string | null = signIn.current.account?.login ?? null;
      if (id !== AzureAccounts.firstId && (login !== null || signIn.keptUnreadable))
        accounts.push(new KeptAccount(id, signIn.organization, login));
    }
    const value: string = JSON.stringify(new KeptAccounts(accounts, this.picks).toJson());
    if (this.stopped || value === this.kept || (this.kept === null && accounts.length === 0 && this.picks.length === 0))
      return;
    this.kept = value;
    this.saving = this.saving.then(() => this.secrets.saveAsync(Resources.accountsSecret, value)).catch((error: unknown) =>
      this.log.write(error instanceof MethodFailureException ? Resources.accountsNotKept : Resources.formatSignInBroken(String(error))));
  }

  private static keyOfAccount(signIn: HostSignIn, place: string | null): string | null {
    return signIn.account === null ? null : [place, signIn.account.login.toLowerCase()].join(Resources.pathSeparator);
  }

  private static isSameRepository(pick: AccountPick, host: string, path: string): boolean {
    return pick.host.toLowerCase() === host.toLowerCase() && pick.path.toLowerCase() === path.toLowerCase();
  }
}

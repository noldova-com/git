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
import { AccountPick, HostAccountEntry, HostAccountList, HostingProtocolException, type HostSignIn, RepositoryAccount, SignInState } from "@noldova/git.hosting.protocol";

import { GitHubException } from "../exceptions/github.exception.ts";
import type { IGitHubTokens } from "../interfaces/i-github-tokens.ts";
import type { AccountRead } from "../models/account-read.ts";
import { GitHubRepository } from "../models/github-repository.ts";
import { KeptAccount } from "../models/kept-account.ts";
import { KeptAccounts } from "../models/kept-accounts.ts";
import { SignedInAccount } from "../models/signed-in-account.ts";
import type { TokenConnect } from "../models/token-connect.ts";
import { Resources } from "../resources.ts";
import { GitHubApi } from "./github-api.ts";
import type { GitHubDeviceFlow } from "./github-device-flow.ts";
import { GitHubSignIn } from "./github-sign-in.ts";

export class GitHubAccounts implements IGitHubTokens {
  private static readonly firstId: number = 1;

  private readonly flow: GitHubDeviceFlow;
  private readonly secrets: IModuleSecrets;
  private readonly appWindows: IAppWindows;
  private readonly log: IModuleLog;
  private readonly api: GitHubApi;
  private readonly changed: (id: number, signIn: HostSignIn) => void;
  private readonly entries: Map<number, GitHubSignIn> = new Map();
  private readonly found: Map<string, Promise<number>> = new Map();
  private readonly users: Map<string, string> = new Map();
  private readonly dropping: Map<number, Promise<void>> = new Map();
  private picks: readonly AccountPick[] = [];
  private kept: string | null = null;
  private isIndexRead: boolean = false;
  private reading: Promise<KeptAccounts | null> = Promise.resolve(null);
  private saving: Promise<void> = Promise.resolve();
  private unfollowWindows: (() => void) | null = null;
  private stopped: boolean = false;

  public constructor(flow: GitHubDeviceFlow, secrets: IModuleSecrets, appWindows: IAppWindows, log: IModuleLog, api: GitHubApi,
    changed: (id: number, signIn: HostSignIn) => void) {
    this.flow = flow;
    this.secrets = secrets;
    this.appWindows = appWindows;
    this.log = log;
    this.api = api;
    this.changed = changed;
    this.entries.set(GitHubAccounts.firstId, this.make(GitHubAccounts.firstId));
  }

  public get first(): GitHubSignIn {
    return this.signInOf(GitHubAccounts.firstId);
  }

  public get list(): HostAccountList {
    return new HostAccountList([...this.entries].map(([id, signIn]) => new HostAccountEntry(id, signIn.current,
      signIn.host === Resources.host ? null : signIn.host)));
  }

  public get signedIn(): readonly SignedInAccount[] {
    const accounts: SignedInAccount[] = [];
    for (const [id, signIn] of this.entries) {
      const token: string | null = signIn.token;
      const login: string | undefined = signIn.current.account?.login;
      if (token !== null && login !== undefined && signIn.host === Resources.host)
        accounts.push(new SignedInAccount(id, login, token));
    }
    return accounts;
  }

  public async restoreAsync(): Promise<void> {
    if (this.stopped)
      return;
    this.reading = this.readKeptAsync();
    const kept: KeptAccounts | null = await this.reading;
    if (this.stopped)
      return;
    const named: readonly number[] = (kept?.accounts ?? []).map(t => t.id);
    for (const account of kept?.accounts ?? []) {
      if (!this.entries.has(account.id))
        this.entries.set(account.id, this.make(account.id, account.host));
    }
    this.picks = kept?.picks ?? [];
    const restoring: readonly [number, GitHubSignIn][] = [...this.entries].filter(([id]) => id === GitHubAccounts.firstId || named.includes(id));
    await Promise.all(restoring.map(([, t]) => t.restoreAsync()));
    for (const [id, signIn] of this.entries) {
      if (id !== GitHubAccounts.firstId && named.includes(id) && signIn.current.state === SignInState.SignedOut && signIn.current.failure === null
        && !signIn.keptUnreadable)
        this.leave(id);
    }
    this.save();
  }

  public signInOf(id: number): GitHubSignIn {
    const signIn: GitHubSignIn | undefined = this.entries.get(id);
    if (signIn === undefined)
      throw GitHubApi.failure(FailureCode.NotFound, Resources.unknownAccountMessage);
    return signIn;
  }

  public async addAsync(): Promise<HostAccountEntry> {
    await this.reading;
    if (!this.isIndexRead)
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.accountsUnreadMessage);
    const id: number = Math.max(...this.entries.keys()) + 1;
    const signIn: GitHubSignIn = this.make(id);
    this.entries.set(id, signIn);
    return new HostAccountEntry(id, await signIn.startAsync());
  }

  public async connectAsync(connect: TokenConnect, signal: AbortSignal): Promise<HostAccountEntry> {
    const host: string = connect.host.toLowerCase();
    if (!Resources.enterpriseHostPattern.test(host) || host === Resources.host)
      throw GitHubApi.failure(FailureCode.InvalidParams, Resources.enterpriseHostMessage);
    await this.reading;
    if (!this.isIndexRead)
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.accountsUnreadMessage);
    const read: AccountRead = await this.readTokenAsync(host, connect.token, signal);
    if (read.account.scopes.length > 0 && !read.account.scopes.includes(Resources.scope))
      throw GitHubApi.failure(FailureCode.Unauthorized, Resources.formatScopeMissing(host));
    const id: number = Math.max(...this.entries.keys()) + 1;
    const signIn: GitHubSignIn = this.make(id, host);
    this.entries.set(id, signIn);
    await signIn.adoptAsync(connect.token, read, signal);
    await this.dropping.get(id);
    const answer: HostSignIn = signIn.current;
    if (answer.state !== SignInState.SignedIn && this.entries.has(id)) {
      this.leave(id);
      this.publish(id, answer);
    }
    return new HostAccountEntry(id, answer, host);
  }

  public async signOutAsync(id: number): Promise<HostSignIn> {
    const signIn: GitHubSignIn = this.signInOf(id);
    const answer: HostSignIn = await signIn.signOutAsync();
    if (id !== GitHubAccounts.firstId && this.entries.has(id)) {
      this.leave(id);
      this.publish(id, answer);
    }
    return answer;
  }

  public async pickAsync(pick: AccountPick, signal: AbortSignal): Promise<RepositoryAccount> {
    this.signInOf(pick.account);
    const others: readonly AccountPick[] = this.picks.filter(t => !GitHubAccounts.isSameRepository(t, pick.host, pick.path));
    this.picks = [...others, pick].slice(-Resources.picksCap);
    this.found.delete(GitHubAccounts.keyOf(pick.host, pick.path));
    this.save();
    return this.repositoryAccountAsync(pick.host, pick.path, signal);
  }

  public async repositoryAccountAsync(host: string, path: string, signal: AbortSignal): Promise<RepositoryAccount> {
    const id: number | null = await this.accountForAsync(host, path, signal);
    return id === null ? new RepositoryAccount(null) : new RepositoryAccount(id, undefined, this.namedFor(host, path) === id);
  }

  public useUser(host: string, path: string, user: string | null): void {
    const key: string = GitHubAccounts.keyOf(host, path);
    this.users.delete(key);
    if (user === null)
      return;
    this.users.set(key, user.toLowerCase());
    for (const old of [...this.users.keys()].slice(0, -Resources.usersCap))
      this.users.delete(old);
  }

  public async accountForAsync(host: string, path: string, signal: AbortSignal): Promise<number | null> {
    const signedIn: readonly SignedInAccount[] = this.signedIn;
    const first: SignedInAccount | undefined = signedIn[0];
    if (first === undefined)
      return null;
    const named: number | null = this.namedFor(host, path);
    if (named !== null)
      return named;
    const pick: number | undefined = this.picks.find(t => GitHubAccounts.isSameRepository(t, host, path))?.account;
    if (pick !== undefined && signedIn.some(t => t.id === pick))
      return pick;
    if (signedIn.length === 1 || host !== Resources.host)
      return first.id;
    const key: string = GitHubAccounts.keyOf(host, path);
    let found: Promise<number> | undefined = this.found.get(key);
    if (found === undefined) {
      found = this.probeAsync(key, path, signedIn, first.id);
      this.found.set(key, found);
    }
    const id: number = await found;
    signal.throwIfAborted();
    const now: readonly SignedInAccount[] = this.signedIn;
    return now.some(t => t.id === id) ? id : now[0]?.id ?? null;
  }

  public async tokenForAsync(host: string, path: string, signal: AbortSignal): Promise<string | null> {
    const id: number | null = await this.accountForAsync(host, path, signal);
    return id === null ? null : this.signInOf(id).token;
  }

  private namedFor(host: string, path: string): number | null {
    const user: string | undefined = this.users.get(GitHubAccounts.keyOf(host, path));
    return this.signedIn.find(t => t.login.toLowerCase() === user)?.id ?? null;
  }

  public holds(token: string): boolean {
    return [...this.entries.values()].some(t => t.token === token);
  }

  public async refusedAsync(token: string): Promise<void> {
    await Promise.all([...this.entries.values()].map(t => t.refusedAsync(token)));
  }

  public dispose(): void {
    this.stopped = true;
    this.unfollowWindows?.();
    this.unfollowWindows = null;
    for (const signIn of this.entries.values())
      signIn.dispose();
  }

  private make(id: number, host: string = Resources.host): GitHubSignIn {
    const secret: string = id === GitHubAccounts.firstId ? Resources.signInSecret : Resources.formatAccountSecret(id);
    return new GitHubSignIn(this.flow, this.secrets, this.appWindows, this.log, t => this.onChanged(id, t), secret, host);
  }

  private async readTokenAsync(host: string, token: string, signal: AbortSignal): Promise<AccountRead> {
    let read: AccountRead | null;
    try {
      read = await this.flow.readAccountAsync(token, signal, host);
    }
    catch (error) {
      if (!(error instanceof GitHubException))
        throw error;
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.formatServerUnreachable(host));
    }
    if (read === null)
      throw GitHubApi.failure(FailureCode.Unauthorized, Resources.formatTokenRefused(host));
    return read;
  }

  private onChanged(id: number, signIn: HostSignIn): void {
    const twin: number | undefined = this.twinOf(id, signIn);
    if (twin !== undefined) {
      this.drop(twin);
      if (twin === id)
        return;
    }
    if (id !== GitHubAccounts.firstId && signIn.state === SignInState.SignedOut && signIn.failure === null)
      this.leave(id);
    this.publish(id, signIn);
  }

  private publish(id: number, signIn: HostSignIn): void {
    this.found.clear();
    this.save();
    this.changed(id, signIn);
  }

  private twinOf(id: number, signIn: HostSignIn): number | undefined {
    const host: string = this.signInOf(id).host;
    const login: string | null = GitHubAccounts.loginOf(signIn);
    const other: number | undefined = login === null ? undefined : [...this.entries].find(([t, entry]) => t !== id && entry.host === host
      && GitHubAccounts.loginOf(entry.current) === login)?.[0];
    if (other === undefined)
      return undefined;
    return id === GitHubAccounts.firstId ? other : id;
  }

  private drop(id: number): void {
    const signIn: GitHubSignIn = this.signInOf(id);
    this.log.write(Resources.accountAlreadyKept);
    this.dropping.set(id, Promise.resolve().then(() => signIn.alreadyKeptAsync())
      .catch((error: unknown) => this.log.write(Resources.formatSignInBroken(String(error)))));
  }

  private leave(id: number): void {
    this.signInOf(id).dispose();
    this.entries.delete(id);
    this.dropping.delete(id);
    this.picks = this.picks.filter(t => t.account !== id);
  }

  private async probeAsync(key: string, path: string, signedIn: readonly SignedInAccount[], first: number): Promise<number> {
    const repository: GitHubRepository | null = GitHubRepository.parse(path);
    if (repository === null)
      return first;
    let isSure: boolean = true;
    for (const account of signedIn) {
      try {
        if (await this.api.getAsync(repository.path, account.token, new AbortController().signal) !== null)
          return account.id;
      }
      catch (error) {
        if (!GitHubApi.isAnswered(error)) {
          this.found.delete(key);
          return first;
        }
        isSure = false;
        if (GitHubApi.isUnauthorized(error))
          await this.refusedAsync(account.token);
      }
    }
    if (!isSure)
      this.found.delete(key);
    return first;
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
    if (kept === null) {
      this.isIndexRead = true;
      return null;
    }
    try {
      const read: KeptAccounts = KeptAccounts.fromJson(JsonReader.parseValue(kept));
      this.isIndexRead = true;
      return read;
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
      if (id !== GitHubAccounts.firstId && (login !== null || signIn.keptUnreadable))
        accounts.push(new KeptAccount(id, signIn.host, login));
    }
    const value: string = JSON.stringify(new KeptAccounts(accounts, this.picks).toJson());
    if (this.stopped || !this.isIndexRead || value === this.kept || (this.kept === null && accounts.length === 0 && this.picks.length === 0))
      return;
    this.kept = value;
    this.saving = this.saving.then(() => this.secrets.saveAsync(Resources.accountsSecret, value)).catch((error: unknown) =>
      this.log.write(error instanceof MethodFailureException ? Resources.accountsNotKept : Resources.formatSignInBroken(String(error))));
  }

  private static loginOf(signIn: HostSignIn): string | null {
    return signIn.account === null ? null : signIn.account.login.toLowerCase();
  }

  private static keyOf(host: string, path: string): string {
    const key: string = Resources.formatDraftSubject(host, path).toLowerCase();
    return key.endsWith(Resources.gitSuffix) ? key.slice(0, -Resources.gitSuffix.length) : key;
  }

  private static isSameRepository(pick: AccountPick, host: string, path: string): boolean {
    return pick.host.toLowerCase() === host.toLowerCase() && pick.path.toLowerCase() === path.toLowerCase();
  }
}

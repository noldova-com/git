/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
import { type IAppWindows, type IModuleLog, type IModuleSecrets, MethodFailureException } from "@noldova/desktop.runtime";
import { HostAccount, HostingProtocolException, HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";

import { SignInKind } from "../enums/sign-in-kind.ts";
import type { IAzureToken } from "../interfaces/i-azure-token.ts";
import { AzureCredential } from "../models/azure-credential.ts";
import type { EntraGrant } from "../models/entra-grant.ts";
import { HeldSignIn } from "../models/held-sign-in.ts";
import { KeptSignIn } from "../models/kept-sign-in.ts";
import type { RedirectAnswer } from "../models/redirect-answer.ts";
import { Resources } from "../resources.ts";
import { AzureApi } from "./azure-api.ts";
import { EntraFlow } from "./entra-flow.ts";
import { LoopbackRedirect } from "./loopback-redirect.ts";

export class AzureSignIn implements IAzureToken {
  private readonly api: AzureApi;
  private readonly flow: EntraFlow;
  private readonly secrets: IModuleSecrets;
  private readonly appWindows: IAppWindows;
  private readonly log: IModuleLog;
  private readonly changed: (signIn: HostSignIn) => void;
  private readonly stopped: AbortController = new AbortController();
  private signIn: HostSignIn = HostSignIn.signedOut();
  private unfollowWindows: (() => void) | null = null;
  private generation: number = 0;
  private held: HeldSignIn | null = null;
  private kept: KeptSignIn | null = null;
  private waiting: AbortController | null = null;
  private renewal: ReturnType<typeof setTimeout> | undefined = undefined;
  private checking: Promise<void> | null = null;
  private isSigningIn: boolean = false;

  public constructor(api: AzureApi, flow: EntraFlow, secrets: IModuleSecrets, appWindows: IAppWindows, log: IModuleLog, changed: (signIn: HostSignIn) => void) {
    this.api = api;
    this.flow = flow;
    this.secrets = secrets;
    this.appWindows = appWindows;
    this.log = log;
    this.changed = changed;
  }

  public get current(): HostSignIn {
    return this.signIn;
  }

  public get token(): AzureCredential | null {
    return this.held?.token ?? null;
  }

  public get organization(): string | null {
    return this.held?.organization ?? null;
  }

  public async restoreAsync(): Promise<void> {
    if (this.stopped.signal.aborted)
      return;
    let kept: string | null;
    try {
      kept = await this.secrets.readAsync(Resources.signInSecret) ?? await this.secrets.readAsync(Resources.microsoftSignInSecret);
    }
    catch (error) {
      if (this.stopped.signal.aborted)
        return;
      if (!(error instanceof MethodFailureException))
        throw error;
      if (SecretFailures.reasonOf(error.failure) !== SecretFailureReason.NotConnected)
        this.log.write(Resources.formatKeptSignInUnread(error.failure.message));
      else if (Object.isNull(this.unfollowWindows))
        this.unfollowWindows = this.appWindows.onChanged(() => this.restoreOnceConnected());
      return;
    }
    if (Object.isNull(kept))
      return;
    let restored: KeptSignIn;
    try {
      restored = KeptSignIn.fromJson(JsonReader.parseValue(kept));
    }
    catch (error) {
      if (!(error instanceof JsonException || error instanceof HostingProtocolException))
        throw error;
      this.log.write(Resources.formatSignInFailed(SignInFailure.Unkept));
      return;
    }
    if (this.signIn.state !== SignInState.SignedOut || this.stopped.signal.aborted)
      return;
    const credential = restored.kind === SignInKind.Microsoft ? AzureCredential.ofAccess(Resources.emptyText) : AzureCredential.ofToken(restored.token);
    this.held = new HeldSignIn(credential, restored.organization);
    this.kept = restored;
    this.set(HostSignIn.signedIn(restored.account));
    this.background(restored.kind === SignInKind.Microsoft ? this.recheckOnceAsync(credential, restored.organization, restored)
      : this.checkAsync(credential, restored.organization, this.generation));
  }

  public async startSignInAsync(organization: string): Promise<HostSignIn> {
    if (this.isBusy())
      return this.signIn;
    const state: string = EntraFlow.createSecret();
    const verifier: string = EntraFlow.createSecret();
    const redirect = await LoopbackRedirect.openAsync(state);
    if (this.isBusy()) {
      redirect.close();
      return this.signIn;
    }
    const waiting = new AbortController();
    this.waiting = waiting;
    const generation: number = ++this.generation;
    const timer = setTimeout(() => waiting.abort(SignInFailure.Expired), Resources.browserSignInLimit);
    const signal = AbortSignal.any([waiting.signal, this.stopped.signal]);
    this.set(HostSignIn.waitingInBrowser(EntraFlow.formatAuthorizeAddress(redirect.redirectUri, state, verifier)));
    this.background(this.finishAsync(redirect, verifier, organization, generation, signal).finally(() => {
      clearTimeout(timer);
      redirect.close();
    }));
    return this.signIn;
  }

  public cancelSignIn(): HostSignIn {
    if (Object.isNull(this.waiting))
      return this.signIn;
    this.waiting.abort();
    this.waiting = null;
    this.generation++;
    this.set(HostSignIn.signedOut());
    return this.signIn;
  }

  public async signInWithTokenAsync(token: string, organization: string, signal: AbortSignal): Promise<HostSignIn> {
    if (this.isBusy())
      return this.signIn;
    this.isSigningIn = true;
    try {
      return await this.trySignInAsync(token, organization, signal);
    }
    finally {
      this.isSigningIn = false;
    }
  }

  public async signOutAsync(): Promise<HostSignIn> {
    this.cancelSignIn();
    if (this.signIn.state === SignInState.SignedIn)
      await this.forgetAsync(null);
    return this.signIn;
  }

  public async refusedAsync(token: AzureCredential): Promise<void> {
    const held = this.held;
    const kept = this.kept;
    if (held?.token !== token || Object.isNull(kept))
      return;
    await this.recheckOnceAsync(token, held.organization, kept);
  }

  public async readyAsync(): Promise<void> {
    await this.checking?.catch(() => undefined);
  }

  public dispose(): void {
    this.stopped.abort();
    clearTimeout(this.renewal);
    this.waiting = null;
    this.held = null;
    this.kept = null;
    this.unfollowWindows?.();
    this.unfollowWindows = null;
  }

  private async trySignInAsync(token: string, organization: string, signal: AbortSignal): Promise<HostSignIn> {
    const generation: number = ++this.generation;
    const ended = (failure: SignInFailure): HostSignIn => {
      this.log.write(Resources.formatSignInFailed(failure));
      if (generation === this.generation)
        this.set(HostSignIn.signedOut(failure));
      return this.signIn;
    };
    const credential = AzureCredential.ofToken(token);
    let account: HostAccount | null;
    try {
      account = await this.readAccountAsync(credential, organization, AbortSignal.any([signal, this.stopped.signal]));
    }
    catch (error) {
      if (!(error instanceof MethodFailureException) || signal.aborted || this.stopped.signal.aborted)
        throw error;
      return ended(SignInFailure.Unreachable);
    }
    if (Object.isNull(account))
      return ended(SignInFailure.Refused);
    const kept = new KeptSignIn(SignInKind.Token, token, organization, account);
    if (!await this.saveAsync(kept))
      return ended(SignInFailure.Unkept);
    if (this.stopped.signal.aborted)
      return this.signIn;
    if (generation !== this.generation) {
      await this.removeKeptAsync();
      return this.signIn;
    }
    this.signedIn(credential, kept);
    return this.signIn;
  }

  private async finishAsync(redirect: LoopbackRedirect, verifier: string, organization: string, generation: number, signal: AbortSignal): Promise<void> {
    const ended = (failure: SignInFailure): void => {
      this.log.write(Resources.formatSignInFailed(failure));
      if (generation !== this.generation)
        return;
      this.waiting = null;
      this.set(HostSignIn.signedOut(failure));
    };
    try {
      const answer: RedirectAnswer = await Promise.race([redirect.answered, AzureSignIn.abortedAsync(signal)]);
      if (Object.isNull(answer.code))
        return ended(answer.error === Resources.accessDeniedError ? SignInFailure.Denied : SignInFailure.Refused);
      const grant = await this.flow.redeemAsync(answer.code, redirect.redirectUri, verifier, signal);
      if (Object.isNull(grant))
        return ended(SignInFailure.Refused);
      const credential = AzureCredential.ofAccess(grant.accessToken);
      const account = await this.readAccountAsync(credential, organization, signal);
      if (Object.isNull(account))
        return ended(SignInFailure.Refused);
      const kept = new KeptSignIn(SignInKind.Microsoft, grant.refreshToken, organization, account);
      if (!await this.saveAsync(kept))
        return ended(SignInFailure.Unkept);
      if (this.stopped.signal.aborted)
        return;
      if (generation !== this.generation) {
        await this.removeKeptAsync();
        return;
      }
      this.waiting = null;
      this.signedIn(credential, kept);
      this.renewLater(credential, kept, grant.expiresIn);
    }
    catch (error) {
      if (signal.aborted && signal.reason !== SignInFailure.Expired)
        return;
      ended(signal.aborted ? SignInFailure.Expired : SignInFailure.Unreachable);
      if (!signal.aborted && !(error instanceof MethodFailureException))
        throw error;
    }
  }

  private signedIn(credential: AzureCredential, kept: KeptSignIn): void {
    this.held = new HeldSignIn(credential, kept.organization);
    this.kept = kept;
    this.log.write(Resources.formatSignedIn(kept.account.login));
    this.set(HostSignIn.signedIn(kept.account));
  }

  private renewLater(credential: AzureCredential, kept: KeptSignIn, expiresIn: number): void {
    const generation: number = this.generation;
    clearTimeout(this.renewal);
    this.renewal = setTimeout(() => this.background(this.renewAsync(credential, kept, generation).then(() => undefined)),
      Math.max(expiresIn - Resources.refreshMargin, 0));
  }

  private async renewAsync(credential: AzureCredential, kept: KeptSignIn, generation: number): Promise<boolean> {
    let grant: EntraGrant | null;
    try {
      grant = await this.flow.refreshAsync(kept.token, this.stopped.signal);
    }
    catch (error) {
      if (this.stopped.signal.aborted)
        return false;
      if (!(error instanceof MethodFailureException))
        throw error;
      this.log.write(Resources.formatSignInNotChecked(error.failure.message));
      return false;
    }
    if (generation !== this.generation)
      return false;
    if (Object.isNull(grant)) {
      await this.forgetAsync(SignInFailure.Expired);
      return false;
    }
    credential.renew(grant.accessToken, grant.canWriteCode);
    if (!grant.canWriteCode)
      this.log.write(Resources.codeWritesNotAllowedMessage);
    const renewed = new KeptSignIn(SignInKind.Microsoft, grant.refreshToken, kept.organization, kept.account);
    this.kept = renewed;
    this.renewLater(credential, renewed, grant.expiresIn);
    if (!await this.saveAsync(renewed))
      this.log.write(Resources.renewalNotKept);
    return true;
  }

  private recheckOnceAsync(token: AzureCredential, organization: string, kept: KeptSignIn): Promise<void> {
    this.checking ??= this.recheckAsync(token, organization, kept, this.generation).finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  private async recheckAsync(token: AzureCredential, organization: string, kept: KeptSignIn, generation: number): Promise<void> {
    if (kept.kind === SignInKind.Microsoft && !await this.renewAsync(token, kept, generation))
      return;
    await this.checkAsync(token, organization, generation);
  }

  private restoreOnceConnected(): void {
    this.unfollowWindows?.();
    this.unfollowWindows = null;
    this.background(this.restoreAsync());
  }

  private async readAccountAsync(token: AzureCredential, organization: string, signal: AbortSignal): Promise<HostAccount | null> {
    let connection: JsonReader | null;
    try {
      connection = await this.api.getAsync(Resources.formatConnectionDataUrl(organization), token, signal);
    }
    catch (error) {
      if (AzureApi.isUnauthorized(error))
        return null;
      throw error;
    }
    return Object.isNull(connection) ? null : AzureApi.read(() => AzureSignIn.accountOf(connection.readObject(Resources.authenticatedUserField)));
  }

  private static accountOf(user: JsonReader): HostAccount | null {
    const properties: JsonReader = user.readObject(Resources.propertiesField);
    return properties.hasField(Resources.accountProperty) ? new HostAccount(properties.readObject(Resources.accountProperty)
      .readNonBlankString(Resources.propertyValueField), user.readNonBlankString(Resources.providerDisplayNameField), null, []) : null;
  }

  private async checkAsync(token: AzureCredential, organization: string, generation: number): Promise<void> {
    let account: HostAccount | null;
    try {
      account = await this.readAccountAsync(token, organization, this.stopped.signal);
    }
    catch (error) {
      if (this.stopped.signal.aborted)
        return;
      if (!(error instanceof MethodFailureException))
        throw error;
      this.log.write(Resources.formatSignInNotChecked(error.failure.message));
      return;
    }
    if (this.signIn.state !== SignInState.SignedIn || this.generation !== generation)
      return;
    if (Object.isNull(account))
      await this.forgetAsync(SignInFailure.Revoked);
    else
      this.set(HostSignIn.signedIn(account));
  }

  private async saveAsync(kept: KeptSignIn): Promise<boolean> {
    const isMicrosoft: boolean = kept.kind === SignInKind.Microsoft;
    const name: string = isMicrosoft ? Resources.microsoftSignInSecret : Resources.signInSecret;
    const other: string = isMicrosoft ? Resources.signInSecret : Resources.microsoftSignInSecret;
    try {
      await this.secrets.saveAsync(name, JSON.stringify(kept.toJson()));
    }
    catch (error) {
      if (!(error instanceof MethodFailureException))
        throw error;
      return false;
    }
    await this.removeSecretsAsync(other);
    return true;
  }

  private async forgetAsync(failure: SignInFailure | null): Promise<void> {
    this.generation++;
    clearTimeout(this.renewal);
    this.held = null;
    this.kept = null;
    let isRemoved: boolean = false;
    try {
      isRemoved = await this.removeKeptAsync();
    }
    finally {
      this.set(HostSignIn.signedOut(failure ?? (isRemoved ? undefined : SignInFailure.Unforgotten)));
    }
  }

  private removeKeptAsync(): Promise<boolean> {
    return this.removeSecretsAsync(Resources.signInSecret, Resources.microsoftSignInSecret);
  }

  private async removeSecretsAsync(...names: readonly string[]): Promise<boolean> {
    const removals = await Promise.allSettled(names.map(t => this.secrets.removeAsync(t)));
    const failures: unknown[] = removals.flatMap(t => t.status === Resources.rejectedStatus ? [t.reason] : []);
    const unexpected = failures.find(t => !(t instanceof MethodFailureException));
    if (!Object.isUndefined(unexpected))
      throw unexpected;
    if (failures.length === 0)
      return true;
    this.log.write(Resources.tokenNotForgotten);
    return false;
  }

  private isBusy(): boolean {
    return this.isSigningIn || !Object.isNull(this.waiting) || this.signIn.state !== SignInState.SignedOut || this.stopped.signal.aborted;
  }

  private set(signIn: HostSignIn): void {
    if (this.stopped.signal.aborted)
      return;
    this.signIn = signIn;
    this.changed(signIn);
  }

  private background(work: Promise<void>): void {
    work.catch((error: unknown) => this.log.write(Resources.formatSignInBroken(String(error))));
  }

  private static abortedAsync(signal: AbortSignal): Promise<never> {
    return new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }
}

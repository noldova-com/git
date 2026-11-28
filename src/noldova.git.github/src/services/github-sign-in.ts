/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import timers from "node:timers/promises";

import { JsonException, JsonReader } from "@noldova/context.json";
import { SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
import { type IAppWindows, type IModuleLog, type IModuleSecrets, MethodFailureException } from "@noldova/desktop.runtime";
import { type HostAccount, HostingProtocolException, HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";

import { GitHubException } from "../exceptions/github.exception.ts";
import { SignInDeniedException } from "../exceptions/sign-in-denied.exception.ts";
import { SignInExpiredException } from "../exceptions/sign-in-expired.exception.ts";
import { SignInNotKeptException } from "../exceptions/sign-in-not-kept.exception.ts";
import { SignInTokenRefusedException } from "../exceptions/sign-in-token-refused.exception.ts";
import { SignInUnreachableException } from "../exceptions/sign-in-unreachable.exception.ts";
import type { AccountRead } from "../models/account-read.ts";
import type { DeviceGrant } from "../models/device-grant.ts";
import { KeptSignIn } from "../models/kept-sign-in.ts";
import { Resources } from "../resources.ts";
import type { GitHubDeviceFlow } from "./github-device-flow.ts";

export class GitHubSignIn {
  private readonly flow: GitHubDeviceFlow;
  private readonly secrets: IModuleSecrets;
  private readonly appWindows: IAppWindows;
  private readonly log: IModuleLog;
  private readonly changed: (signIn: HostSignIn) => void;
  private readonly secret: string;
  private readonly stopped: AbortController = new AbortController();
  private signIn: HostSignIn = HostSignIn.signedOut();
  private waiting: AbortController | null = null;
  private unfollowWindows: (() => void) | null = null;
  private generation: number = 0;
  private saves: number = 0;
  private heldToken: string | null = null;
  private unreadable: boolean = false;

  public readonly host: string;

  public constructor(flow: GitHubDeviceFlow, secrets: IModuleSecrets, appWindows: IAppWindows, log: IModuleLog, changed: (signIn: HostSignIn) => void,
    secret: string = Resources.signInSecret, host: string = Resources.host) {
    this.flow = flow;
    this.secrets = secrets;
    this.appWindows = appWindows;
    this.log = log;
    this.changed = changed;
    this.secret = secret;
    this.host = host;
  }

  public get current(): HostSignIn {
    return this.signIn;
  }

  public get token(): string | null {
    return this.heldToken;
  }

  public get keptUnreadable(): boolean {
    return this.unreadable;
  }

  public async restoreAsync(): Promise<void> {
    if (this.stopped.signal.aborted)
      return;
    let kept: string | null;
    try {
      kept = await this.secrets.readAsync(this.secret);
    }
    catch (error) {
      if (this.stopped.signal.aborted)
        return;
      if (!(error instanceof MethodFailureException))
        throw error;
      if (SecretFailures.reasonOf(error.failure) !== SecretFailureReason.NotConnected) {
        this.unreadable = true;
        this.log.write(Resources.formatKeptSignInUnread(error.failure.message));
      }
      else if (this.unfollowWindows === null)
        this.unfollowWindows = this.appWindows.onChanged(() => this.restoreOnceConnected());
      return;
    }
    this.unreadable = false;
    if (kept === null)
      return;
    let restored: KeptSignIn;
    try {
      restored = KeptSignIn.fromJson(JsonReader.parseValue(kept));
    }
    catch (error) {
      if (!(error instanceof JsonException || error instanceof HostingProtocolException))
        throw error;
      this.unreadable = true;
      this.log.write(Resources.formatSignInFailed(SignInFailure.Unkept));
      return;
    }
    if (this.signIn.state !== SignInState.SignedOut || this.stopped.signal.aborted)
      return;
    this.heldToken = restored.token;
    this.set(HostSignIn.signedIn(restored.account));
    this.background(this.checkAsync(restored.token, this.generation));
  }

  public async startAsync(): Promise<HostSignIn> {
    if (this.signIn.state !== SignInState.SignedOut || this.waiting !== null || this.stopped.signal.aborted)
      return this.signIn;
    const waiting = new AbortController();
    this.waiting = waiting;
    const signal = AbortSignal.any([waiting.signal, this.stopped.signal]);
    try {
      const grant = await this.flow.requestCodeAsync(Date.now(), signal);
      this.set(HostSignIn.waiting(grant.code));
      this.background(this.waitAsync(grant, signal));
    }
    catch (error) {
      this.end(error, signal);
    }
    return this.signIn;
  }

  public async adoptAsync(token: string, read: AccountRead, signal: AbortSignal): Promise<HostSignIn> {
    const signed = AbortSignal.any([signal, this.stopped.signal]);
    try {
      await this.keepReadAsync(token, read, signed);
    }
    catch (error) {
      this.end(error, signed);
    }
    return this.signIn;
  }

  public cancel(): HostSignIn {
    if (this.waiting === null)
      return this.signIn;
    this.waiting.abort();
    this.waiting = null;
    this.set(HostSignIn.signedOut());
    return this.signIn;
  }

  public async signOutAsync(): Promise<HostSignIn> {
    this.cancel();
    if (this.signIn.state === SignInState.SignedIn)
      await this.forgetAsync(null);
    return this.signIn;
  }

  public async alreadyKeptAsync(): Promise<void> {
    if (this.signIn.state === SignInState.SignedIn)
      await this.forgetAsync(SignInFailure.AlreadyKept);
  }

  public async refusedAsync(token: string): Promise<void> {
    if (this.heldToken === token)
      await this.forgetAsync(SignInFailure.Revoked);
  }

  public dispose(): void {
    this.stopped.abort();
    this.waiting = null;
    this.heldToken = null;
    this.unfollowWindows?.();
    this.unfollowWindows = null;
  }

  private restoreOnceConnected(): void {
    this.unfollowWindows?.();
    this.unfollowWindows = null;
    this.background(this.restoreAsync());
  }

  private async waitAsync(grant: DeviceGrant, signal: AbortSignal): Promise<void> {
    let interval: number = grant.interval;
    const expiry: AbortController = new AbortController();
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => expiry.abort(), grant.expiresIn);
    try {
      for (;;) {
        await timers.setTimeout(interval, undefined, { signal });
        if (expiry.signal.aborted)
          throw new SignInExpiredException();
        const poll = await this.flow.pollAsync(grant.deviceCode, signal);
        if (poll.token !== null) {
          await this.keepAsync(poll.token, signal);
          return;
        }
        if (poll.slowDown)
          interval = poll.interval ?? interval + Resources.slowDownStep;
      }
    }
    catch (error) {
      this.end(error, signal);
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async keepAsync(token: string, signal: AbortSignal): Promise<void> {
    const read = await this.flow.readAccountAsync(token, signal);
    if (read === null)
      throw new SignInTokenRefusedException();
    await this.keepReadAsync(token, read, signal);
  }

  private async keepReadAsync(token: string, read: AccountRead, signal: AbortSignal): Promise<void> {
    const { account } = read;
    const save: number = ++this.saves;
    try {
      await this.secrets.saveAsync(this.secret, JSON.stringify(new KeptSignIn(token, account).toJson()));
    }
    catch (error) {
      if (!(error instanceof MethodFailureException))
        throw error;
      throw new SignInNotKeptException(error);
    }
    if (signal.aborted) {
      if (!this.stopped.signal.aborted && save === this.saves)
        await this.removeKeptAsync();
      return;
    }
    this.waiting = null;
    this.generation++;
    this.unreadable = false;
    this.heldToken = token;
    this.log.write(Resources.formatSignedIn(account.login));
    this.set(HostSignIn.signedIn(account));
    this.background(this.showAvatarAsync(read, this.generation));
  }

  private async checkAsync(token: string, generation: number): Promise<void> {
    let read: AccountRead | null;
    try {
      read = await this.flow.readAccountAsync(token, this.stopped.signal, this.host);
    }
    catch (error) {
      if (this.stopped.signal.aborted)
        return;
      if (!(error instanceof GitHubException))
        throw error;
      this.log.write(Resources.formatSignInNotChecked(error.message));
      return;
    }
    if (this.signIn.state !== SignInState.SignedIn || this.generation !== generation)
      return;
    if (read === null) {
      await this.forgetAsync(SignInFailure.Revoked);
      return;
    }
    this.set(HostSignIn.signedIn(read.account));
    await this.showAvatarAsync(read, generation);
  }

  private async showAvatarAsync(read: AccountRead, generation: number): Promise<void> {
    let account: HostAccount;
    try {
      account = await this.flow.withAvatarAsync(read, this.stopped.signal);
    }
    catch (error) {
      if (this.stopped.signal.aborted)
        return;
      throw error;
    }
    if (account !== read.account && this.generation === generation)
      this.set(HostSignIn.signedIn(account));
  }

  private async forgetAsync(failure: SignInFailure | null): Promise<void> {
    this.generation++;
    this.heldToken = null;
    let isRemoved: boolean = false;
    try {
      isRemoved = await this.removeKeptAsync();
    }
    finally {
      this.set(HostSignIn.signedOut(failure ?? (isRemoved ? undefined : SignInFailure.Unforgotten)));
    }
  }

  private async removeKeptAsync(): Promise<boolean> {
    try {
      await this.secrets.removeAsync(this.secret);
      return true;
    }
    catch (error) {
      if (!(error instanceof MethodFailureException))
        throw error;
      this.log.write(Resources.tokenNotForgotten);
      return false;
    }
  }

  private end(error: unknown, signal: AbortSignal): void {
    if (signal.aborted)
      return;
    this.waiting = null;
    if (!(error instanceof GitHubException)) {
      if (this.signIn.state === SignInState.Waiting)
        this.set(HostSignIn.signedOut());
      throw error;
    }
    const failure: SignInFailure = GitHubSignIn.failureOf(error);
    this.log.write(Resources.formatSignInFailed(failure));
    this.set(HostSignIn.signedOut(failure));
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

  private static failureOf(error: GitHubException): SignInFailure {
    if (error instanceof SignInExpiredException)
      return SignInFailure.Expired;
    if (error instanceof SignInDeniedException)
      return SignInFailure.Denied;
    if (error instanceof SignInUnreachableException)
      return SignInFailure.Unreachable;
    if (error instanceof SignInNotKeptException)
      return SignInFailure.Unkept;
    return SignInFailure.Refused;
  }
}

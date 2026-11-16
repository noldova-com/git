/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, type JsonObject, JsonReader } from "@noldova/context.json";
import { DeviceCode, HostAccount, HostingProtocolException } from "@noldova/git.hosting.protocol";
import { GitHubNames } from "@noldova/git.github.protocol";

import { SignInAnswerUnreadableException } from "../exceptions/sign-in-answer-unreadable.exception.ts";
import { SignInDeniedException } from "../exceptions/sign-in-denied.exception.ts";
import { SignInErrorException } from "../exceptions/sign-in-error.exception.ts";
import { SignInExpiredException } from "../exceptions/sign-in-expired.exception.ts";
import { SignInExpiryInvalidException } from "../exceptions/sign-in-expiry-invalid.exception.ts";
import { SignInRequestRefusedException } from "../exceptions/sign-in-request-refused.exception.ts";
import { SignInUnreachableException } from "../exceptions/sign-in-unreachable.exception.ts";
import { AccountRead } from "../models/account-read.ts";
import { DeviceGrant } from "../models/device-grant.ts";
import { DevicePoll } from "../models/device-poll.ts";
import { Resources } from "../resources.ts";
import type { Fetcher } from "../types/fetcher.ts";
import type { GitHubAvatars } from "./github-avatars.ts";

export class GitHubDeviceFlow {
  private readonly fetcher: Fetcher;
  private readonly avatars: GitHubAvatars;

  public constructor(fetcher: Fetcher, avatars: GitHubAvatars) {
    this.fetcher = fetcher;
    this.avatars = avatars;
  }

  public async requestCodeAsync(now: number, signal: AbortSignal): Promise<DeviceGrant> {
    const reader = await this.postAsync(Resources.deviceCodeUrl, { [Resources.clientIdField]: GitHubNames.clientId, [Resources.scopeField]: Resources.scope },
      signal);
    return GitHubDeviceFlow.read(() => {
      const deviceCode: string = reader.readNonBlankString(Resources.deviceCodeField);
      const expiresIn: number = GitHubDeviceFlow.expiryOf(reader);
      return new DeviceGrant(deviceCode, new DeviceCode(reader.readString(Resources.userCodeField), reader.readString(Resources.verificationUriField),
        now + expiresIn), expiresIn, GitHubDeviceFlow.intervalOf(reader) ?? Resources.defaultInterval);
    });
  }

  public async pollAsync(deviceCode: string, signal: AbortSignal): Promise<DevicePoll> {
    const reader = await this.postAsync(Resources.accessTokenUrl, {
      [Resources.clientIdField]: GitHubNames.clientId, [Resources.deviceCodeField]: deviceCode, [Resources.grantTypeField]: Resources.grantType
    }, signal);
    return GitHubDeviceFlow.read(() => {
      if (!reader.hasField(Resources.errorField))
        return DevicePoll.granted(reader.readNonBlankString(Resources.accessTokenField));
      const error: string = reader.readString(Resources.errorField);
      if (error === Resources.pendingError)
        return DevicePoll.pending();
      if (error === Resources.slowDownError)
        return DevicePoll.slowedDown(GitHubDeviceFlow.intervalOf(reader));
      if (error === Resources.expiredError)
        throw new SignInExpiredException();
      if (error === Resources.deniedError)
        throw new SignInDeniedException();
      throw new SignInErrorException(error);
    });
  }

  public async readAccountAsync(token: string, signal: AbortSignal): Promise<AccountRead | null> {
    const response = await this.fetchAsync(Resources.userUrl, {
      headers: {
        [Resources.acceptHeader]: Resources.gitHubJsonType, [Resources.authorizationHeader]: Resources.formatBearer(token),
        [Resources.userAgentHeader]: Resources.userAgent, [Resources.apiVersionHeader]: Resources.apiVersion
      }
    }, signal);
    if (response.status === Resources.unauthorizedStatus) {
      await GitHubDeviceFlow.dropBodyAsync(response);
      return null;
    }
    const reader = await GitHubDeviceFlow.readBodyAsync(Resources.userUrl, response, signal);
    const scopes: readonly string[] = (response.headers.get(Resources.scopesHeader) ?? "").split(Resources.scopeSeparator).map(t => t.trim()).filter(t => t.length > 0);
    return GitHubDeviceFlow.read(() => new AccountRead(new HostAccount(reader.readNonBlankString(Resources.loginField), reader.readNullableString(Resources.nameField), null,
      scopes), reader.readNullableString(Resources.avatarUrlField)));
  }

  public async withAvatarAsync(read: AccountRead, signal: AbortSignal): Promise<HostAccount> {
    const avatar: string | null = await this.avatars.readAsync(read.avatarUrl, signal);
    const { login, name, scopes } = read.account;
    return avatar === null ? read.account : new HostAccount(login, name, avatar, scopes);
  }

  private async postAsync(url: string, body: JsonObject, signal: AbortSignal): Promise<JsonReader> {
    const response = await this.fetchAsync(url, {
      method: Resources.postMethod,
      headers: {
        [Resources.acceptHeader]: Resources.jsonType, [Resources.contentTypeHeader]: Resources.jsonType, [Resources.userAgentHeader]: Resources.userAgent
      },
      body: JSON.stringify(body)
    }, signal);
    return GitHubDeviceFlow.readBodyAsync(url, response, signal);
  }

  private async fetchAsync(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(Resources.requestTimeout)]) });
    }
    catch (error) {
      throw GitHubDeviceFlow.unreachable(url, error, signal);
    }
    signal.throwIfAborted();
    return response;
  }

  private static async readBodyAsync(url: string, response: Response, signal: AbortSignal): Promise<JsonReader> {
    if (!response.ok) {
      await GitHubDeviceFlow.dropBodyAsync(response);
      throw new SignInRequestRefusedException(url, response.status);
    }
    let text: string;
    try {
      text = await response.text();
    }
    catch (error) {
      throw GitHubDeviceFlow.unreachable(url, error, signal);
    }
    signal.throwIfAborted();
    return GitHubDeviceFlow.read(() => JsonReader.parse(text));
  }

  private static async dropBodyAsync(response: Response): Promise<void> {
    await response.body?.cancel();
  }

  private static unreachable(url: string, error: unknown, signal: AbortSignal): unknown {
    if (signal.aborted)
      return signal.reason;
    if (error instanceof TypeError || error instanceof DOMException && error.name === Resources.timeoutErrorName)
      return new SignInUnreachableException(url, error);
    return error;
  }

  private static intervalOf(reader: JsonReader): number | null {
    if (!reader.hasField(Resources.intervalField))
      return null;
    const seconds: number = Math.max(reader.readInteger(Resources.intervalField), Resources.minimumIntervalSeconds);
    return Math.min(seconds, Resources.maximumIntervalSeconds) * Resources.millisecondsPerSecond;
  }

  private static expiryOf(reader: JsonReader): number {
    const seconds: number = reader.readInteger(Resources.expiresInField);
    if (seconds < Resources.minimumExpirySeconds || seconds > Resources.maximumExpirySeconds)
      throw new SignInExpiryInvalidException(seconds);
    return seconds * Resources.millisecondsPerSecond;
  }

  private static read<T>(read: () => T): T {
    try {
      return read();
    }
    catch (error) {
      if (error instanceof JsonException || error instanceof HostingProtocolException)
        throw new SignInAnswerUnreadableException(error);
      throw error;
    }
  }
}

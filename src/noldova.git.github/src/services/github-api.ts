/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, JsonReader } from "@noldova/context.json";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { HostingNames, HostingProtocolException } from "@noldova/git.hosting.protocol";

import { GitHubUnreachableException } from "../exceptions/github-unreachable.exception.ts";
import { CachedAnswer } from "../models/cached-answer.ts";
import { Resources } from "../resources.ts";
import type { Fetcher } from "../types/fetcher.ts";
import { AnswerText } from "./answer-text.ts";

export class GitHubApi {
  private readonly fetcher: Fetcher;
  private readonly answers: Map<string, Map<string, CachedAnswer>> = new Map();

  public constructor(fetcher: Fetcher) {
    this.fetcher = fetcher;
  }

  public async getAsync(host: string, path: string, token: string, signal: AbortSignal): Promise<JsonReader | null> {
    let answers: Map<string, CachedAnswer> | undefined = this.answers.get(token);
    if (answers === undefined) {
      answers = new Map();
      this.answers.set(token, answers);
    }
    const url: string = Resources.formatApiUrl(host) + path;
    const cached: CachedAnswer | undefined = answers.get(url);
    const now: number = Date.now();
    if (cached !== undefined && now - cached.readAt < Resources.freshFor)
      return this.reuse(url, cached, cached.readAt, token);
    const headers: Record<string, string> = GitHubApi.headersOf(token);
    const tag: string | null = cached?.tag ?? null;
    if (tag !== null)
      headers[Resources.ifNoneMatchHeader] = tag;
    const response: Response = await this.followAsync(url, { headers }, signal);
    if (response.status === Resources.notModifiedStatus && cached !== undefined)
      return this.reuse(url, cached, now, token);
    if (response.status === Resources.notFoundStatus) {
      await GitHubApi.dropBodyAsync(response);
      return null;
    }
    const body: string = await GitHubApi.bodyOf(response, signal);
    const reader: JsonReader = GitHubApi.readerOf(body);
    this.keep(url, new CachedAnswer(response.headers.get(Resources.tagHeader), body, now), token);
    return reader;
  }

  public async postAsync(host: string, path: string, token: string, body: Readonly<Record<string, string | boolean>>, signal: AbortSignal): Promise<JsonReader> {
    const response: Response = await this.fetchAsync(Resources.formatApiUrl(host) + path, {
      method: Resources.postMethod,
      headers: { ...GitHubApi.headersOf(token), [Resources.contentTypeHeader]: Resources.jsonType },
      body: JSON.stringify(body)
    }, signal);
    if (response.status === Resources.notFoundStatus) {
      await GitHubApi.dropBodyAsync(response);
      throw GitHubApi.failure(FailureCode.NotFound, Resources.notFoundMessage);
    }
    if (response.status === Resources.unprocessableStatus) {
      await GitHubApi.dropBodyAsync(response);
      throw GitHubApi.failure(FailureCode.Conflict, Resources.refusedPullRequestMessage);
    }
    return GitHubApi.readerOf(await GitHubApi.bodyOf(response, signal));
  }

  public keepOnly(isHeld: (token: string) => boolean): void {
    for (const token of [...this.answers.keys()]) {
      if (!isHeld(token))
        this.answers.delete(token);
    }
  }

  public static isAnswered(error: unknown): boolean {
    return error instanceof MethodFailureException && !(error instanceof GitHubUnreachableException);
  }

  public static isUnauthorized(error: unknown): boolean {
    return error instanceof MethodFailureException && error.failure.code === FailureCode.Unauthorized;
  }

  public static failure(code: FailureCode, message: string): MethodFailureException {
    return new MethodFailureException(new Failure(code, message));
  }

  public static read<T>(read: () => T): T {
    try {
      return read();
    }
    catch (error) {
      if (error instanceof SyntaxError || error instanceof JsonException || error instanceof HostingProtocolException)
        throw GitHubApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
      throw error;
    }
  }

  private reuse(url: string, cached: CachedAnswer, readAt: number, token: string): JsonReader {
    this.keep(url, cached.readAgainAt(readAt), token);
    return GitHubApi.readerOf(cached.body);
  }

  private keep(url: string, answer: CachedAnswer, token: string): void {
    const answers: Map<string, CachedAnswer> | undefined = this.answers.get(token);
    if (answers === undefined)
      return;
    answers.delete(url);
    if (answer.body.length > Resources.maximumKeptLength)
      return;
    answers.set(url, answer);
    for (const oldest of answers.keys()) {
      if (answers.size <= Resources.cacheSize)
        break;
      answers.delete(oldest);
    }
  }

  private async fetchAsync(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(url, { ...init, redirect: Resources.manualRedirect, signal: AbortSignal.any([signal, AbortSignal.timeout(Resources.requestTimeout)]) });
    }
    catch (error) {
      throw GitHubApi.unreachable(error, signal);
    }
    signal.throwIfAborted();
    if (response.status === Resources.unauthorizedStatus) {
      await GitHubApi.dropBodyAsync(response);
      throw GitHubApi.failure(FailureCode.Unauthorized, Resources.signedOutMessage);
    }
    return response;
  }

  private async followAsync(first: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    let url: string = first;
    for (let hop: number = 0; hop <= Resources.apiRedirects; hop++) {
      const response: Response = await this.fetchAsync(url, init, signal);
      if (!Resources.redirectStatuses.includes(response.status))
        return response;
      await GitHubApi.dropBodyAsync(response);
      const next: URL | null = GitHubApi.apiUrlOf(response.headers.get(Resources.locationHeader), url);
      if (next === null)
        break;
      url = next.href;
    }
    throw GitHubApi.failure(FailureCode.Unavailable, Resources.movedMessage);
  }

  private static apiUrlOf(address: string | null, base: string): URL | null {
    const url: URL | null = address === null ? null : URL.parse(address, base);
    return url !== null && url.origin === new URL(base).origin && url.username.length === 0 && url.password.length === 0 ? url : null;
  }

  private static headersOf(token: string): Record<string, string> {
    return {
      [Resources.acceptHeader]: Resources.gitHubJsonType, [Resources.authorizationHeader]: Resources.formatBearer(token), [Resources.userAgentHeader]: Resources.userAgent,
      [Resources.apiVersionHeader]: Resources.apiVersion
    };
  }

  private static async bodyOf(response: Response, signal: AbortSignal): Promise<string> {
    if (GitHubApi.isRateLimited(response)) {
      await GitHubApi.dropBodyAsync(response);
      throw GitHubApi.rateLimited(response.headers.get(Resources.rateLimitResetHeader));
    }
    if (Resources.redirectStatuses.includes(response.status)) {
      await GitHubApi.dropBodyAsync(response);
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.movedMessage);
    }
    if (!response.ok) {
      await GitHubApi.dropBodyAsync(response);
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.formatRefusedRequest(response.status));
    }
    let body: string | null;
    try {
      body = await AnswerText.readAsync(response, Resources.maximumAnswerBytes);
    }
    catch (error) {
      throw GitHubApi.unreachable(error, signal);
    }
    signal.throwIfAborted();
    if (body === null)
      throw GitHubApi.failure(FailureCode.Unavailable, Resources.answerTooLargeMessage);
    return body;
  }

  private static async dropBodyAsync(response: Response): Promise<void> {
    await response.body?.cancel();
  }

  private static unreachable(error: unknown, signal: AbortSignal): unknown {
    if (signal.aborted)
      return signal.reason;
    if (error instanceof DOMException && error.name === Resources.timeoutErrorName)
      return new GitHubUnreachableException(FailureCode.DeadlineExceeded);
    if (error instanceof TypeError)
      return new GitHubUnreachableException(FailureCode.Unavailable);
    return error;
  }

  private static isRateLimited(response: Response): boolean {
    return response.status === Resources.tooManyRequestsStatus
      || response.status === Resources.forbiddenStatus && response.headers.get(Resources.rateLimitRemainingHeader) === Resources.noneRemaining;
  }

  private static rateLimited(reset: string | null): MethodFailureException {
    const seconds: number = Number(reset ?? "");
    if (!Number.isSafeInteger(seconds) || seconds <= 0)
      return GitHubApi.failure(FailureCode.Unavailable, Resources.rateLimitedMessage);
    const until: number = seconds * Resources.millisecondsPerSecond;
    return new MethodFailureException(new Failure(FailureCode.Unavailable, Resources.formatRateLimited(new Date(until).toISOString()),
      { [HostingNames.rateLimitedUntilDetail]: until }));
  }

  private static readerOf(body: string): JsonReader {
    return GitHubApi.read(() => {
      const value: unknown = JSON.parse(body);
      return JsonReader.fromValue(Array.isArray(value) ? { [Resources.itemsField]: value } : value);
    });
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException, JsonReader, type JsonValue } from "@noldova/context.json";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { HostingArgumentException, HostingFieldException } from "@noldova/git.hosting.protocol";

import type { IRequestWrite } from "../interfaces/i-request-write.ts";
import type { AzureCredential } from "../models/azure-credential.ts";
import { Resources } from "../resources.ts";
import type { Fetcher } from "../types/fetcher.ts";

export class AzureApi {
  private readonly fetcher: Fetcher;

  public constructor(fetcher: Fetcher) {
    this.fetcher = fetcher;
  }

  public getAsync(url: string, token: AzureCredential, signal: AbortSignal): Promise<JsonReader | null> {
    return this.sendAsync(url, token, {}, signal);
  }

  public postAsync(url: string, token: AzureCredential, body: JsonValue, signal: AbortSignal): Promise<JsonReader | null> {
    return this.sendAsync(url, token, { method: Resources.postMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonType }, body: JSON.stringify(body) },
      signal);
  }

  public createAsync(url: string, token: AzureCredential, body: JsonValue, signal: AbortSignal): Promise<JsonReader | null> {
    return this.sendAsync(url, token, { method: Resources.postMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonType }, body: JSON.stringify(body) },
      signal, true);
  }

  public patchAsync(url: string, token: AzureCredential, patch: JsonValue, signal: AbortSignal): Promise<JsonReader | null> {
    return this.sendAsync(url, token, { method: Resources.patchMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonPatchType }, body: JSON.stringify(patch) },
      signal, true);
  }

  public updateAsync(url: string, token: AzureCredential, body: JsonValue, signal: AbortSignal): Promise<JsonReader | null> {
    return this.sendAsync(url, token, { method: Resources.patchMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonType }, body: JSON.stringify(body) },
      signal, true);
  }

  public putAsync(url: string, token: AzureCredential, body: JsonValue, signal: AbortSignal): Promise<JsonReader | null> {
    return this.sendAsync(url, token, { method: Resources.putMethod, headers: { [Resources.contentTypeHeader]: Resources.jsonType }, body: JSON.stringify(body) },
      signal, true);
  }

  public async getSvgAsync(url: string, token: AzureCredential, signal: AbortSignal, dropped: (reason: string) => void): Promise<string | null> {
    const response: Response = await this.fetchAsync(url, token, {}, Resources.svgAccept, signal);
    if (Resources.signedOutStatuses.includes(response.status)) {
      await AzureApi.dropBodyAsync(response);
      throw AzureApi.failure(FailureCode.Unauthorized, Resources.signedOutMessage);
    }
    if (!response.ok) {
      await AzureApi.dropBodyAsync(response);
      dropped(Resources.formatIconRefused(response.status));
      return null;
    }
    let text: string | null;
    try {
      text = await AzureApi.readCappedAsync(response, Resources.maximumIconBytes);
    }
    catch (error) {
      throw AzureApi.unreachable(error, signal);
    }
    signal.throwIfAborted();
    if (Object.isNull(text) || !Resources.svgPattern.test(text)) {
      dropped(Object.isNull(text) ? Resources.iconTooLarge : Resources.iconNotSvg);
      return null;
    }
    return text;
  }

  private async fetchAsync(url: string, token: AzureCredential,
    write: IRequestWrite, accept: string,
    signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        ...write,
        headers: { ...write.headers, [Resources.acceptHeader]: accept, [Resources.authorizationHeader]: token.authorization },
        redirect: Resources.manualRedirect,
        signal: AbortSignal.any([signal, AbortSignal.timeout(Resources.requestTimeout)])
      });
    }
    catch (error) {
      throw AzureApi.unreachable(error, signal);
    }
    signal.throwIfAborted();
    return response;
  }

  private async sendAsync(url: string, token: AzureCredential, write: IRequestWrite,
    signal: AbortSignal, isWrite: boolean = false): Promise<JsonReader | null> {
    const response: Response = await this.fetchAsync(url, token, write, Resources.jsonType, signal);
    if (response.status === Resources.notFoundStatus) {
      await AzureApi.dropBodyAsync(response);
      return null;
    }
    if (response.status === Resources.preconditionFailedStatus) {
      await AzureApi.dropBodyAsync(response);
      throw AzureApi.failure(FailureCode.Conflict, Resources.itemChangedMessage);
    }
    if (Resources.signedOutStatuses.includes(response.status)) {
      await AzureApi.dropBodyAsync(response);
      throw AzureApi.failure(FailureCode.Unauthorized, Resources.signedOutMessage);
    }
    if (response.status === Resources.forbiddenStatus && isWrite)
      throw Resources.permissionAnswer.test(await AzureApi.textAsync(response, signal)) ? AzureApi.failure(FailureCode.Unavailable, Resources.noPermissionMessage)
        : AzureApi.failure(FailureCode.Unauthorized, Resources.signedOutMessage);
    if (!response.ok) {
      await AzureApi.dropBodyAsync(response);
      throw AzureApi.failure(FailureCode.Unavailable, response.status === Resources.tooManyRequestsStatus ? Resources.rateLimitedMessage
        : Resources.formatRefusedRequest(response.status));
    }
    const body: string = await AzureApi.textAsync(response, signal);
    return AzureApi.read(() => JsonReader.fromValue(JSON.parse(body)));
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
      if (error instanceof SyntaxError)
        throw AzureApi.failure(FailureCode.Unavailable, Resources.unreadableAnswerMessage);
      if (error instanceof JsonException)
        throw AzureApi.failure(FailureCode.Unavailable, Resources.formatUnreadableAnswer(error.path));
      if (error instanceof HostingFieldException)
        throw AzureApi.failure(FailureCode.Unavailable, Resources.formatUnreadableAnswer(error.field));
      if (error instanceof HostingArgumentException)
        throw AzureApi.failure(FailureCode.Unavailable, Resources.formatUnreadableAnswer(error.parameterName));
      throw error;
    }
  }

  public static async readCappedAsync(response: Response, maximum: number): Promise<string | null> {
    const chunks: Uint8Array[] = [];
    let size: number = 0;
    const reader: ReadableStreamDefaultReader<Uint8Array> = (response.body ?? new Blob().stream()).getReader();
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
      size += part.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  private static async textAsync(response: Response, signal: AbortSignal): Promise<string> {
    let text: string | null;
    try {
      text = await AzureApi.readCappedAsync(response, Resources.maximumAnswerBytes);
    }
    catch (error) {
      throw AzureApi.unreachable(error, signal);
    }
    signal.throwIfAborted();
    if (Object.isNull(text))
      throw AzureApi.failure(FailureCode.Unavailable, Resources.answerTooLargeMessage);
    return text;
  }

  private static async dropBodyAsync(response: Response): Promise<void> {
    await response.body?.cancel();
  }

  private static unreachable(error: unknown, signal: AbortSignal): unknown {
    if (signal.aborted)
      return signal.reason;
    if (error instanceof DOMException && error.name === Resources.timeoutErrorName)
      return AzureApi.failure(FailureCode.DeadlineExceeded, Resources.unreachableMessage);
    if (error instanceof TypeError)
      return AzureApi.failure(FailureCode.Unavailable, Resources.unreachableMessage);
    return error;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import type { Fetcher } from "../types/fetcher.ts";

export class GitHubAvatars {
  private readonly fetcher: Fetcher;
  private readonly log: IModuleLog;
  private readonly kept: Map<string, string> = new Map();

  public constructor(fetcher: Fetcher, log: IModuleLog) {
    this.fetcher = fetcher;
    this.log = log;
  }

  public async readAsync(address: string | null, signal: AbortSignal): Promise<string | null> {
    const url: URL | null = GitHubAvatars.avatarUrlOf(address, undefined);
    if (url === null)
      return null;
    url.searchParams.set(Resources.avatarSizeParameter, Resources.avatarSize);
    const avatar: string | null = this.kept.get(url.href) ?? await this.fetchWithinAsync(url, signal);
    if (avatar !== null)
      this.keep(url.href, avatar);
    return avatar;
  }

  private async fetchWithinAsync(first: URL, signal: AbortSignal): Promise<string | null> {
    const deadline: AbortController = new AbortController();
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => deadline.abort(), Resources.avatarDeadline);
    try {
      return await this.fetchAsync(first, signal, AbortSignal.any([signal, deadline.signal]));
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async fetchAsync(first: URL, signal: AbortSignal, within: AbortSignal): Promise<string | null> {
    let url: URL | null = first;
    for (let hop: number = 0; url !== null && hop <= Resources.avatarRedirects; hop++) {
      const response: Response | null = await this.askAsync(url, signal, within);
      if (response === null || !Resources.redirectStatuses.includes(response.status))
        return response === null ? null : this.dataOfAsync(response, signal, within);
      await response.body?.cancel();
      url = GitHubAvatars.avatarUrlOf(response.headers.get(Resources.locationHeader), url.href);
    }
    return this.drop(Resources.avatarRedirectedAway);
  }

  private async askAsync(url: URL, signal: AbortSignal, within: AbortSignal): Promise<Response | null> {
    try {
      return await this.fetcher(url.href, {
        headers: { [Resources.acceptHeader]: Resources.avatarAccept, [Resources.userAgentHeader]: Resources.userAgent },
        redirect: Resources.manualRedirect,
        signal: within
      });
    }
    catch (error) {
      return this.dropFailed(error, signal, within);
    }
  }

  private dropFailed(error: unknown, signal: AbortSignal, within: AbortSignal): null {
    signal.throwIfAborted();
    if (within.aborted)
      return this.drop(Resources.avatarTimedOut);
    if (error instanceof TypeError)
      return this.drop(String(error));
    throw error;
  }

  private drop(reason: string): null {
    this.log.write(Resources.formatAvatarDropped(reason));
    return null;
  }

  private keep(address: string, avatar: string): void {
    this.kept.delete(address);
    this.kept.set(address, avatar);
    for (const oldest of this.kept.keys()) {
      if (this.kept.size <= Resources.cacheSize)
        break;
      this.kept.delete(oldest);
    }
  }

  private static avatarUrlOf(address: string | null, base: string | undefined): URL | null {
    const url: URL | null = address === null ? null : URL.parse(address, base);
    return url !== null && url.protocol === Resources.httpsProtocol && url.host === Resources.avatarHost && url.username.length === 0
      && url.password.length === 0 ? url : null;
  }

  private async dataOfAsync(response: Response, signal: AbortSignal, within: AbortSignal): Promise<string | null> {
    const type: string = (response.headers.get(Resources.contentTypeHeader) ?? "").split(Resources.mediaTypeParameterSeparator, 1).join("").trim().toLowerCase();
    const body: ReadableStream<Uint8Array> | null = response.body;
    if (!response.ok || !Resources.avatarTypes.includes(type) || body === null) {
      await body?.cancel();
      return this.drop(response.ok ? Resources.avatarNotImage : Resources.formatAvatarRefused(response.status));
    }
    const bytes: Buffer | null = await this.bytesOfAsync(body, signal, within);
    return bytes === null ? null : Resources.formatDataUrl(type, bytes.toString(Resources.base64Encoding));
  }

  private async bytesOfAsync(body: ReadableStream<Uint8Array>, signal: AbortSignal, within: AbortSignal): Promise<Buffer | null> {
    const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader();
    const chunks: Uint8Array[] = [];
    let length: number = 0;
    try {
      for (let read = await reader.read(); !read.done; read = await reader.read()) {
        length += read.value.length;
        if (length > Resources.maximumAvatarBytes) {
          await reader.cancel();
          return this.drop(Resources.avatarTooLarge);
        }
        chunks.push(read.value);
      }
    }
    catch (error) {
      return this.dropFailed(error, signal, within);
    }
    return length === 0 ? this.drop(Resources.avatarEmpty) : Buffer.concat(chunks);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";

import type { IModuleLog } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Reads an author's picture from Gravatar by their email's SHA-256, asking for none rather than Gravatar's stand-in picture. */
export class GravatarReader {
  private readonly fetcher: Fetcher;
  private readonly log: IModuleLog;
  private readonly kept: Map<string, string | null> = new Map();

  public constructor(fetcher: Fetcher, log: IModuleLog) {
    this.fetcher = fetcher;
    this.log = log;
  }

  /** The picture as a data address, or null when Gravatar has none or the read fails; a picture or a "none" is kept, a failure asked again next time. */
  public async readAsync(email: string, signal: AbortSignal): Promise<string | null> {
    const hash: string = createHash(Resources.digestAlgorithm).update(email.trim().toLowerCase()).digest(Resources.hexEncoding);
    const kept: string | null | undefined = this.kept.get(hash);
    if (kept !== undefined)
      return kept;
    const url = new URL(Resources.gravatarAddress + hash);
    url.searchParams.set(Resources.gravatarSizeParameter, Resources.gravatarSize);
    url.searchParams.set(Resources.gravatarDefaultParameter, Resources.gravatarNoDefault);
    const read: string | null | undefined = await this.readWithinAsync(url, signal);
    if (read === undefined)
      return null;
    this.keep(hash, read);
    return read;
  }

  private async readWithinAsync(url: URL, signal: AbortSignal): Promise<string | null | undefined> {
    const deadline: AbortController = new AbortController();
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => deadline.abort(), Resources.gravatarDeadline);
    const within: AbortSignal = AbortSignal.any([signal, deadline.signal]);
    try {
      const response: Response = await this.fetcher(url.href, {
        headers: { [Resources.acceptHeader]: Resources.gravatarAccept, [Resources.userAgentHeader]: Resources.gravatarUserAgent },
        redirect: Resources.refuseRedirect,
        signal: within
      });
      return await this.imageOfAsync(response);
    }
    catch (error) {
      signal.throwIfAborted();
      if (within.aborted)
        return this.drop(Resources.gravatarTimedOut);
      if (error instanceof TypeError)
        return this.drop(String(error));
      throw error;
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async imageOfAsync(response: Response): Promise<string | null | undefined> {
    const type: string = (response.headers.get(Resources.contentTypeHeader) ?? "").split(Resources.mediaTypeParameterSeparator, 1).join("").trim().toLowerCase();
    const body: ReadableStream<Uint8Array> | null = response.body;
    if (response.status === Resources.notFoundStatus || !response.ok || !Resources.gravatarTypes.includes(type) || body === null) {
      await body?.cancel();
      if (response.status === Resources.notFoundStatus)
        return null;
      return this.drop(response.ok ? Resources.gravatarNotImage : Resources.formatGravatarRefused(response.status));
    }
    const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader();
    const chunks: Uint8Array[] = [];
    let length: number = 0;
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      length += read.value.length;
      if (length > Resources.maximumGravatarBytes) {
        await reader.cancel();
        return this.drop(Resources.gravatarTooLarge);
      }
      chunks.push(read.value);
    }
    return length === 0 ? this.drop(Resources.gravatarEmpty) : Resources.formatDataAddress(type, Buffer.concat(chunks).toString(Resources.base64Encoding));
  }

  private drop(reason: string): undefined {
    this.log.write(Resources.formatGravatarDropped(reason));
    return undefined;
  }

  private keep(hash: string, image: string | null): void {
    this.kept.delete(hash);
    this.kept.set(hash, image);
    for (const oldest of this.kept.keys()) {
      if (this.kept.size <= Resources.gravatarCacheSize)
        break;
      this.kept.delete(oldest);
    }
  }
}

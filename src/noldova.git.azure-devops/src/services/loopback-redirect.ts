/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import "@noldova/context.core";

import { RedirectAnswer } from "../models/redirect-answer.ts";
import { Resources } from "../resources.ts";

export class LoopbackRedirect {
  private readonly server: Server;
  private readonly state: string;
  private readonly answer: PromiseWithResolvers<RedirectAnswer> = Promise.withResolvers<RedirectAnswer>();
  private port: number = 0;

  private constructor(state: string) {
    this.state = state;
    this.server = createServer((request, response) => this.handle(request, response));
  }

  public get redirectUri(): string {
    return Resources.formatRedirectUri(this.port);
  }

  public get answered(): Promise<RedirectAnswer> {
    return this.answer.promise;
  }

  public static async openAsync(state: string): Promise<LoopbackRedirect> {
    const redirect = new LoopbackRedirect(state);
    await new Promise<void>((resolve, reject) => {
      redirect.server.once(Resources.errorEvent, reject);
      redirect.server.listen(0, Resources.loopbackAddress, resolve);
    });
    const address: AddressInfo | string | null = redirect.server.address();
    if (Object.isNull(address) || Object.isString(address)) {
      redirect.close();
      throw new Error(Resources.loopbackPortUnknownMessage);
    }
    redirect.port = address.port;
    return redirect;
  }

  public close(): void {
    this.server.close();
    this.server.closeAllConnections();
  }

  private isState(state: string | null): boolean {
    const given = Buffer.from(state ?? Resources.emptyText);
    const expected = Buffer.from(this.state);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  private handle(request: IncomingMessage, response: ServerResponse): void {
    const address = URL.parse(String(request.url), this.redirectUri);
    if (Object.isNull(address) || request.method !== Resources.getMethod || address.pathname !== Resources.rootPath
      || !this.isState(address.searchParams.get(Resources.stateParameter))) {
      response.writeHead(Resources.notFoundStatus, Resources.redirectHeaders).end();
      return;
    }
    const code = address.searchParams.get(Resources.codeParameter);
    const error = address.searchParams.get(Resources.errorParameter);
    if (Object.isNull(code) && Object.isNull(error)) {
      response.writeHead(Resources.notFoundStatus, Resources.redirectHeaders).end();
      return;
    }
    response.writeHead(Resources.okStatus, Resources.redirectHeaders).end(Object.isNull(code) ? Resources.redirectNotSignedIn : Resources.redirectSignedIn);
    this.answer.resolve(new RedirectAnswer(code, error));
    this.close();
  }
}

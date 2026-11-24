/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { request, Server } from "node:http";
import { Server as NetServer } from "node:net";

import { afterEach, describe, it, vi } from "vitest";

import { RedirectAnswer } from "../../src/models/redirect-answer.ts";
import { LoopbackRedirect } from "../../src/services/loopback-redirect.ts";

describe("LoopbackRedirect", () => {
  const state: string = "s".repeat(43);
  const opened: LoopbackRedirect[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const redirect of opened.splice(0))
      redirect.close();
  });

  function sendRaw(redirectUri: string, path: string): Promise<number> {
    const address = new URL(redirectUri);
    return new Promise<number>((resolve, reject) => {
      request({ host: address.hostname, port: address.port, path }, response => {
        response.resume();
        resolve(Number(response.statusCode));
      }).once("error", reject).end();
    });
  }

  it("redirects to 127.0.0.1 at the port it listens on, answers 404 to a target that isn't an address, and still takes the browser's answer after it", async () => {
    const redirect = await LoopbackRedirect.openAsync(state);
    opened.push(redirect);

    const status: number = await sendRaw(redirect.redirectUri, "//[");
    const page: Response = await fetch(`${redirect.redirectUri}/?state=${state}&code=code-1`);

    assert.match(redirect.redirectUri, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.deepEqual([status, page.status, await redirect.answered], [404, 200, new RedirectAnswer("code-1", null)]);
  });

  it.each([null, "/tmp/fabrikam.sock"])("fails the sign-in and stops listening when the listener answers %j for its address", async address => {
    const closed = vi.spyOn(Server.prototype, "close");
    vi.spyOn(NetServer.prototype, "address").mockReturnValue(address);

    const failure: unknown = await LoopbackRedirect.openAsync(state).then(() => null, (error: unknown) => error);

    assert.deepEqual([failure instanceof Error ? failure.message : failure, closed.mock.calls.length],
      ["The sign-in's listener on this computer has no port to give the browser.", 1]);
  });
});

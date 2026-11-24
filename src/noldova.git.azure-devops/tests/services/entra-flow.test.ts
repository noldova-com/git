/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { EntraGrant } from "../../src/models/entra-grant.ts";
import { EntraFlow } from "../../src/services/entra-flow.ts";
import { FakeAzure } from "../fixtures/fake-azure.fixture.ts";

const signal: AbortSignal = new AbortController().signal;

async function failureOf(work: Promise<unknown>): Promise<readonly [string, string] | unknown> {
  try {
    return await work;
  }
  catch (error) {
    return error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : error;
  }
}

describe("EntraFlow", () => {
  it("makes a fresh secret of 32 random bytes each time, written base64url", () => {
    const secrets: readonly string[] = [EntraFlow.createSecret(), EntraFlow.createSecret()];

    assert.deepEqual(secrets.map(t => /^[A-Za-z0-9_-]{43}$/.test(t)), [true, true]);
    assert.notEqual(secrets[0], secrets[1]);
  });

  it("answers the access token, the refresh token and the time to expiry in milliseconds, and null for a grant Microsoft refuses", async () => {
    const azure = new FakeAzure();
    const flow = new EntraFlow(azure.fetch);
    azure.answer(FakeAzure.json({ access_token: "access-1", refresh_token: "refresh-2", expires_in: 3599 }),
      ...["invalid_grant", "interaction_required", "consent_required"].map(t => FakeAzure.json({ error: t }, 400)));

    const answers: (EntraGrant | null)[] = [await flow.refreshAsync("refresh-1", signal)];
    for (let index = 0; index < 3; index++)
      answers.push(await flow.redeemAsync("code-1", "http://127.0.0.1:50123", "verifier", signal));

    assert.deepEqual(answers, [new EntraGrant("access-1", "refresh-2", 3_599_000), null, null, null]);
    assert.equal(azure.requests[0]?.init.redirect, "manual");
  });

  it("fails as Unavailable for another refusal, an unreadable answer, no network or a timeout, and passes on the caller's cancel", async () => {
    const azure = new FakeAzure();
    const flow = new EntraFlow(azure.fetch);
    const cancel = new AbortController();
    azure.answer(FakeAzure.json({ error: "invalid_request" }, 400), FakeAzure.json({ error: " " }, 400), FakeAzure.json({ access_token: "access-1" }));
    azure.fail(new TypeError("fetch failed"));
    azure.fail(new DOMException("The operation timed out.", "TimeoutError"));
    azure.fail(new DOMException("Aborted.", "AbortError"));
    azure.hold();

    const failures: unknown[] = [];
    for (let index = 0; index < 6; index++)
      failures.push(await failureOf(flow.refreshAsync("refresh-1", signal)));
    const cancelled = failureOf(flow.refreshAsync("refresh-1", cancel.signal));
    cancel.abort(new Error("Stopped."));

    assert.deepEqual(failures, [[FailureCode.Unavailable, "Microsoft's sign-in refused the request (400)."],
      [FailureCode.Unavailable, "Microsoft's sign-in refused the request (400)."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.refresh_token."],
      [FailureCode.Unavailable, "Microsoft's sign-in couldn't be reached."], [FailureCode.Unavailable, "Microsoft's sign-in couldn't be reached."], new DOMException("Aborted.", "AbortError")]);
    assert.deepEqual(await cancelled, new Error("Stopped."));
  });

  it("reads a token answer of up to 1 MiB, an empty one too, and fails the sign-in as Unavailable once one passes that, whatever its status, without reading the rest",
    async () => {
      const mebibyte: number = 1024 * 1024;
      const atCap: Uint8Array<ArrayBuffer> = new Uint8Array(mebibyte).fill(0x20);
      atCap.set(new TextEncoder().encode(JSON.stringify({ access_token: "access-1", refresh_token: "refresh-2", expires_in: 3599 })));
      const quarter: Uint8Array = new Uint8Array(mebibyte / 4).fill(0x20);
      const pulls: number[] = [0, 0];
      const cancelled: boolean[] = [false, false];
      const endless = (index: number): ReadableStream<Uint8Array> => new ReadableStream<Uint8Array>({
        pull: controller => {
          pulls[index] = (pulls[index] ?? 0) + 1;
          controller.enqueue(quarter);
        },
        cancel: () => {
          cancelled[index] = true;
        }
      }, { highWaterMark: 0 });
      const azure = new FakeAzure();
      azure.answer(new Response(atCap), new Response(null, { status: 400 }), new Response(endless(0)), new Response(endless(1), { status: 400 }));
      const flow = new EntraFlow(azure.fetch);

      const read: unknown = await flow.refreshAsync("refresh-1", signal);
      const empty: unknown = await failureOf(flow.refreshAsync("refresh-1", signal));
      const tooLarge: unknown[] = [await failureOf(flow.refreshAsync("refresh-1", signal)), await failureOf(flow.refreshAsync("refresh-1", signal))];

      assert.deepEqual([read, empty, tooLarge, pulls, cancelled], [new EntraGrant("access-1", "refresh-2", 3_599_000),
        [FailureCode.Unavailable, "Microsoft's sign-in refused the request (400)."],
        [[FailureCode.Unavailable, "Microsoft's sign-in answer is larger than the module reads."], [FailureCode.Unavailable, "Microsoft's sign-in answer is larger than the module reads."]],
        [5, 5], [true, true]]);
    });

  it("renews with the scopes granted before replies and votes when Microsoft asks for consent, answering a grant that can't write code", async () => {
    const azure = new FakeAzure();
    const flow = new EntraFlow(azure.fetch);
    azure.answer(FakeAzure.json({ error: "invalid_grant", suberror: "consent_required" }, 400),
      FakeAzure.json({ access_token: "access-1", refresh_token: "refresh-2", expires_in: 3599 }), FakeAzure.json({ error: "consent_required" }, 400),
      FakeAzure.json({ error: "invalid_grant" }, 400), FakeAzure.json({ error: "invalid_grant", suberror: "consent_required" }, 400));

    const answers: (EntraGrant | null)[] = [await flow.refreshAsync("refresh-1", signal), await flow.refreshAsync("refresh-1", signal),
      await flow.redeemAsync("code-1", "http://127.0.0.1:50123", "verifier", signal)];

    const scopes: (string | null)[] = azure.requests.map(t => new URLSearchParams(String(t.init.body)).get("scope"));
    const all: string = ["vso.code", "vso.code_write", "vso.work_write", "vso.graph"].map(t => `499b84ac-1321-427f-aa17-267ca6975798/${t}`).concat("offline_access")
      .join(" ");
    const earlier: string = ["vso.code", "vso.work_write", "vso.graph"].map(t => `499b84ac-1321-427f-aa17-267ca6975798/${t}`).concat("offline_access").join(" ");
    assert.deepEqual(answers, [new EntraGrant("access-1", "refresh-2", 3_599_000, false), null, null]);
    assert.deepEqual(scopes, [all, earlier, all, earlier, all]);
  });
});

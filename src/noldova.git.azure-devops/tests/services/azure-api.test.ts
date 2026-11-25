/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonReader } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { HostingArgumentException, HostingFieldException } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { AzureCredential } from "../../src/models/azure-credential.ts";
import { AzureApi } from "../../src/services/azure-api.ts";
import { FakeAzure } from "../fixtures/fake-azure.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const url: string = "https://dev.azure.com/fabrikam/_apis/git/repositories/3411ebc1-d5aa-464f-9615-0b527bc66719/pullrequests/12?api-version=7.1";

function failureOf(error: unknown): readonly [string, string] | null {
  return error instanceof MethodFailureException ? [error.failure.code, error.failure.message] : null;
}

const token: AzureCredential = AzureCredential.ofToken("azure-token");

describe("AzureApi", () => {
  it("asks with the token as a personal access token's basic authorization, follows no redirect, and answers the JSON it reads", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ pullRequestId: 12 }));
    const api = new AzureApi(azure.fetch);

    const answer = await api.getAsync(url, token, signal);

    assert.deepEqual([answer?.toJson(), azure.urls()], [{ pullRequestId: 12 }, [url]]);
    assert.deepEqual([azure.requests[0]?.header("Authorization"), azure.requests[0]?.header("Accept"), azure.requests[0]?.init.redirect],
      [`Basic ${Buffer.from(":azure-token").toString("base64")}`, "application/json", "manual"]);
  });

  it("posts a JSON body with the token and answers the JSON it reads", async () => {
    const azure = new FakeAzure();
    azure.answer(FakeAzure.json({ workItems: [] }));
    const api = new AzureApi(azure.fetch);

    const answer = await api.postAsync(url, token, { query: "SELECT [System.Id] FROM WorkItems" }, signal);

    const post = azure.requests[0];
    assert.deepEqual([answer?.toJson(), post?.init.method, post?.header("Content-Type"), post?.header("Accept"), post?.header("Authorization"), post?.body],
      [{ workItems: [] }, "POST", "application/json", "application/json", `Basic ${Buffer.from(":azure-token").toString("base64")}`,
        { query: "SELECT [System.Id] FROM WorkItems" }]);
  });

  it("answers null for what Azure DevOps can't show, Conflict for a failed patch test, and lets go of each answer's body it doesn't read", async () => {
    const azure = new FakeAzure();
    const statuses: readonly number[] = [404, 401, 203, 302, 412, 429, 500];
    const dropped: number[] = [];
    const answers: Response[] = statuses.map(t => new Response(new ReadableStream<Uint8Array>({ cancel: () => void dropped.push(t) }), { status: t }));
    azure.answer(...answers);
    const api = new AzureApi(azure.fetch);

    const read: unknown[] = [];
    for (let index = 0; index < answers.length; index++)
      read.push(await api.getAsync(url, token, signal).then(t => t, (error: unknown) => failureOf(error)));

    assert.deepEqual(read, [null, [FailureCode.Unauthorized, "Sign in to Azure DevOps first."], [FailureCode.Unauthorized, "Sign in to Azure DevOps first."],
      [FailureCode.Unauthorized, "Sign in to Azure DevOps first."],
      [FailureCode.Conflict, "The work item changed in Azure DevOps since it was read, so nothing was written."],
      [FailureCode.Unavailable, "Azure DevOps is limiting this account's requests; try again later."],
      [FailureCode.Unavailable, "Azure DevOps refused the request (500)."]]);
    assert.deepEqual(dropped, statuses);
  });

  it("names the refused field's path in an unreadable answer's failure, never its value, and none for an answer that isn't JSON or isn't an object", () => {
    const reader: JsonReader = JsonReader.fromValue({ changeEntries: [{ item: { path: "/a.ts" } }, { item: { path: 7 } }] });
    const broken: TypeError = new TypeError("broken");
    const reads: readonly (() => unknown)[] = [
      () => reader.readObjectArray("changeEntries").map(t => t.readObject("item").readString("path")),
      () => JsonReader.fromValue(null),
      () => JSON.parse("<html>"),
      () => {
        throw new HostingFieldException("$.files.0.path", "text that isn't blank");
      },
      () => {
        throw new HostingArgumentException("sourceCommit", "a commit id");
      },
      () => {
        throw broken;
      }
    ];

    const failures: unknown[] = reads.map(read => {
      try {
        return AzureApi.read(read);
      }
      catch (error) {
        return failureOf(error) ?? error;
      }
    });

    assert.deepEqual(failures, [[FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.changeEntries.1.item.path."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at $.files.0.path."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read at sourceCommit."], broken]);
  });

  it("fails as Unavailable for an unreadable or empty answer or no network, and DeadlineExceeded for a timeout", async () => {
    const azure = new FakeAzure();
    azure.answer(new Response("<html>"), new Response("null"));
    azure.fail(new TypeError("fetch failed"));
    azure.fail(new DOMException("The operation timed out.", "TimeoutError"));
    azure.answer(new Response(null, { status: 200 }));
    const api = new AzureApi(azure.fetch);

    const failures: unknown[] = [];
    for (let index = 0; index < 5; index++)
      failures.push(await api.getAsync(url, token, signal).then(() => null, (error: unknown) => failureOf(error)));

    assert.deepEqual(failures, [[FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."], [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."],
      [FailureCode.Unavailable, "Azure DevOps couldn't be reached."], [FailureCode.DeadlineExceeded, "Azure DevOps couldn't be reached."],
      [FailureCode.Unavailable, "Azure DevOps' answer couldn't be read."]]);
  });

  it("passes on a failure that is neither the network's nor the answer's, and the caller's cancel as it is", async () => {
    const azure = new FakeAzure();
    const unexpected = new RangeError("Unexpected.");
    azure.fail(unexpected);
    const release = azure.hold();
    const api = new AzureApi(azure.fetch);
    const waiting = new AbortController();

    const failed: unknown = await api.getAsync(url, token, signal).then(() => null, (error: unknown) => error);
    const cancelled = api.getAsync(url, token, waiting.signal).then(() => null, (error: unknown) => error);
    waiting.abort(new Error("Stopped."));
    release(FakeAzure.json({}));

    assert.deepEqual([failed, String(await cancelled)], [unexpected, "Error: Stopped."]);
    assert.throws(() => AzureApi.read(() => {
      throw unexpected;
    }), unexpected);
  });

  it("fails as Unavailable when an answer breaks off while it is read, and ends with the caller's reason when the caller stops it then", async () => {
    const broken = new Response(new ReadableStream<Uint8Array>({ pull: controller => controller.error(new TypeError("terminated")) }));
    const reading = new AbortController();
    const stoppedBody = new ReadableStream<Uint8Array>({
      pull: controller => {
        reading.abort(new Error("Stopped while reading."));
        controller.error(new TypeError("terminated"));
      }
    }, { highWaterMark: 0 });
    const azure = new FakeAzure();
    azure.answer(broken, new Response(stoppedBody));
    const api = new AzureApi(azure.fetch);

    const terminated: unknown = await api.getAsync(url, token, signal).then(() => null, (error: unknown) => failureOf(error));
    const stopped: unknown = await api.getAsync(url, token, reading.signal).then(() => null, (error: unknown) => error);

    assert.deepEqual([terminated, stopped], [[FailureCode.Unavailable, "Azure DevOps couldn't be reached."], new Error("Stopped while reading.")]);
  });

  it("reads an answer of up to 32 MiB, and fails as Unavailable once one passes that, without reading the rest", async () => {
    const mebibyte: number = 1024 * 1024;
    const atCap: Uint8Array<ArrayBuffer> = new Uint8Array(32 * mebibyte).fill(0x20);
    atCap.set(new TextEncoder().encode("{}"), atCap.length - 2);
    const spaces: Uint8Array = new Uint8Array(mebibyte).fill(0x20);
    let pulls: number = 0;
    let isCancelled: boolean = false;
    const endless = new ReadableStream<Uint8Array>({
      pull: controller => {
        pulls += 1;
        controller.enqueue(spaces);
      },
      cancel: () => {
        isCancelled = true;
      }
    }, { highWaterMark: 0 });
    const azure = new FakeAzure();
    azure.answer(new Response(atCap), new Response(endless));
    const api = new AzureApi(azure.fetch);

    const read: unknown = (await api.getAsync(url, token, signal))?.toJson();
    const tooLarge: unknown = await api.getAsync(url, token, signal).then(() => null, (error: unknown) => failureOf(error));

    assert.deepEqual([read, tooLarge, pulls, isCancelled], [{}, [FailureCode.Unavailable, "Azure DevOps' answer is larger than the module reads."], 33, true]);
  });

  it("takes a refused write for a token that can't make it, unless Azure DevOps names a missing permission, and a refused read as it is, a posted one too", async () => {
    const azure = new FakeAzure();
    const denied = (): Response => FakeAzure.json({ message: "Access denied." }, 403);
    azure.answer(FakeAzure.json({ message: "TF401027: You need the Git 'PullRequestContribute' permission to perform this action.",
      typeKey: "GitNeedsPermissionException" }, 403), denied(), denied(), denied(), denied(), new Response(null, { status: 403 }), denied());
    const api = new AzureApi(azure.fetch);
    const failed = (written: Promise<unknown>): Promise<unknown> => written.then(() => null, (error: unknown) => failureOf(error));

    const failures: unknown[] = [await failed(api.putAsync(url, token, { vote: 10 }, signal)), await failed(api.putAsync(url, token, { vote: 10 }, signal)),
      await failed(api.createAsync(url, token, { content: "Done." }, signal)), await failed(api.updateAsync(url, token, { status: "fixed" }, signal)),
      await failed(api.patchAsync(url, token, [], signal)), await failed(api.getAsync(url, token, signal)),
      await failed(api.postAsync(url, token, { query: "SELECT [System.Id] FROM WorkItems" }, signal))];

    const signedOut = [FailureCode.Unauthorized, "Sign in to Azure DevOps first."];
    const refused = [FailureCode.Unavailable, "Azure DevOps refused the request (403)."];
    assert.deepEqual(failures, [[FailureCode.Unavailable, "Azure DevOps says this account lacks the permission for this in the repository; ask one of its administrators."],
      signedOut, signedOut, signedOut, signedOut, refused, refused]);
    assert.deepEqual(azure.requests.map(t => t.init.method), ["PUT", "PUT", "POST", "PATCH", "PATCH", undefined, "POST"]);
  });

  it("asks for an SVG image with the token and answers its markup, an XML declaration before it too", async () => {
    const svg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#CC293D" d="M2 2h12v12H2z"/></svg>';
    const declared: string = `<?xml version="1.0" encoding="utf-8"?>\n${svg}`;
    const azure = new FakeAzure();
    azure.answer(new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } }),
      new Response(declared, { headers: { "Content-Type": "image/svg+xml" } }));
    const api = new AzureApi(azure.fetch);

    const answers = [await api.getSvgAsync(url, token, signal, () => undefined), await api.getSvgAsync(url, token, signal, () => undefined)];

    assert.deepEqual([answers, azure.requests[0]?.header("Accept"), azure.requests[0]?.header("Authorization"), azure.requests[0]?.init.redirect],
      [[svg, declared], "image/svg+xml, */*;q=0.8", `Basic ${Buffer.from(":azure-token").toString("base64")}`, "manual"]);
  });

  it("takes SVG by its text whatever type Azure DevOps names, and answers none, saying why, for a refused or missing one, text that isn't SVG or more than 64 KiB",
    async () => {
    const svg: string = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const dropped: number[] = [];
    const unread = (status: number, type: string): Response =>
      new Response(new ReadableStream<Uint8Array>({ cancel: () => void dropped.push(status) }), { status, headers: { "Content-Type": type } });
    const azure = new FakeAzure();
    azure.answer(unread(404, "image/svg+xml"), unread(500, "image/svg+xml"), new Response(svg, { headers: { "Content-Type": "application/octet-stream" } }),
      new Response(svg), new Response("<html></html>", { headers: { "Content-Type": "image/svg+xml" } }),
      new Response(`${svg}${" ".repeat(65_536)}`, { headers: { "Content-Type": "image/svg+xml" } }));
    const api = new AzureApi(azure.fetch);
    const reasons: string[] = [];

    const answers: (string | null)[] = [];
    for (let attempt = 0; attempt < 6; attempt++)
      answers.push(await api.getSvgAsync(url, token, signal, t => reasons.push(t)));

    assert.deepEqual([answers, dropped], [[null, null, svg, svg, null, null], [404, 500]]);
    assert.deepEqual(reasons, ["Azure DevOps answered 404", "Azure DevOps answered 500", "it isn't SVG", "it's larger than 64 KiB"]);
  });

  it("fails as signed out for a refused token, as Unavailable without a network or when the image breaks off, and with the caller's reason when stopped", async () => {
    const stopping = new AbortController();
    const azure = new FakeAzure();
    azure.answer(new Response(null, { status: 401 }), new Response(new ReadableStream<Uint8Array>({ pull: controller => controller.error(new TypeError("terminated")) }),
      { headers: { "Content-Type": "image/svg+xml" } }));
    azure.fail(new TypeError("fetch failed"));
    azure.answer(new Response(new ReadableStream<Uint8Array>({
      pull: controller => {
        stopping.abort(new Error("Stopped while reading."));
        controller.error(new TypeError("terminated"));
      }
    }, { highWaterMark: 0 }), { headers: { "Content-Type": "image/svg+xml" } }));
    const api = new AzureApi(azure.fetch);

    const failures: unknown[] = [];
    for (const at of [signal, signal, signal, stopping.signal])
      failures.push(await api.getSvgAsync(url, token, at, () => undefined).then(() => null, (error: unknown) => failureOf(error) ?? error));

    assert.deepEqual(failures, [[FailureCode.Unauthorized, "Sign in to Azure DevOps first."], [FailureCode.Unavailable,
      "Azure DevOps couldn't be reached."], [FailureCode.Unavailable, "Azure DevOps couldn't be reached."], new Error("Stopped while reading.")]);
  });
});

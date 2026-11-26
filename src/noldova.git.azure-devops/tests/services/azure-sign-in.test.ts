/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { JsonReader } from "@noldova/context.json";
import { SecretFailureReason } from "@noldova/desktop.protocol";
import { FakeAppWindows, FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { HostAccount, HostSignIn, type HostWorkItem, SignInFailure, WorkItemQuery } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { AzureCredential } from "../../src/models/azure-credential.ts";
import { AzureApi } from "../../src/services/azure-api.ts";
import { AzureReads } from "../../src/services/azure-reads.ts";
import { AzureSignIn } from "../../src/services/azure-sign-in.ts";
import { EntraFlow } from "../../src/services/entra-flow.ts";
import { FakeAzure, KeptSecrets, linesOf } from "../fixtures/fake-azure.fixture.ts";

const connectionUrl: string = "https://dev.azure.com/fabrikam/_apis/connectionData";
const account: HostAccount = new HostAccount("monalisa@fabrikam.test", "Mona Lisa", null, []);
const renamed: HostAccount = new HostAccount("monalisa@fabrikam.test", "Mona", null, []);
const connection = (user: Readonly<Record<string, unknown>>): Response => FakeAzure.json({ authenticatedUser: user, instanceId: "d6245f20-2af8-44f4-9451-8107cb2767db" });
const profile = (displayName: string = "Mona Lisa"): Response => connection({ id: "d6245f20-2af8-44f4-9451-8107cb2767db", providerDisplayName: displayName,
  properties: { Account: { $type: "System.String", $value: "monalisa@fabrikam.test" } } });
const anonymous = (): Response => connection({ id: "aa442948-ba01-4b5d-9b19-fbcb2c4ba0e9", providerDisplayName: "Anonymous", properties: {} });
const refused = (): Response => new Response(null, { status: 401 });
const failed = (): Response => new Response(null, { status: 500 });
const signal: AbortSignal = new AbortController().signal;
const basic = (token: string): string => `Basic ${Buffer.from(`:${token}`).toString("base64")}`;

function heldOf(signIn: AzureSignIn): AzureCredential {
  const token = signIn.token;
  if (token === null)
    throw new Error("Nothing is signed in.");
  return token;
}

function drainAsync(): Promise<void> {
  return new Promise<void>(resolve => {
    setImmediate(resolve);
  });
}

const live: Rig[] = [];

interface ICountWaiter {
  readonly count: number;
  readonly resolve: () => void;
}

class Rig {
  public readonly azure: FakeAzure = new FakeAzure();
  public readonly secrets: FakeModuleSecrets = new FakeModuleSecrets();
  public readonly store: KeptSecrets = new KeptSecrets(this.secrets);
  public readonly appWindows: FakeAppWindows = new FakeAppWindows();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly changes: HostSignIn[] = [];
  public readonly signIn: AzureSignIn = new AzureSignIn(new AzureApi(this.azure.fetch), new EntraFlow(this.azure.fetch), this.secrets, this.appWindows, this.log, t => this.change(t));
  private readonly waiters: ICountWaiter[] = [];

  public changedAsync(count: number): Promise<void> {
    return this.changes.length >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ count, resolve });
    });
  }

  public disposeLater(): void {
    live.push(this);
  }

  public keepMicrosoft(token: string): void {
    this.store.values.set("git-azure-devops.microsoftSignIn", JSON.stringify({ kind: "microsoft", token, organization: "fabrikam", account: account.toJson() }));
  }

  public keep(token: string = "kept-token"): void {
    this.store.values.set("git-azure-devops.signIn", JSON.stringify({ token, organization: "Fabrikam", account: account.toJson() }));
  }

  public kept(): unknown {
    const value = this.store.values.get("git-azure-devops.signIn") ?? this.store.values.get("git-azure-devops.microsoftSignIn");
    return value === undefined ? undefined : JSON.parse(value);
  }

  public states(): readonly string[] {
    return this.changes.map(t => t.failure === null ? t.state : `${t.state} ${t.failure}`);
  }

  private change(signIn: HostSignIn): void {
    this.changes.push(signIn);
    for (const waiter of this.waiters.filter(t => t.count <= this.changes.length)) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }
}

describe("AzureSignIn", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads who the token is in its organization, keeps the token with the organization and account and signs in, logging the account and never the token", async () => {
    const rig = new Rig();
    rig.azure.answer(profile());

    const signedIn: HostSignIn = await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);

    assert.deepEqual([signedIn, rig.signIn.token?.authorization ?? null, rig.signIn.organization, rig.kept(), rig.azure.urls()],
      [HostSignIn.signedIn(account), basic("azure-token"), "fabrikam", { kind: "token", token: "azure-token", organization: "fabrikam", account: account.toJson() }, [connectionUrl]]);
    assert.deepEqual([rig.states(), linesOf(rig.log)], [["SignedIn"], ["Signed in to Azure DevOps as monalisa@fabrikam.test."]]);
  });

  it("ends signed out as Refused for a token its organization refuses, doesn't show or answers as anonymous, as Unreachable when it can't be reached, and keeps nothing", async () => {
    const rig = new Rig();
    rig.azure.answer(refused(), new Response(null, { status: 404 }), anonymous(), failed());
    rig.azure.fail(new TypeError("fetch failed"));

    const ended: HostSignIn[] = [];
    for (let index = 0; index < 5; index++)
      ended.push(await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal));

    assert.deepEqual(ended, [HostSignIn.signedOut(SignInFailure.Refused), HostSignIn.signedOut(SignInFailure.Refused),
      HostSignIn.signedOut(SignInFailure.Refused), HostSignIn.signedOut(SignInFailure.Unreachable), HostSignIn.signedOut(SignInFailure.Unreachable)]);
    assert.deepEqual([rig.signIn.token?.authorization ?? null, rig.signIn.organization, rig.kept(), linesOf(rig.log)], [null, null, undefined, [
      "The Azure DevOps sign-in ended signed out: Refused.", "The Azure DevOps sign-in ended signed out: Refused.",
      "The Azure DevOps sign-in ended signed out: Refused.", "The Azure DevOps sign-in ended signed out: Unreachable.",
      "The Azure DevOps sign-in ended signed out: Unreachable."]]);
  });

  it("ends signed out as Unkept when the token can't be kept, and passes on a save that fails other than as the secrets' failure", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    rig.azure.answer(profile(), profile());
    rig.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);

    const unkept: HostSignIn = await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    rig.store.saveFailure = unexpected;
    const error: unknown = await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal).then(() => null, (t: unknown) => t);

    assert.deepEqual([unkept, error, rig.signIn.token?.authorization ?? null, rig.signIn.current], [HostSignIn.signedOut(SignInFailure.Unkept), unexpected, null,
      HostSignIn.signedOut(SignInFailure.Unkept)]);
  });

  it("passes on a profile read that fails in a way it doesn't know, a profile it can't read, and the caller's cancel, staying as it was", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    rig.azure.fail(unexpected);
    rig.azure.answer(FakeAzure.json({ displayName: "Mona Lisa" }));
    const release = rig.azure.hold();
    const cancel = new AbortController();

    const errors: unknown[] = [await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal).then(() => null, (t: unknown) => t)];
    errors.push(await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal));
    const cancelled = rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", cancel.signal).then(() => null, (t: unknown) => t);
    cancel.abort(new Error("Stopped."));
    release(profile());
    errors.push(await cancelled);

    assert.deepEqual(errors, [unexpected, HostSignIn.signedOut(SignInFailure.Unreachable), new Error("Stopped.")]);
    assert.equal(rig.kept(), undefined);
  });

  it("answers the sign-in as it is to a token while another sign-in runs or once signed in, and asks nothing", async () => {
    const rig = new Rig();
    const release = rig.azure.hold();

    const first = rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    const second: HostSignIn = await rig.signIn.signInWithTokenAsync("other-token", "fabrikam", signal);
    release(profile());
    await first;
    const third: HostSignIn = await rig.signIn.signInWithTokenAsync("other-token", "fabrikam", signal);

    assert.deepEqual([second, third, rig.signIn.token?.authorization ?? null, rig.azure.requests.length], [HostSignIn.signedOut(), HostSignIn.signedIn(account), basic("azure-token"), 1]);
  });

  it("forgets a token it kept after the person signed out of a sign-in restored meanwhile, and shows no failure that comes after the sign-out", async () => {
    const kept = new Rig();
    const releaseSave = kept.store.holdSave();
    kept.keep();
    kept.azure.answer(profile());
    const refusedLate = new Rig();
    refusedLate.keep();

    const signingIn = kept.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    await kept.store.savedAsync();
    await kept.signIn.restoreAsync();
    await kept.signIn.signOutAsync();
    releaseSave();
    const ended: HostSignIn = await signingIn;
    const releaseProfile = refusedLate.azure.hold();
    const failing = refusedLate.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    await refusedLate.signIn.restoreAsync();
    await refusedLate.signIn.signOutAsync();
    releaseProfile(refused());

    assert.deepEqual([ended, kept.kept(), kept.signIn.token?.authorization ?? null], [HostSignIn.signedOut(), undefined, null]);
    assert.deepEqual([await failing, refusedLate.signIn.current], [HostSignIn.signedOut(), HostSignIn.signedOut()]);
  });

  it("keeps the token it was saving when the app quits during the save, and does nothing once disposed", async () => {
    const rig = new Rig();
    const releaseSave = rig.store.holdSave();
    rig.azure.answer(profile());

    const signingIn = rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    await rig.store.savedAsync();
    rig.signIn.dispose();
    releaseSave();
    const ended: HostSignIn = await signingIn;
    const again: HostSignIn = await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    await rig.signIn.restoreAsync();

    assert.deepEqual([ended, again, rig.kept(), rig.changes, rig.azure.requests.length], [HostSignIn.signedOut(),
      HostSignIn.signedOut(), { kind: "token", token: "azure-token", organization: "fabrikam", account: account.toJson() }, [], 1]);
  });

  it("shows the kept account at once, then the account Azure DevOps answers for its token", async () => {
    const rig = new Rig();
    rig.keep();
    rig.azure.answer(profile("Mona"));

    await rig.signIn.restoreAsync();
    await rig.changedAsync(2);

    assert.deepEqual([rig.changes, rig.signIn.token?.authorization ?? null, rig.signIn.organization, rig.azure.urls()], [[HostSignIn.signedIn(account), HostSignIn.signedIn(renamed)],
      basic("kept-token"), "Fabrikam", ["https://dev.azure.com/Fabrikam/_apis/connectionData"]]);
    assert.equal(rig.azure.requests[0]?.header("Authorization"), `Basic ${Buffer.from(":kept-token").toString("base64")}`);
  });

  it("forgets a kept token Azure DevOps no longer accepts, keeps one it can't check now, and logs a check that fails in a way it doesn't know", async () => {
    const revoked = new Rig();
    revoked.keep();
    revoked.azure.answer(refused());
    const unchecked = new Rig();
    unchecked.keep();
    unchecked.azure.answer(failed());
    const broken = new Rig();
    broken.keep();
    broken.azure.fail(new RangeError("Unexpected."));

    await Promise.all([revoked, unchecked, broken].map(t => t.signIn.restoreAsync()));
    await revoked.changedAsync(2);
    while (linesOf(unchecked.log).length + linesOf(broken.log).length < 2)
      await new Promise<void>(resolve => setImmediate(resolve));

    assert.deepEqual([revoked.states(), revoked.kept(), revoked.signIn.token?.authorization ?? null], [["SignedIn", "SignedOut Revoked"], undefined, null]);
    assert.deepEqual([unchecked.signIn.current, unchecked.signIn.token?.authorization ?? null], [HostSignIn.signedIn(account), basic("kept-token")]);
    assert.deepEqual([linesOf(unchecked.log), linesOf(broken.log)], [["The kept Azure DevOps sign-in couldn't be checked now, so it stays: Azure DevOps refused the request (500)."],
      ["The Azure DevOps sign-in stopped on an unexpected failure: RangeError: Unexpected."]]);
  });

  it("drops Azure DevOps' answer for a kept token once the person signed out, and once disposed", async () => {
    const signedOut = new Rig();
    signedOut.keep();
    const releaseSignedOut = signedOut.azure.hold();
    const disposed = new Rig();
    disposed.keep();
    disposed.azure.hold();

    await signedOut.signIn.restoreAsync();
    await signedOut.signIn.signOutAsync();
    releaseSignedOut(refused());
    await disposed.signIn.restoreAsync();
    await disposed.azure.askedAsync(1);
    disposed.signIn.dispose();
    await drainAsync();

    assert.deepEqual([signedOut.states(), disposed.states(), linesOf(disposed.log)], [["SignedIn", "SignedOut"], ["SignedIn"], []]);
  });

  it("counts no kept value as no sign-in, and logs a kept value it can't read, leaving the value alone", async () => {
    const empty = new Rig();
    const unreadable = new Rig();
    unreadable.store.values.set("git-azure-devops.signIn", "{\"token\":\"kept-token\"}");

    await empty.signIn.restoreAsync();
    await unreadable.signIn.restoreAsync();

    assert.deepEqual([empty.changes, unreadable.changes, linesOf(unreadable.log), unreadable.store.values.size],
      [[], [], ["The Azure DevOps sign-in ended signed out: Unkept."], 1]);
  });

  it("rethrows an error other than malformed JSON while it reads the kept sign-in", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    rig.keep();
    vi.spyOn(JsonReader, "parseValue").mockImplementation(() => {
      throw unexpected;
    });

    const error: unknown = await rig.signIn.restoreAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([error, rig.changes], [unexpected, []]);
  });

  it("reads the kept sign-in again once the app's main process connects, and only once", async () => {
    const rig = new Rig();
    rig.keep();
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    rig.azure.answer(profile());

    await rig.signIn.restoreAsync();
    await rig.signIn.restoreAsync();
    const waitingListeners = rig.appWindows.activeCallsOf("onChanged").length;
    rig.store.readFailure = null;
    rig.appWindows.raiseChanged();
    await rig.changedAsync(1);

    assert.deepEqual([waitingListeners, rig.appWindows.activeCallsOf("onChanged").length, rig.signIn.current], [1, 0, HostSignIn.signedIn(account)]);
  });

  it("logs a kept sign-in the secrets can't read for another reason, and passes on a read that fails other than as the secrets' failure", async () => {
    const logged = new Rig();
    logged.store.readFailure = KeptSecrets.failure(SecretFailureReason.Undecryptable);
    const thrown = new Rig();
    const unexpected = new RangeError("Unexpected.");
    thrown.store.readFailure = unexpected;

    await logged.signIn.restoreAsync();
    const error: unknown = await thrown.signIn.restoreAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([logged.signIn.current, logged.appWindows.activeCallsOf("onChanged").length, linesOf(logged.log)],
      [HostSignIn.signedOut(), 0, ["The kept Azure DevOps sign-in couldn't be read from this computer's secrets: The secret call failed."]]);
    assert.deepEqual([error, thrown.changes], [unexpected, []]);
  });

  it("does nothing with a kept sign-in whose read ends after it was disposed, or after a sign-in", async () => {
    const kept = new Rig();
    kept.keep();
    const releaseKept = kept.store.holdRead();
    const waiting = new Rig();
    waiting.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    const releaseWaiting = waiting.store.holdRead();
    const signedIn = new Rig();
    signedIn.keep();
    signedIn.azure.answer(profile());
    const releaseSignedIn = signedIn.store.holdRead();

    const restoring = [kept.signIn.restoreAsync(), waiting.signIn.restoreAsync()];
    kept.signIn.dispose();
    waiting.signIn.dispose();
    releaseKept();
    releaseWaiting();
    await Promise.all(restoring);
    const restoringSignedIn = signedIn.signIn.restoreAsync();
    await signedIn.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    releaseSignedIn();
    await restoringSignedIn;

    assert.deepEqual([kept.changes, kept.azure.requests.length, waiting.appWindows.activeCallsOf("onChanged").length, linesOf(waiting.log)], [[], 0, 0, []]);
    assert.deepEqual([signedIn.states(), signedIn.signIn.token?.authorization ?? null], [["SignedIn"], basic("azure-token")]);
  });

  it("forgets the token on sign-out, and still signs out when the secrets can't remove it, saying so", async () => {
    const forgotten = new Rig();
    forgotten.keep();
    forgotten.azure.hold();
    const unforgotten = new Rig();
    unforgotten.keep();
    unforgotten.azure.hold();
    unforgotten.store.removeFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);

    await forgotten.signIn.restoreAsync();
    await unforgotten.signIn.restoreAsync();
    const signedOut: readonly HostSignIn[] = [await forgotten.signIn.signOutAsync(), await unforgotten.signIn.signOutAsync()];

    assert.deepEqual([signedOut, forgotten.kept(), unforgotten.signIn.token?.authorization ?? null, unforgotten.signIn.organization], [[HostSignIn.signedOut(),
      HostSignIn.signedOut(SignInFailure.Unforgotten)], undefined, null, null]);
    assert.deepEqual(linesOf(unforgotten.log), ["The Azure DevOps token couldn't be removed from this computer's secrets; it is no longer used."]);
  });

  it("still removes a kept Microsoft sign-in when removing the token fails, signing out as Unforgotten and logging it once", async () => {
    const rig = new Rig();
    rig.keep();
    rig.store.values.set("git-azure-devops.microsoftSignIn", "{}");
    rig.azure.hold();

    await rig.signIn.restoreAsync();
    rig.store.removeFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    rig.store.removeFailureName = "git-azure-devops.signIn";
    const signedOut: HostSignIn = await rig.signIn.signOutAsync();

    assert.deepEqual([signedOut, [...rig.store.values.keys()], linesOf(rig.log)], [HostSignIn.signedOut(SignInFailure.Unforgotten), ["git-azure-devops.signIn"],
      ["The Azure DevOps token couldn't be removed from this computer's secrets; it is no longer used."]]);
  });

  it("removes a kept Microsoft sign-in once a token sign-in is kept, and still signs in when it can't, logging it", async () => {
    const rig = new Rig();
    rig.keepMicrosoft("refresh-1");
    rig.azure.answer(profile());
    const unremoved = new Rig();
    unremoved.keepMicrosoft("refresh-1");
    unremoved.azure.answer(profile());
    unremoved.store.removeFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);

    const signedIn: readonly HostSignIn[] = [await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal),
      await unremoved.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal)];

    assert.deepEqual([signedIn, [...rig.store.values.keys()], [...unremoved.store.values.keys()].sort(), linesOf(unremoved.log).length],
      [[HostSignIn.signedIn(account), HostSignIn.signedIn(account)], ["git-azure-devops.signIn"], ["git-azure-devops.microsoftSignIn", "git-azure-devops.signIn"], 2]);
  });

  it("signs out as Unforgotten and passes on a removal that fails other than as the secrets' failure, and does nothing when signed out", async () => {
    const rig = new Rig();
    const unexpected = new RangeError("Unexpected.");
    rig.keep();
    rig.azure.hold();
    const idle = new Rig();

    await rig.signIn.restoreAsync();
    rig.store.removeFailure = unexpected;
    const error: unknown = await rig.signIn.signOutAsync().then(() => null, (t: unknown) => t);
    const idleSignedOut: HostSignIn = await idle.signIn.signOutAsync();

    assert.deepEqual([error, rig.signIn.current, idleSignedOut, idle.changes], [unexpected, HostSignIn.signedOut(SignInFailure.Unforgotten), HostSignIn.signedOut(), []]);
  });

  it("changes and publishes nothing once disposed while a sign-out removes the token", async () => {
    const rig = new Rig();
    rig.keep();
    rig.azure.hold();

    await rig.signIn.restoreAsync();
    const releaseRemove = rig.store.holdRemove();
    const signingOut = rig.signIn.signOutAsync();
    rig.signIn.dispose();
    releaseRemove();
    await signingOut;

    assert.deepEqual([rig.states(), rig.signIn.current, rig.kept()], [["SignedIn"], HostSignIn.signedIn(account), undefined]);
  });

  it("signs out as Revoked only when the organization refuses the held token again, checking it once for refusals that come together", async () => {
    const rig = new Rig();
    rig.keep();
    rig.azure.hold();
    rig.azure.answer(refused());

    await rig.signIn.restoreAsync();
    await rig.signIn.refusedAsync(AzureCredential.ofToken("kept-token"));
    const before: string | null = rig.signIn.token?.authorization ?? null;
    const held = heldOf(rig.signIn);
    await Promise.all([rig.signIn.refusedAsync(held), rig.signIn.refusedAsync(held)]);

    assert.deepEqual([before, rig.signIn.token?.authorization ?? null, rig.signIn.organization, rig.states()], [basic("kept-token"), null, null, ["SignedIn", "SignedOut Revoked"]]);
    assert.deepEqual(rig.azure.urls(), ["https://dev.azure.com/Fabrikam/_apis/connectionData", "https://dev.azure.com/Fabrikam/_apis/connectionData"]);
  });

  it("stays signed in when the organization still takes a token a read was refused, as a token without that read's scope, or can't be reached to check it", async () => {
    const scoped = new Rig();
    scoped.keep();
    scoped.azure.hold();
    scoped.azure.answer(profile(), failed());

    await scoped.signIn.restoreAsync();
    await scoped.signIn.refusedAsync(heldOf(scoped.signIn));
    await scoped.signIn.refusedAsync(heldOf(scoped.signIn));

    assert.deepEqual([scoped.signIn.token?.authorization ?? null, scoped.states(), scoped.azure.requests.length], [basic("kept-token"), ["SignedIn", "SignedIn"], 3]);
    assert.deepEqual(linesOf(scoped.log), ["The kept Azure DevOps sign-in couldn't be checked now, so it stays: Azure DevOps refused the request (500)."]);
  });
});

describe("AzureSignIn with Microsoft", () => {
  const tokenUrl: string = "https://login.microsoftonline.com/organizations/oauth2/v2.0/token";
  const scopes: string = "499b84ac-1321-427f-aa17-267ca6975798/vso.code 499b84ac-1321-427f-aa17-267ca6975798/vso.code_write "
    + "499b84ac-1321-427f-aa17-267ca6975798/vso.work_write "
    + "499b84ac-1321-427f-aa17-267ca6975798/vso.graph offline_access";
  const grant = (access: string, refresh: string, expiresIn: number = 3600): Response =>
    FakeAzure.json({ token_type: "Bearer", scope: scopes, expires_in: expiresIn, access_token: access, refresh_token: refresh });
  const refusedGrant = (): Response => FakeAzure.json({ error: "invalid_grant", error_description: "AADSTS70000: The grant is expired." }, 400);
  const keptMicrosoft = (token: string): unknown => ({ kind: "microsoft", token, organization: "fabrikam", account: account.toJson() });

  function formOf(rig: Rig, index: number): Readonly<Record<string, string>> {
    return Object.fromEntries(new URLSearchParams(String(rig.azure.requests[index]?.init.body)));
  }

  function browse(signIn: HostSignIn, query: Readonly<Record<string, string>>, method: string = "GET"): Promise<Response> {
    const address = new URL(String(signIn.address));
    const redirect = new URL(String(address.searchParams.get("redirect_uri")));
    redirect.searchParams.set("state", String(address.searchParams.get("state")));
    for (const [name, value] of Object.entries(query))
      redirect.searchParams.set(name, value);
    return fetch(redirect, { method });
  }

  async function startAsync(rig: Rig): Promise<HostSignIn> {
    const waiting: HostSignIn = await rig.signIn.startSignInAsync("fabrikam");
    rig.disposeLater();
    return waiting;
  }

  afterEach(() => {
    for (const rig of live.splice(0))
      rig.signIn.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits in the browser on Microsoft's address with a PKCE challenge, redeems the code the browser brings back and signs in, keeping the refresh token", async () => {
    const rig = new Rig();
    rig.azure.answer(grant("access-1", "refresh-1"), profile());

    const waiting: HostSignIn = await startAsync(rig);
    const address = new URL(String(waiting.address));
    const page: Response = await browse(waiting, { code: "code-1", session_state: "d6245f20" });
    await rig.changedAsync(2);
    const form = formOf(rig, 0);

    assert.deepEqual([address.origin + address.pathname, Object.fromEntries([...address.searchParams].filter(([t]) => !["redirect_uri", "state", "code_challenge"].includes(t)))],
      ["https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize", { client_id: "a1e591a3-da4c-47be-995b-3bc71493bf84", response_type: "code",
        scope: scopes, code_challenge_method: "S256", prompt: "select_account" }]);
    assert.match(String(address.searchParams.get("redirect_uri")), /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(address.searchParams.get("code_challenge"), createHash("sha256").update(String(form["code_verifier"])).digest("base64url"));
    assert.deepEqual([page.status, page.headers.get("content-type"), page.headers.get("cache-control"), await page.text()],
      [200, "text/plain; charset=utf-8", "no-store", "Signed in to Azure DevOps. You can close this tab."]);
    assert.deepEqual([rig.azure.urls(), rig.azure.requests[0]?.init.method, rig.azure.requests[0]?.header("Content-Type"), rig.azure.requests[1]?.header("Authorization")],
      [[tokenUrl, connectionUrl], "POST", "application/x-www-form-urlencoded", "Bearer access-1"]);
    assert.deepEqual({ ...form, code_verifier: null }, { client_id: "a1e591a3-da4c-47be-995b-3bc71493bf84", scope: scopes, grant_type: "authorization_code",
      code: "code-1", redirect_uri: address.searchParams.get("redirect_uri"), code_verifier: null });
    assert.deepEqual([rig.states(), rig.signIn.current, rig.signIn.token?.authorization, rig.kept(), linesOf(rig.log)],
      [["Waiting", "SignedIn"], HostSignIn.signedIn(account), "Bearer access-1", keptMicrosoft("refresh-1"), ["Signed in to Azure DevOps as monalisa@fabrikam.test."]]);
    await assert.rejects(browse(waiting, { code: "code-2" }), TypeError);
  });

  it("keeps a Microsoft sign-in over an unreadable kept token, removing the token, so the next launch restores the Microsoft sign-in", async () => {
    const rig = new Rig();
    rig.store.values.set("git-azure-devops.signIn", "{\"token\":");
    rig.azure.answer(grant("access-1", "refresh-1"), profile());
    const next = new Rig();
    next.azure.hold();

    await browse(await startAsync(rig), { code: "code-1" });
    await rig.changedAsync(2);
    for (const [name, value] of rig.store.values)
      next.store.values.set(name, value);
    await next.signIn.restoreAsync();
    next.disposeLater();

    assert.deepEqual([[...rig.store.values.keys()], next.states(), next.signIn.organization], [["git-azure-devops.microsoftSignIn"], ["SignedIn"], "fabrikam"]);
  });

  it("keeps a Microsoft sign-in under its own secret, which a build that reads only the token's never sees, and removes both on sign-out", async () => {
    const rig = new Rig();
    rig.azure.answer(grant("access-1", "refresh-1"), profile());

    await browse(await startAsync(rig), { code: "code-1" });
    await rig.changedAsync(2);
    const kept: readonly string[] = [...rig.store.values.keys()];
    rig.keep();
    await rig.signIn.signOutAsync();

    assert.deepEqual([kept, [...rig.store.values.keys()]], [["git-azure-devops.microsoftSignIn"], []]);
  });

  it("answers nothing to a request without its state, a code or an error, or on another path or method, and keeps waiting", async () => {
    const rig = new Rig();
    const waiting: HostSignIn = await startAsync(rig);
    const redirect = String(new URL(String(waiting.address)).searchParams.get("redirect_uri"));

    const pages: Response[] = [await fetch(`${redirect}/?code=code-1&state=other`), await browse(waiting, {}), await fetch(`${redirect}/favicon.ico`),
      await browse(waiting, { code: "code-1" }, "POST"), await fetch(`${redirect}/?code=code-1`), await browse(waiting, { code: "code-1", state: "x".repeat(43) })];

    assert.deepEqual([pages.map(t => t.status), rig.states(), rig.azure.requests.length], [[404, 404, 404, 404, 404, 404], ["Waiting"], 0]);
  });

  it("ends signed out as Denied when the person refuses consent, and as Refused for another error, saying so in the browser", async () => {
    const denied = new Rig();
    const failed = new Rig();

    const pages: Response[] = [await browse(await startAsync(denied), { error: "access_denied", error_description: "AADSTS65004: The user declined." }),
      await browse(await startAsync(failed), { error: "invalid_scope" })];
    await Promise.all([denied.changedAsync(2), failed.changedAsync(2)]);

    assert.deepEqual([await pages[0]?.text(), denied.states(), failed.states(), denied.azure.requests.length, denied.kept()],
      ["The Azure DevOps sign-in didn't finish. You can close this tab.", ["Waiting", "SignedOut Denied"], ["Waiting", "SignedOut Refused"], 0, undefined]);
    assert.deepEqual(linesOf(denied.log), ["The Azure DevOps sign-in ended signed out: Denied."]);
  });

  it("ends signed out as Refused when Microsoft refuses the code or the organization refuses the account, as Unreachable when either can't be reached, and as Unkept", async () => {
    const answers: readonly (readonly Response[])[] = [[refusedGrant()], [grant("access-1", "refresh-1"), refused()], [grant("access-1", "refresh-1"), anonymous()],
      [new Response("<html>", { status: 400 })], [FakeAzure.json({ error: "server_error" }, 503)], [grant("access-1", "refresh-1"), failed()],
      [FakeAzure.json({ access_token: "access-1" })]];
    const rigs: Rig[] = answers.map(t => {
      const rig = new Rig();
      rig.azure.answer(...t);
      return rig;
    });
    const unkept = new Rig();
    unkept.azure.answer(grant("access-1", "refresh-1"), profile());
    unkept.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    const offline = new Rig();
    offline.azure.fail(new TypeError("fetch failed"));
    const broken = new Rig();
    broken.azure.fail(new RangeError("Unexpected."));
    rigs.push(unkept, offline, broken);

    for (const rig of rigs)
      await browse(await startAsync(rig), { code: "code-1" });
    await Promise.all(rigs.map(t => t.changedAsync(2)));

    assert.deepEqual(rigs.map(t => t.states()[1]), ["SignedOut Refused", "SignedOut Refused", "SignedOut Refused", "SignedOut Unreachable", "SignedOut Unreachable",
      "SignedOut Unreachable", "SignedOut Unreachable", "SignedOut Unkept", "SignedOut Unreachable", "SignedOut Unreachable"]);
    assert.deepEqual(rigs.map(t => [t.kept(), t.signIn.token]), rigs.map(() => [undefined, null]));
    assert.deepEqual(linesOf(broken.log), ["The Azure DevOps sign-in ended signed out: Unreachable.",
      "The Azure DevOps sign-in stopped on an unexpected failure: RangeError: Unexpected."]);
  });

  it("stops waiting and closes the listener when the person cancels or signs out, and ignores a cancel with nothing waiting", async () => {
    const cancelled = new Rig();
    const signedOut = new Rig();
    const idle = new Rig();

    const waiting: HostSignIn = await startAsync(cancelled);
    const answers: HostSignIn[] = [cancelled.signIn.cancelSignIn(), cancelled.signIn.cancelSignIn(), idle.signIn.cancelSignIn()];
    await startAsync(signedOut);
    answers.push(await signedOut.signIn.signOutAsync());

    assert.deepEqual(answers, [HostSignIn.signedOut(), HostSignIn.signedOut(), HostSignIn.signedOut(), HostSignIn.signedOut()]);
    assert.deepEqual([cancelled.states(), signedOut.states(), idle.states(), linesOf(cancelled.log)], [["Waiting", "SignedOut"], ["Waiting", "SignedOut"], [], []]);
    await assert.rejects(browse(waiting, { code: "code-1" }), TypeError);
  });

  it("drops a code redeemed after the person cancelled, forgetting what it kept, and drops one redeemed once disposed", async () => {
    const cancelled = new Rig();
    const releaseSave = cancelled.store.holdSave();
    cancelled.azure.answer(grant("access-1", "refresh-1"), profile());
    const disposed = new Rig();
    const releaseGrant = disposed.azure.hold();
    const savedLate = new Rig();
    const releaseLateSave = savedLate.store.holdSave();
    savedLate.azure.answer(grant("access-1", "refresh-1"), profile());

    const cancelledSaved = cancelled.store.savedAsync();
    await browse(await startAsync(cancelled), { code: "code-1" });
    await cancelledSaved;
    cancelled.signIn.cancelSignIn();
    releaseSave();
    await browse(await startAsync(disposed), { code: "code-1" });
    await disposed.azure.askedAsync(1);
    disposed.signIn.dispose();
    releaseGrant(grant("access-1", "refresh-1"));
    const unkeptLate = new Rig();
    const releaseUnkept = unkeptLate.store.holdSave();
    unkeptLate.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    unkeptLate.azure.answer(grant("access-1", "refresh-1"), profile());
    const unkeptSaved = unkeptLate.store.savedAsync();
    await browse(await startAsync(unkeptLate), { code: "code-1" });
    await unkeptSaved;
    unkeptLate.signIn.cancelSignIn();
    releaseUnkept();
    const lateSaved = savedLate.store.savedAsync();
    await browse(await startAsync(savedLate), { code: "code-1" });
    await lateSaved;
    savedLate.signIn.dispose();
    releaseLateSave();
    await drainAsync();
    await drainAsync();

    assert.deepEqual([cancelled.states(), cancelled.kept(), cancelled.signIn.token], [["Waiting", "SignedOut"], undefined, null]);
    assert.deepEqual([unkeptLate.states(), linesOf(unkeptLate.log)], [["Waiting", "SignedOut"], ["The Azure DevOps sign-in ended signed out: Unkept."]]);
    assert.deepEqual([disposed.states(), disposed.azure.requests.length, linesOf(disposed.log)], [["Waiting"], 1, []]);
    assert.deepEqual([savedLate.states(), savedLate.kept()], [["Waiting"], keptMicrosoft("refresh-1")]);
  });

  it("ends signed out as Expired when the browser doesn't come back within five minutes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const rig = new Rig();

    const waiting: HostSignIn = await startAsync(rig);
    await vi.advanceTimersByTimeAsync(299_999);
    const before: readonly string[] = rig.states();
    await vi.advanceTimersByTimeAsync(1);
    await rig.changedAsync(2);
    vi.useRealTimers();

    assert.deepEqual([before, rig.states(), linesOf(rig.log)], [["Waiting"], ["Waiting", "SignedOut Expired"], ["The Azure DevOps sign-in ended signed out: Expired."]]);
    await assert.rejects(browse(waiting, { code: "code-1" }), TypeError);
  });

  it("answers the sign-in as it is to a start while another sign-in waits, runs or is signed in, and once disposed", async () => {
    const rig = new Rig();
    const both = await Promise.all([rig.signIn.startSignInAsync("fabrikam"), rig.signIn.startSignInAsync("fabrikam")]);
    rig.disposeLater();
    const again: HostSignIn = await rig.signIn.startSignInAsync("fabrikam");
    const tokenWhileWaiting: HostSignIn = await rig.signIn.signInWithTokenAsync("azure-token", "fabrikam", signal);
    const disposed = new Rig();
    disposed.signIn.dispose();

    assert.deepEqual([both[1], again, tokenWhileWaiting, await disposed.signIn.startSignInAsync("fabrikam")], [both[0], both[0], both[0], HostSignIn.signedOut()]);
    assert.deepEqual([rig.states(), disposed.states()], [["Waiting"], []]);
  });

  it("renews a kept Microsoft sign-in at once, then five minutes before each access token expires, keeping each new refresh token", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const rig = new Rig();
    rig.keepMicrosoft("refresh-1");
    rig.azure.answer(grant("access-1", "refresh-2"), profile("Mona"), grant("access-2", "refresh-3", 600));

    await rig.signIn.restoreAsync();
    const restored = rig.signIn.token;
    await rig.azure.askedAsync(2);
    await rig.changedAsync(2);
    const first: readonly unknown[] = [restored?.authorization, rig.kept()];
    await vi.advanceTimersByTimeAsync(3_299_999);
    const early: number = rig.azure.requests.length;
    await vi.advanceTimersByTimeAsync(1);
    await rig.azure.askedAsync(3);
    await drainAsync();
    rig.signIn.dispose();

    assert.deepEqual(first, ["Bearer access-1", keptMicrosoft("refresh-2")]);
    assert.deepEqual([early, rig.signIn.token, restored?.authorization, rig.kept(), rig.states()],
      [2, null, "Bearer access-2", keptMicrosoft("refresh-3"), ["SignedIn", "SignedIn"]]);
    assert.deepEqual([formOf(rig, 0), formOf(rig, 2)["refresh_token"]], [{ client_id: "a1e591a3-da4c-47be-995b-3bc71493bf84", scope: scopes,
      grant_type: "refresh_token", refresh_token: "refresh-1" }, "refresh-2"]);
  });

  it("holds a read made while a kept Microsoft sign-in restores until its first renewal, so the read sends the renewed access token", async () => {
    const rig = new Rig();
    rig.keepMicrosoft("refresh-1");
    rig.azure.answer(grant("access-1", "refresh-2"), profile(), new Response(null, { status: 404 }));
    const reads = new AzureReads(new AzureApi(rig.azure.fetch), rig.signIn, rig.log);

    await rig.signIn.restoreAsync();
    rig.disposeLater();
    const read: HostWorkItem | null = await reads.readWorkItemAsync(new WorkItemQuery("git-azure-devops", "fabrikam", 42), signal);

    assert.deepEqual([read, rig.azure.urls(), rig.azure.requests[2]?.header("Authorization")], [null, [tokenUrl, connectionUrl,
      "https://dev.azure.com/fabrikam/_apis/wit/workitems/42?api-version=7.1"], "Bearer access-1"]);
  });

  it("signs out as Expired, asking to sign in again, when Microsoft refuses the renewal, and forgets the kept sign-in", async () => {
    const rig = new Rig();
    rig.keepMicrosoft("refresh-1");
    rig.azure.answer(refusedGrant());

    await rig.signIn.restoreAsync();
    await rig.changedAsync(2);

    assert.deepEqual([rig.states(), rig.signIn.current, rig.signIn.token, rig.kept()], [["SignedIn", "SignedOut Expired"], HostSignIn.signedOut(SignInFailure.Expired),
      null, undefined]);
  });

  it("keeps a sign-in made before replies and votes when Microsoft asks to allow them, without code writes, and says to sign in again", async () => {
    const rig = new Rig();
    rig.keepMicrosoft("refresh-1");
    rig.azure.answer(FakeAzure.json({ error: "invalid_grant", suberror: "consent_required" }, 400), grant("access-1", "refresh-2"), profile());

    await rig.signIn.restoreAsync();
    await rig.azure.askedAsync(3);
    await rig.changedAsync(2);
    const token = rig.signIn.token;
    rig.signIn.dispose();

    assert.deepEqual([token?.authorization, token?.canWriteCode, rig.kept(), rig.states()], ["Bearer access-1", false, keptMicrosoft("refresh-2"), ["SignedIn", "SignedIn"]]);
    assert.ok(linesOf(rig.log).includes("The Azure DevOps sign-in is kept without replies, thread states and votes, which Microsoft asks to allow; sign in again to allow them."));
  });

  it("keeps a sign-in whose renewal can't reach Microsoft, logging it, renews once on a refused read, and logs a renewal it can't keep", async () => {
    const rig = new Rig();
    rig.keepMicrosoft("refresh-1");
    rig.azure.fail(new TypeError("fetch failed"));
    rig.azure.answer(grant("access-1", "refresh-2"), profile());

    await rig.signIn.restoreAsync();
    await rig.azure.askedAsync(1);
    await drainAsync();
    const credential = heldOf(rig.signIn);
    rig.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    await Promise.all([rig.signIn.refusedAsync(credential), rig.signIn.refusedAsync(credential)]);
    rig.signIn.dispose();

    assert.deepEqual([rig.azure.urls(), credential.authorization, rig.kept(), rig.states()], [[tokenUrl, tokenUrl, connectionUrl], "Bearer access-1",
      keptMicrosoft("refresh-1"), ["SignedIn", "SignedIn"]]);
    assert.deepEqual(linesOf(rig.log), ["The kept Azure DevOps sign-in couldn't be checked now, so it stays: Microsoft's sign-in couldn't be reached.",
      "The renewed Azure DevOps sign-in couldn't be kept in this computer's secrets; the one kept before stays until it expires."]);
  });

  it("drops a renewal that ends after the person signed out or once disposed, and logs one that fails in a way it doesn't know", async () => {
    const signedOut = new Rig();
    signedOut.keepMicrosoft("refresh-1");
    const releaseSignedOut = signedOut.azure.hold();
    const disposed = new Rig();
    disposed.keepMicrosoft("refresh-1");
    disposed.azure.hold();
    const broken = new Rig();
    broken.keepMicrosoft("refresh-1");
    broken.azure.fail(new RangeError("Unexpected."));

    await Promise.all([signedOut, disposed, broken].map(t => t.signIn.restoreAsync()));
    const ready: unknown = await broken.signIn.readyAsync();
    await Promise.all([signedOut, disposed].map(t => t.azure.askedAsync(1)));
    await signedOut.signIn.signOutAsync();
    releaseSignedOut(grant("access-1", "refresh-2"));
    disposed.signIn.dispose();
    await drainAsync();
    await drainAsync();

    assert.deepEqual([signedOut.states(), signedOut.kept(), signedOut.azure.requests.length], [["SignedIn", "SignedOut"], undefined, 1]);
    assert.deepEqual([disposed.states(), linesOf(disposed.log)], [["SignedIn"], []]);
    assert.deepEqual([ready, linesOf(broken.log)], [undefined, ["The Azure DevOps sign-in stopped on an unexpected failure: RangeError: Unexpected."]]);
  });
});

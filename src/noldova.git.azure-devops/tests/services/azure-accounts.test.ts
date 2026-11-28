/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonReader } from "@noldova/context.json";
import { FailureCode, SecretFailureReason } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { FakeAppWindows, FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";
import { AccountPick, HostAccount, type HostSignIn, SignInFailure, SignInState } from "@noldova/git.hosting.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { AzureAccounts } from "../../src/services/azure-accounts.ts";
import { AzureApi } from "../../src/services/azure-api.ts";
import { EntraFlow } from "../../src/services/entra-flow.ts";
import { FakeAzure, KeptSecrets, linesOf } from "../fixtures/fake-azure.fixture.ts";

const signal: AbortSignal = new AbortController().signal;
const accountOf = (login: string): HostAccount => new HostAccount(login, null, null, []);
const keptOf = (login: string, organization: string): string => JSON.stringify({ token: `pat-${login}`, organization, account: accountOf(login).toJson() });
const profileOf = (login: string): Response => FakeAzure.json({ authenticatedUser: { id: "d6245f20-2af8-44f4-9451-8107cb2767db", providerDisplayName: login,
  properties: { Account: { $type: "System.String", $value: login } } } });
const refused = (): Response => new Response(null, { status: 401 });
const pathOf = (organization: string, name: string = "web"): string => `${organization}/shop/_git/${name}`;

class Kept {
  public readonly login: string;
  public readonly organization: string;

  public constructor(login: string, organization: string) {
    this.login = login;
    this.organization = organization;
  }
}

class Rig {
  public readonly azure: FakeAzure = new FakeAzure();
  public readonly secrets: FakeModuleSecrets = new FakeModuleSecrets();
  public readonly store: KeptSecrets = new KeptSecrets(this.secrets);
  public readonly appWindows: FakeAppWindows = new FakeAppWindows();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly changes: string[] = [];
  public readonly accounts: AzureAccounts = new AzureAccounts(new AzureApi(this.azure.fetch), new EntraFlow(this.azure.fetch), this.secrets, this.appWindows,
    this.log, (id, t) => this.change(id, t));
  private readonly waiters: { readonly count: number; readonly resolve: () => void }[] = [];

  public keep(kept: readonly Kept[], picks: readonly AccountPick[] = []): void {
    kept.forEach((t, index) => this.store.values.set(index === 0 ? "git-azure-devops.signIn" : `git-azure-devops.account${index + 1}`, keptOf(t.login, t.organization)));
    this.store.values.set("git-azure-devops.accounts", JSON.stringify({
      accounts: kept.slice(1).map((t, index) => ({ id: index + 2, organization: t.organization, login: t.login })), picks: picks.map(t => t.toJson())
    }));
  }

  public async restoreAsync(kept: readonly Kept[]): Promise<void> {
    this.azure.answer(...kept.map(t => profileOf(t.login)));
    await this.accounts.restoreAsync();
    await this.azure.askedAsync(kept.length);
    await this.changedAsync(kept.length * 2);
    this.azure.requests.length = 0;
  }

  public changedAsync(count: number): Promise<void> {
    return this.changes.length >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ count, resolve });
    });
  }

  public index(): unknown {
    const value = this.store.values.get("git-azure-devops.accounts");
    return value === undefined ? undefined : JSON.parse(value);
  }

  public async savedAsync(): Promise<void> {
    await new Promise<void>(resolve => {
      setImmediate(resolve);
    });
  }

  public entries(): readonly (readonly (string | number | null)[])[] {
    return this.accounts.list.accounts.map(t => [t.id, t.signIn.account?.login ?? null, t.place]);
  }

  public authorizationOf(organization: string, host: string | null = null, path: string | null = null): string | null {
    return this.accounts.tokenFor(organization, host, path)?.authorization ?? null;
  }

  private change(id: number, signIn: HostSignIn): void {
    this.changes.push(signIn.failure === null ? `${id} ${signIn.state}` : `${id} ${signIn.state} ${signIn.failure}`);
    for (const waiter of this.waiters.filter(t => t.count <= this.changes.length)) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }
}

const basic = (token: string): string => `Basic ${Buffer.from(`:${token}`).toString("base64")}`;
const mona: Kept = new Kept("mona@fabrikam.test", "Fabrikam");
const hubot: Kept = new Kept("hubot@contoso.test", "contoso");
const octo: Kept = new Kept("octo@fabrikam.test", "fabrikam");

describe("AzureAccounts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores a sign-in an earlier version kept as the first account, its place naming its organization, and writes no index while it is the only one", async () => {
    const rig = new Rig();
    rig.store.values.set("git-azure-devops.signIn", keptOf(mona.login, mona.organization));

    await rig.restoreAsync([mona]);
    await rig.savedAsync();

    assert.deepEqual([rig.entries(), rig.index(), rig.accounts.isSignedIn], [[[1, mona.login, "dev.azure.com/fabrikam"]], undefined, true]);
  });

  it("restores every account the index names, each from its own secret, the first first", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot, octo]);

    await rig.restoreAsync([mona, hubot, octo]);

    assert.deepEqual(rig.entries(), [[1, mona.login, "dev.azure.com/fabrikam"], [2, hubot.login, "dev.azure.com/contoso"], [3, octo.login, "dev.azure.com/fabrikam"]]);
  });

  it("restores the first account once and each other account once, whatever the index repeats", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    rig.store.values.set("git-azure-devops.accounts", JSON.stringify({ accounts: [1, 2, 2].map(id => ({ id, organization: hubot.organization, login: hubot.login })), picks: [] }));

    await rig.restoreAsync([mona, hubot]);

    assert.deepEqual(rig.entries(), [[1, mona.login, "dev.azure.com/fabrikam"], [2, hubot.login, "dev.azure.com/contoso"]]);
  });

  it("logs an account already kept whose secret removal breaks, and still lets it leave the list", async () => {
    const rig = new Rig();
    const twin: Kept = new Kept(mona.login, "fabrikam");
    rig.keep([mona, twin]);
    rig.store.removeFailure = new RangeError("Unexpected.");
    rig.azure.answer(profileOf(mona.login), profileOf(twin.login));

    await rig.accounts.restoreAsync();
    while (!rig.changes.includes("2 SignedOut AlreadyKept"))
      await rig.changedAsync(rig.changes.length + 1);
    await rig.savedAsync();

    assert.deepEqual(rig.entries(), [[1, mona.login, "dev.azure.com/fabrikam"]]);
    assert.ok(linesOf(rig.log).includes("The Azure DevOps sign-in stopped on an unexpected failure: RangeError: Unexpected."));
  });

  it("drops an account the index names whose own secret is gone, and writes the index without it", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    rig.store.values.delete("git-azure-devops.account2");

    await rig.restoreAsync([mona]);
    await rig.savedAsync();

    assert.deepEqual([rig.entries(), rig.index()], [[[1, mona.login, "dev.azure.com/fabrikam"]], { accounts: [], picks: [] }]);
  });

  it("keeps an added account whose own secret can't be read in the list and the index, signed out, so it restores once the secrets answer", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    rig.store.readFailureName = "git-azure-devops.account2";
    rig.azure.answer(profileOf(mona.login));
    await rig.accounts.restoreAsync();
    await rig.changedAsync(2);
    rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam"), 1));
    await rig.savedAsync();

    assert.deepEqual([rig.entries(), rig.index()], [[[1, mona.login, "dev.azure.com/fabrikam"], [2, null, null]], {
      accounts: [{ id: 2, organization: null, login: null }], picks: [{ host: "dev.azure.com", path: pathOf("fabrikam"), account: 1 }]
    }]);
  });

  it("restores only the first account when the index can't be read, and says so", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    rig.store.values.set("git-azure-devops.accounts", "{ not json");

    await rig.restoreAsync([mona]);

    assert.deepEqual([rig.entries(), linesOf(rig.log)], [[[1, mona.login, "dev.azure.com/fabrikam"]],
      ["The Azure DevOps accounts kept on this computer couldn't be read; only the first account was restored."]]);
  });

  it("says why when the secrets refuse the index, and restores it once a window connects when they weren't connected yet", async () => {
    const refusing = new Rig();
    refusing.store.readFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    await refusing.accounts.restoreAsync();
    const waiting = new Rig();
    waiting.keep([mona, hubot]);
    waiting.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    await waiting.accounts.restoreAsync();
    const before = [waiting.entries(), waiting.appWindows.activeCallsOf("onChanged").length];
    waiting.store.readFailure = null;
    waiting.azure.answer(profileOf(mona.login), profileOf(hubot.login));
    waiting.appWindows.raiseChanged();
    await waiting.changedAsync(4);

    assert.deepEqual(linesOf(refusing.log)[0], "The Azure DevOps accounts kept on this computer couldn't be read: The secret call failed.");
    assert.deepEqual([before, waiting.entries(), waiting.appWindows.activeCallsOf("onChanged").length], [[[[1, null, null]], 2],
      [[1, mona.login, "dev.azure.com/fabrikam"], [2, hubot.login, "dev.azure.com/contoso"]], 0]);
  });

  it("adds an account signed in with a token under the next id, keeping it in its own secret and in the index", async () => {
    const rig = new Rig();
    rig.keep([mona]);
    await rig.restoreAsync([mona]);
    rig.azure.answer(profileOf(hubot.login));

    const entry = await rig.accounts.addAsync(t => t.signInWithTokenAsync("pat-hubot", "contoso", signal));
    await rig.savedAsync();

    assert.deepEqual([entry.id, entry.signIn.state, entry.place, rig.entries(), rig.index(), JSON.parse(rig.store.values.get("git-azure-devops.account2") ?? "null").organization],
      [2, SignInState.SignedIn, "dev.azure.com/contoso", [[1, mona.login, "dev.azure.com/fabrikam"], [2, hubot.login, "dev.azure.com/contoso"]],
        { accounts: [{ id: 2, organization: "contoso", login: hubot.login }], picks: [] }, "contoso"]);
  });

  it("answers an added account whose token the organization refuses signed out with the failure, and lets it leave the list", async () => {
    const rig = new Rig();
    await rig.restoreAsync([]);
    rig.azure.answer(refused());

    const entry = await rig.accounts.addAsync(t => t.signInWithTokenAsync("pat-hubot", "contoso", signal));

    assert.deepEqual([entry.id, entry.signIn.failure, entry.place, rig.entries(), rig.changes.at(-1)], [2, SignInFailure.Refused, "dev.azure.com/contoso", [[1, null, null]],
      "2 SignedOut Refused"]);
  });

  it("ends an added account that signs in to an organization as an account already kept there as already kept, and never answers it signed in", async () => {
    const rig = new Rig();
    rig.keep([mona]);
    await rig.restoreAsync([mona]);
    rig.azure.answer(profileOf(mona.login));

    const entry = await rig.accounts.addAsync(t => t.signInWithTokenAsync("pat-again", "fabrikam", signal));

    assert.deepEqual([entry.signIn.state, entry.signIn.failure, rig.entries(), rig.store.values.has("git-azure-devops.account2"), linesOf(rig.log).at(-1)],
      [SignInState.SignedOut, SignInFailure.AlreadyKept, [[1, mona.login, "dev.azure.com/fabrikam"]], false,
        "An added Azure DevOps account signed in to an organization as an account already kept there, so its token was forgotten and it ended signed out as already kept."]);
  });

  it("keeps the same login signed in to two organizations as two accounts", async () => {
    const rig = new Rig();
    rig.keep([mona]);
    await rig.restoreAsync([mona]);
    rig.azure.answer(profileOf(mona.login));

    const entry = await rig.accounts.addAsync(t => t.signInWithTokenAsync("pat-contoso", "contoso", signal));

    assert.deepEqual([entry.signIn.state, rig.entries()], [SignInState.SignedIn, [[1, mona.login, "dev.azure.com/fabrikam"], [2, mona.login, "dev.azure.com/contoso"]]]);
  });

  it("keeps the first account when it signs in as an added account's login in its organization, and ends the added one as already kept", async () => {
    const rig = new Rig();
    rig.keep([new Kept("other@fabrikam.test", "fabrikam"), hubot]);
    await rig.restoreAsync([new Kept("other@fabrikam.test", "fabrikam"), hubot]);
    await rig.accounts.signOutAsync(1);
    rig.azure.answer(profileOf(hubot.login));

    await rig.accounts.signInOf(1).signInWithTokenAsync("pat-first", "contoso", signal);
    await rig.changedAsync(rig.changes.length + 1);

    assert.deepEqual([rig.entries(), rig.changes.at(-1)], [[[1, hubot.login, "dev.azure.com/contoso"]], "2 SignedOut AlreadyKept"]);
  });

  it("signs out an added account while the first stays signed in, forgetting its secret and its picks", async () => {
    const rig = new Rig();
    rig.keep([mona, octo], [new AccountPick("dev.azure.com", pathOf("fabrikam"), 2)]);
    await rig.restoreAsync([mona, octo]);

    const signedOut = await rig.accounts.signOutAsync(2);
    await rig.savedAsync();

    assert.deepEqual([signedOut.state, rig.entries(), rig.store.values.has("git-azure-devops.account2"), rig.index(), rig.authorizationOf("fabrikam")],
      [SignInState.SignedOut, [[1, mona.login, "dev.azure.com/fabrikam"]], false, { accounts: [], picks: [] }, basic(`pat-${mona.login}`)]);
  });

  it("keeps a first account that signs out in the list, signed out, while an added one stays signed in", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    await rig.restoreAsync([mona, hubot]);

    await rig.accounts.signOutAsync(1);

    assert.deepEqual([rig.entries(), rig.accounts.isSignedIn, rig.authorizationOf("contoso")], [[[1, null, "dev.azure.com/fabrikam"],
      [2, hubot.login, "dev.azure.com/contoso"]], true, basic(`pat-${hubot.login}`)]);
  });

  it("keeps an added account its organization revoked in the list with its failure, and drops it when the person signs it out", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    rig.azure.answer(profileOf(mona.login), refused());
    await rig.accounts.restoreAsync();
    await rig.changedAsync(4);
    const revoked = rig.entries();

    await rig.accounts.signOutAsync(2);

    assert.deepEqual([revoked, rig.accounts.list.accounts[1]?.signIn.failure, rig.entries()], [[[1, mona.login, "dev.azure.com/fabrikam"], [2, null, "dev.azure.com/contoso"]],
      undefined, [[1, mona.login, "dev.azure.com/fabrikam"]]]);
  });

  it("refuses an account it doesn't keep as NotFound, for a sign-in and a pick", async () => {
    const rig = new Rig();
    await rig.restoreAsync([]);

    for (const run of [() => rig.accounts.signInOf(2), () => rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam"), 2))])
      assert.throws(run, (error: unknown) => error instanceof MethodFailureException && error.failure.code === FailureCode.NotFound);
  });

  it("answers no account while none is signed in to the repository's organization, or for a path that isn't an Azure DevOps repository's", async () => {
    const rig = new Rig();
    rig.keep([mona]);
    await rig.restoreAsync([mona]);

    assert.deepEqual([rig.accounts.accountFor("dev.azure.com", pathOf("contoso")), rig.accounts.accountFor("dev.azure.com", "fabrikam/web"),
      rig.accounts.accountFor("github.com", "fabrikam/web"), rig.authorizationOf("contoso")], [null, null, null, null]);
  });

  it("reads a repository with the account signed in to its organization, from any of the remote's forms", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    await rig.restoreAsync([mona, hubot]);

    assert.deepEqual([rig.accounts.accountFor("dev.azure.com", pathOf("contoso")), rig.accounts.accountFor("ssh.dev.azure.com", "v3/contoso/shop/web"),
      rig.accounts.accountFor("contoso.visualstudio.com", "shop/_git/web"), rig.accounts.accountFor("dev.azure.com", pathOf("Fabrikam")),
      rig.authorizationOf("CONTOSO")], [2, 2, 2, 1, basic(`pat-${hubot.login}`)]);
  });

  it("reads with the first account of two in one organization until the person picks the other, remembering the pick in the index", async () => {
    const rig = new Rig();
    rig.keep([mona, octo]);
    await rig.restoreAsync([mona, octo]);
    const before = rig.accounts.accountFor("dev.azure.com", pathOf("fabrikam"));

    const picked = rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam"), 2));
    await rig.savedAsync();

    assert.deepEqual([before, picked, rig.accounts.accountFor("dev.azure.com", pathOf("fabrikam")), rig.accounts.accountFor("dev.azure.com", pathOf("fabrikam", "api")),
      rig.authorizationOf("fabrikam", "dev.azure.com", pathOf("fabrikam")), rig.authorizationOf("fabrikam", "dev.azure.com", pathOf("fabrikam", "api")),
      rig.index()], [1, 2, 2, 1, basic(`pat-${octo.login}`), basic(`pat-${mona.login}`), {
      accounts: [{ id: 2, organization: "fabrikam", login: octo.login }], picks: [{ host: "dev.azure.com", path: pathOf("fabrikam"), account: 2 }]
    }]);
  });

  it("reads through a reference with the account last picked in its organization, else its first", async () => {
    const rig = new Rig();
    rig.keep([mona, octo, hubot]);
    await rig.restoreAsync([mona, octo, hubot]);
    const before = rig.authorizationOf("fabrikam");

    rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam"), 2));
    rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("contoso"), 3));

    assert.deepEqual([before, rig.authorizationOf("fabrikam"), rig.authorizationOf("contoso")], [basic(`pat-${mona.login}`), basic(`pat-${octo.login}`),
      basic(`pat-${hubot.login}`)]);
  });

  it("passes over a pick whose account is signed out or signed in to another organization, and matches a pick whatever the case", async () => {
    const rig = new Rig();
    rig.keep([mona, octo, hubot], [new AccountPick("DEV.azure.com", pathOf("Fabrikam"), 2), new AccountPick("dev.azure.com", pathOf("fabrikam", "api"), 3)]);
    await rig.restoreAsync([mona, octo, hubot]);
    const picked = rig.accounts.accountFor("dev.azure.com", pathOf("fabrikam"));
    const elsewhere = rig.accounts.accountFor("dev.azure.com", pathOf("fabrikam", "api"));

    await rig.accounts.signOutAsync(2);

    assert.deepEqual([picked, elsewhere, rig.accounts.accountFor("dev.azure.com", pathOf("fabrikam"))], [2, 1, 1]);
  });

  it("keeps the newest 200 picks, a repository picked again counting as new", async () => {
    const rig = new Rig();
    rig.keep([mona]);
    await rig.restoreAsync([mona]);

    for (let index = 0; index < 201; index++)
      rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam", `web${index}`), 1));
    rig.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam", "web1"), 1));
    await rig.savedAsync();
    const picks = (rig.index() as { picks: { path: string }[] }).picks.map(t => t.path);

    assert.deepEqual([picks.length, picks[0], picks.at(-1)], [200, pathOf("fabrikam", "web2"), pathOf("fabrikam", "web1")]);
  });

  it("holds and passes a refusal to every account's token, and waits on every account's check", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    await rig.restoreAsync([mona, hubot]);
    const token = rig.accounts.tokenFor("contoso");
    if (token === null)
      throw new Error("Contoso has no account.");
    rig.azure.answer(refused());

    const held: boolean = rig.accounts.holds(token);
    await rig.accounts.refusedAsync(token);
    await rig.accounts.readyAsync();

    assert.deepEqual([held, rig.accounts.holds(token), rig.changes.at(-1), rig.entries()], [true, false, "2 SignedOut Revoked",
      [[1, mona.login, "dev.azure.com/fabrikam"], [2, null, "dev.azure.com/contoso"]]]);
  });

  it("says so when the index can't be kept, without failing the pick", async () => {
    const refusing = new Rig();
    refusing.keep([mona, octo]);
    await refusing.restoreAsync([mona, octo]);
    refusing.store.saveFailure = KeptSecrets.failure(SecretFailureReason.Unprotected);
    const picked = refusing.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam"), 2));
    await refusing.savedAsync();
    const broken = new Rig();
    broken.keep([mona, octo]);
    await broken.restoreAsync([mona, octo]);
    broken.store.saveFailure = new RangeError("Unexpected.");
    broken.accounts.pick(new AccountPick("dev.azure.com", pathOf("fabrikam"), 2));
    await broken.savedAsync();

    assert.deepEqual([picked, linesOf(refusing.log).at(-1)], [2,
      "The Azure DevOps accounts couldn't be kept on this computer; added accounts and chosen accounts last until the app closes."]);
    assert.match(linesOf(broken.log).at(-1) ?? "", /RangeError: Unexpected\./);
  });

  it("lets an added account leave and passes on a sign-in that fails unexpectedly", async () => {
    const rig = new Rig();
    await rig.restoreAsync([]);
    const unexpected = new RangeError("Unexpected.");

    const failure: unknown = await rig.accounts.addAsync(() => Promise.reject(unexpected)).then(() => null, (t: unknown) => t);

    assert.deepEqual([failure, rig.entries(), rig.accounts.isSignedIn, rig.changes.filter(t => t.startsWith("2 "))], [unexpected, [[1, null, null]], false, []]);
  });

  it("reads through a reference with the organization's account when the repository named isn't an Azure DevOps one, or a pick's isn't", async () => {
    const rig = new Rig();
    rig.keep([mona, octo]);
    await rig.restoreAsync([mona, octo]);

    const picked = rig.accounts.pick(new AccountPick("github.com", "fabrikam/web", 2));

    assert.deepEqual([picked, rig.authorizationOf("fabrikam"), rig.authorizationOf("fabrikam", "github.com", "fabrikam/web")],
      [null, basic(`pat-${mona.login}`), basic(`pat-${mona.login}`)]);
  });

  it("passes on a read of the index, or a reading of it, that fails other than as the secrets' or the JSON's failure", async () => {
    const unexpected = new RangeError("Unexpected.");
    const refusing = new Rig();
    refusing.store.readFailure = unexpected;
    const readFailure: unknown = await refusing.accounts.restoreAsync().then(() => null, (t: unknown) => t);
    const broken = new Rig();
    broken.keep([mona, hubot]);
    vi.spyOn(JsonReader, "parseValue").mockImplementationOnce(() => {
      throw unexpected;
    });
    const parseFailure: unknown = await broken.accounts.restoreAsync().then(() => null, (t: unknown) => t);

    assert.deepEqual([readFailure, parseFailure, refusing.changes, broken.changes, linesOf(refusing.log)], [unexpected, unexpected, [], [], []]);
  });

  it("logs a restore that fails unexpectedly once a window connects", async () => {
    const rig = new Rig();
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    await rig.accounts.restoreAsync();

    rig.store.readFailure = new RangeError("Unexpected.");
    rig.appWindows.raiseChanged();
    await rig.savedAsync();

    assert.ok(linesOf(rig.log).includes("The Azure DevOps sign-in stopped on an unexpected failure: RangeError: Unexpected."));
  });

  it("does nothing with an index whose read ends after it was disposed", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    const release = rig.store.holdRead();

    const restoring = rig.accounts.restoreAsync();
    rig.accounts.dispose();
    release();
    await restoring;

    assert.deepEqual([rig.accounts.list.accounts.map(t => t.id), rig.changes, rig.azure.requests.length], [[1], [], 0]);
  });

  it("stops every account and its changes once disposed", async () => {
    const rig = new Rig();
    rig.keep([mona, hubot]);
    rig.store.readFailure = KeptSecrets.failure(SecretFailureReason.NotConnected);
    await rig.accounts.restoreAsync();

    rig.accounts.dispose();
    await rig.accounts.restoreAsync();

    assert.deepEqual([rig.appWindows.activeCallsOf("onChanged").length, rig.changes.length], [0, 0]);
  });
});

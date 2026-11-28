/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostAccountEntry, HostAccountList, HostSignIn } from "@noldova/git.hosting.protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountEvents } from "../../../src/app/services/account-events.ts";

describe("AccountEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes each account list the event carries on until it is stopped", () => {
    const context = new FakeWindowPartContext();
    const shown: HostAccountList[] = [];
    const list = new HostAccountList([new HostAccountEntry(1, HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, [])), "dev.azure.com/fabrikam"),
      new HostAccountEntry(2, HostSignIn.signedOut())]);

    const stop = AccountEvents.follow(context, t => void shown.push(t));
    context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, list.toJson());
    stop();
    context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, new HostAccountList([]).toJson());

    expect([shown.map(t => t.toJson()), context.activeCallsOf("onEvent")]).toEqual([[list.toJson()], []]);
  });

  it("logs an event it can't read as an account list and passes nothing on", () => {
    const context = new FakeWindowPartContext();
    const shown: HostAccountList[] = [];
    AccountEvents.follow(context, t => void shown.push(t));

    context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, { accounts: [{ id: 1, signIn: { state: "Unknown" } }] });

    expect(shown).toEqual([]);
    expect(context.callsOf("log").map(t => String(t[0]).startsWith("The Azure DevOps module's git-azure-devops.accountsChanged event couldn't be read: "))).toEqual([true]);
  });

  it("rethrows an error other than a malformed payload while it reads the event, rather than logging it", () => {
    const context = new FakeWindowPartContext();
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(HostAccountList, "fromJson").mockImplementation(() => {
      throw unexpected;
    });
    AccountEvents.follow(context, () => undefined);

    expect(() => context.raiseEvent(AzureDevOpsNames.accountsChangedEvent, new HostAccountList([]).toJson())).toThrow(unexpected);
    expect(context.callsOf("log")).toEqual([]);
  });
});

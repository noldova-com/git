/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignInEvents } from "../../../src/app/services/sign-in-events.ts";

describe("SignInEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes each sign-in the event carries on until it is stopped", () => {
    const context = new FakeWindowPartContext();
    const shown: HostSignIn[] = [];
    const signedIn = HostSignIn.signedIn(new HostAccount("monalisa@example.com", "Mona Lisa", null, []));

    const stop = SignInEvents.follow(context, t => void shown.push(t));
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, signedIn.toJson());
    stop();
    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());

    expect([shown, context.activeCallsOf("onEvent")]).toEqual([[signedIn], []]);
  });

  it("logs an event it can't read as a sign-in and passes nothing on", () => {
    const context = new FakeWindowPartContext();
    const shown: HostSignIn[] = [];
    SignInEvents.follow(context, t => void shown.push(t));

    context.raiseEvent(AzureDevOpsNames.signInChangedEvent, { state: "Unknown" });

    expect(shown).toEqual([]);
    expect(context.callsOf("log").map(t => String(t[0]).startsWith("The Azure DevOps module's git-azure-devops.signInChanged event couldn't be read: ")))
      .toEqual([true]);
  });

  it("rethrows an error other than a malformed payload while it reads the event, rather than logging it", () => {
    const context = new FakeWindowPartContext();
    const unexpected = new RangeError("Unexpected.");
    vi.spyOn(HostSignIn, "fromJson").mockImplementation(() => {
      throw unexpected;
    });
    SignInEvents.follow(context, () => undefined);

    expect(() => context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson())).toThrow(unexpected);
    expect(context.callsOf("log")).toEqual([]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { AccountSettings } from "../../../src/app/services/account-settings.ts";
import { UnhandledRejections } from "../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../fixtures/window-failure.fixture.ts";

describe("AccountSettings", () => {
  it("opens Settings at Accounts and hosts", async () => {
    const context = new FakeWindowPartContext();
    let opened: () => void = () => undefined;
    const ran: Promise<void> = new Promise(resolve => {
      opened = resolve;
    });
    context.answer("runCommandAsync", async () => {
      opened();
      return null;
    });

    AccountSettings.open(context);
    await ran;

    expect([context.callsOf("runCommandAsync"), context.callsOf("log")]).toEqual([[["desktop.openSettings", { page: "git.accounts" }]], []]);
  });

  it("logs a Settings page the window can't open", async () => {
    const context = new FakeWindowPartContext();
    let logged: () => void = () => undefined;
    const done: Promise<void> = new Promise(resolve => {
      logged = resolve;
    });
    context.answer("runCommandAsync", async () => {
      throw new WindowFailure("No settings.");
    });
    context.answer("log", () => {
      logged();
    });

    AccountSettings.open(context);
    await done;

    expect(context.callsOf("log").map(t => t[0])).toEqual(["The Azure DevOps module's desktop.openSettings request failed: WindowFailure: No settings."]);
  });

  it("rethrows a failure to open Settings that isn't the window's", async () => {
    const context = new FakeWindowPartContext();
    const rejection: Promise<unknown> = UnhandledRejections.nextAsync();
    context.answer("runCommandAsync", async () => {
      throw new RangeError("Unexpected.");
    });

    AccountSettings.open(context);

    expect([await rejection, context.callsOf("log")]).toEqual([new RangeError("Unexpected."), []]);
  });
});

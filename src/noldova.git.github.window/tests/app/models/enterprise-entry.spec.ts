/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HostAccount, HostSignIn } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { EnterpriseEntry } from "../../../src/app/models/enterprise-entry.ts";
import { SignedInEnterprise } from "../../../src/app/models/signed-in-enterprise.ts";

describe("EnterpriseEntry", () => {
  it("holds a GitHub Enterprise account's id, server and sign-in, and a signed-in one its person", () => {
    const person = new HostAccount("monalisa", null, null, ["repo"]);
    const entry = new EnterpriseEntry(2, "ghe.example.com", HostSignIn.signedIn(person));
    const signedIn = new SignedInEnterprise(entry, person);

    expect([entry.id, entry.host, entry.signIn, signedIn.entry, signedIn.person]).toEqual([2, "ghe.example.com", HostSignIn.signedIn(person), entry, person]);
  });
});

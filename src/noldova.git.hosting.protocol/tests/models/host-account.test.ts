/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostAccount } from "../../src/api/index.ts";

const avatar: string = "data:image/png;base64,iVBORw0KGgo=";
const account: HostAccount = new HostAccount("octocat", "The Octocat", avatar, ["repo"]);

describe("HostAccount", () => {
  it("takes no display name and no avatar, and refuses a blank login, name or scope and an avatar that isn't a data image it takes", () => {
    const unnamed: HostAccount = new HostAccount("octocat", null, null, []);
    const expected = { name: "HostingArgumentException", parameterName: "avatar",
      message: "The argument avatar is invalid: expected a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address." };

    assert.deepEqual([HostAccount.fromJson(unnamed.toJson()), unnamed.toJson()], [unnamed, { login: "octocat", name: null, avatar: null, scopes: [] }]);
    assert.deepEqual(HostAccount.fromJson(account.toJson()).avatar, avatar);
    assert.throws(() => new HostAccount("", null, avatar, []), { name: "HostingArgumentException", parameterName: "login" });
    assert.throws(() => new HostAccount("octocat", " ", avatar, []), { name: "HostingArgumentException", parameterName: "name" });
    for (const refused of ["https://avatars.githubusercontent.com/u/583231", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,",
      `data:image/png;base64,${"A".repeat(87_388)}`])
      assert.throws(() => new HostAccount("octocat", null, refused, []), expected);
    assert.throws(() => HostAccount.fromJson({ ...unnamed.toJson(), avatar: "avatar.png" }), { name: "HostingFieldException", field: "$.avatar" });
    assert.throws(() => HostAccount.fromJson({ login: "octocat", name: null, avatarUrl: "https://avatars.githubusercontent.com/u/583231", scopes: [] }),
      { name: "HostingFieldException", field: "$.avatarUrl" });
    assert.throws(() => new HostAccount("octocat", null, avatar, ["repo", ""]), { name: "HostingArgumentException", parameterName: "scopes" });
    assert.throws(() => HostAccount.fromJson({ ...unnamed.toJson(), login: "" }, "$.account"), { name: "HostingFieldException", field: "$.account.login" });
  });

  it("keeps its own copy of the scopes", () => {
    const scopes: string[] = ["repo"];
    const kept: HostAccount = new HostAccount("octocat", null, null, scopes);
    scopes.push("workflow");

    assert.deepEqual(kept.scopes, ["repo"]);
  });
});

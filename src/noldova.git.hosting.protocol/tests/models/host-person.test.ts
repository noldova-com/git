/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostPerson } from "../../src/api/index.ts";

const avatar: string = "data:image/png;base64,iVBORw0KGgo=";
const author: HostPerson = new HostPerson("octocat", avatar, null);

describe("HostPerson", () => {
  it("takes no avatar and no profile page and returns itself as JSON that reads back the same", () => {
    const plain: HostPerson = new HostPerson("monalisa", null, null);

    assert.deepEqual(plain.toJson(), { login: "monalisa", avatar: null, url: null });
    assert.deepEqual(HostPerson.fromJson(plain.toJson()), plain);
    assert.deepEqual(HostPerson.fromJson(author.toJson()), author);
  });

  it("takes the profile page as an https address and returns it in its JSON", () => {
    const app: HostPerson = new HostPerson("greeting-helper", avatar, "https://github.com/apps/greeting-helper");

    assert.deepEqual(app.toJson(), { login: "greeting-helper", avatar, url: "https://github.com/apps/greeting-helper" });
    assert.deepEqual(HostPerson.fromJson(app.toJson()), app);
  });

  it("takes the name the person shows and writes it in its JSON only when there is one", () => {
    const named: HostPerson = new HostPerson("monalisa@fabrikam.com", null, null, undefined, "Mona Lisa");

    assert.deepEqual([named.name, named.toJson(), HostPerson.fromJson(named.toJson()), HostPerson.fromJson({ login: "monalisa", avatar: null, url: null }).name],
      ["Mona Lisa", { login: "monalisa@fabrikam.com", avatar: null, url: null, name: "Mona Lisa" }, named, null]);
  });

  it("takes a PNG, JPEG, GIF or WebP avatar as a base64 data address of up to 64 KiB", () => {
    const avatars: readonly string[] = ["png", "jpeg", "gif", "webp"].map(t => `data:image/${t};base64,R0lGODlhAQABAAAAACw=`);
    const largest: string = `data:image/png;base64,${"A".repeat(87_384)}`;

    assert.deepEqual([...avatars, largest].map(t => HostPerson.fromJson(new HostPerson("octocat", t, null).toJson()).avatar), [...avatars, largest]);
  });

  it("refuses a blank login or name, an avatar that isn't a data image it takes and a profile page that isn't https, naming the parameter", () => {
    const expected = { name: "HostingArgumentException", parameterName: "avatar",
      message: "The argument avatar is invalid: expected a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address." };
    const refused: readonly string[] = ["https://avatars.githubusercontent.com/u/583231", "data:image/svg+xml;base64,PHN2Zy8+",
      "data:image/png,iVBORw0KGgo=", "data:image/png;base64,", "data:image/png;base64,iVBORw0KGgo", "data:image/png;base64,iVBOR w0KGgo=",
      "data:text/html;base64,PGI+", `data:image/png;base64,${"A".repeat(87_388)}`, " data:image/png;base64,iVBORw0KGgo="];

    assert.throws(() => new HostPerson(" ", avatar, null), HostingArgumentException);
    assert.throws(() => new HostPerson(" ", avatar, null), { name: "HostingArgumentException", parameterName: "login" });
    for (const value of refused)
      assert.throws(() => new HostPerson("octocat", value, null), expected, value);
    for (const value of ["http://github.com/octocat", "github.com/octocat", " "])
      assert.throws(() => new HostPerson("octocat", null, value), { name: "HostingArgumentException", parameterName: "url" }, value);
    assert.throws(() => new HostPerson("octocat", null, null, undefined, " "), { name: "HostingArgumentException", parameterName: "name" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    assert.throws(() => HostPerson.fromJson({ ...author.toJson(), email: "octocat@example.com" }), { name: "HostingFieldException", field: "$.email" });
    assert.throws(() => HostPerson.fromJson({ ...author.toJson(), name: "" }), { name: "HostingFieldException", field: "$.name" });
    assert.throws(() => HostPerson.fromJson({ login: "", avatar: null, url: null }, "$.author"), { name: "HostingFieldException", field: "$.author.login" });
    assert.throws(() => HostPerson.fromJson({ login: "octocat", avatar: "avatar.png", url: null }), { name: "HostingFieldException", field: "$.avatar" });
    assert.throws(() => HostPerson.fromJson({ login: "octocat", avatar: null, url: "http://github.com/octocat" }), { name: "HostingFieldException", field: "$.url" });
    assert.throws(() => HostPerson.fromJson({ login: "octocat", avatar: null }), { name: "JsonException", path: "$.url" });
    assert.throws(() => HostPerson.fromJson({ login: "octocat", avatarUrl: "https://avatars.githubusercontent.com/u/583231" }), { name: "HostingFieldException", field: "$.avatarUrl" });
  });
});

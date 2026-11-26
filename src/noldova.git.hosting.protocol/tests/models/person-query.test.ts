/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { PersonQuery } from "../../src/api/index.ts";

const query: PersonQuery = new PersonQuery("dev.azure.com", "fabrikam", "MonaLisa@Fabrikam.test");

describe("PersonQuery", () => {
  it("returns its parts as JSON that reads back the same", () => {
    assert.deepEqual(query.toJson(), { host: "dev.azure.com", path: "fabrikam", login: "MonaLisa@Fabrikam.test" });
    assert.deepEqual(PersonQuery.fromJson(JSON.parse(JSON.stringify(query.toJson()))), query);
  });

  it("refuses a blank host or login and a path outside a host's names, naming the parameter", () => {
    assert.throws(() => new PersonQuery(" ", "fabrikam", "monalisa@fabrikam.test"), { name: "HostingArgumentException", parameterName: "host" });
    assert.throws(() => new PersonQuery("dev.azure.com", "fabrikam/..", "monalisa@fabrikam.test"), { name: "HostingArgumentException", parameterName: "path" });
    assert.throws(() => new PersonQuery("dev.azure.com", "fabrikam", "	"), { name: "HostingArgumentException", parameterName: "login" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = query.toJson();

    assert.throws(() => PersonQuery.fromJson({ ...json, email: "monalisa@fabrikam.test" }), { name: "HostingFieldException", field: "$.email" });
    assert.throws(() => PersonQuery.fromJson({ ...json, login: "" }, "$.query"), { name: "HostingFieldException", field: "$.query.login" });
    assert.throws(() => PersonQuery.fromJson({ ...json, login: null }), { name: "JsonException", path: "$.login" });
  });
});

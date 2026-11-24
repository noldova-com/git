/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { FoundPerson } from "../../src/models/found-person.ts";

describe("FoundPerson", () => {
  it("answers a person or a group as the window reads it: its descriptor, name, login and whether it is a group", () => {
    const person = new FoundPerson("aad.TW9uYQ", "Mona Lisa", "monalisa@fabrikam.com", false);
    const group = new FoundPerson("vssgp.V2Vi", "Web Team", "[Web Site]\\Web Team", true);

    assert.deepEqual([person.toJson(), group.toJson()], [
      { descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.com", isGroup: false },
      { descriptor: "vssgp.V2Vi", name: "Web Team", login: "[Web Site]\\Web Team", isGroup: true }]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { FoundPerson } from "../../../src/app/models/found-person.ts";

describe("FoundPerson", () => {
  it("reads the people of a searchPeople answer", () => {
    expect(FoundPerson.listOf([{ descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.test", isGroup: false },
      { descriptor: "vssgp.V2Vi", name: "Web Team", login: "[Web Site]\\Web Team", isGroup: true }]))
      .toEqual([new FoundPerson("aad.TW9uYQ", "Mona Lisa", "monalisa@fabrikam.test", false), new FoundPerson("vssgp.V2Vi", "Web Team", "[Web Site]\\Web Team", true)]);
  });

  it("refuses an answer that isn't a list, or a person without a descriptor, name, login or kind, naming its place", () => {
    for (const answer of [null, { people: [] }])
      expect(() => FoundPerson.listOf(answer)).toThrow(expect.objectContaining({ name: "JsonException", path: "$.answer" }));
    for (const field of ["descriptor", "name", "login"])
      expect(() => FoundPerson.listOf([{ descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.test", isGroup: false, [field]: " " }]))
        .toThrow(expect.objectContaining({ name: "JsonException", path: `$.answer.0.${field}` }));
    expect(() => FoundPerson.listOf([{ descriptor: "aad.TW9uYQ", name: "Mona Lisa", login: "monalisa@fabrikam.test", isGroup: "no" }]))
      .toThrow(expect.objectContaining({ name: "JsonException", path: "$.answer.0.isGroup" }));
  });
});

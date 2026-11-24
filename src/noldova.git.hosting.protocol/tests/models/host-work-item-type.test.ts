/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostWorkItemType } from "../../src/api/index.ts";

const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");

describe("HostWorkItemType", () => {
  it("takes a name, a six-digit color and an icon's name, and returns itself as JSON that reads back the same", () => {
    assert.deepEqual(story.toJson(), { name: "User Story", color: "009CCC", icon: "icon_book" });
    assert.deepEqual(HostWorkItemType.fromJson(story.toJson()), story);
  });

  it("refuses a blank name, a color that isn't six hexadecimal digits and an icon that isn't a name, naming the parameter", () => {
    assert.throws(() => new HostWorkItemType(" ", "009CCC", "icon_book"), { name: "HostingArgumentException", parameterName: "name" });
    for (const color of ["#009CCC", "09C", "00GCCC"])
      assert.throws(() => new HostWorkItemType("Bug", color, "icon_insect"),
        { name: "HostingArgumentException", parameterName: "color", message: "The argument color is invalid: expected a color of six hexadecimal digits." });
    assert.throws(() => new HostWorkItemType("Bug", "CC293D", "../icon"), { name: "HostingArgumentException", parameterName: "icon" });
  });

  it("refuses JSON with a field it doesn't define, naming the field by its path", () => {
    assert.throws(() => HostWorkItemType.fromJson({ ...story.toJson(), url: "x" }, "$.type"), { name: "HostingFieldException", field: "$.type.url" });
  });

  it("refuses JSON whose color or icon is invalid, naming the field by its path rather than the parameter", () => {
    assert.throws(() => HostWorkItemType.fromJson({ ...story.toJson(), color: "09C" }, "$.type"), { name: "HostingFieldException", field: "$.type.color" });
    assert.throws(() => HostWorkItemType.fromJson({ ...story.toJson(), icon: "../icon" }, "$.type"), { name: "HostingFieldException", field: "$.type.icon" });
  });
});

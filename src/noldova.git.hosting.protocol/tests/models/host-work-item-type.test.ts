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
const svg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#009CCC" d="M2 2h12v12H2z"/></svg>';

describe("HostWorkItemType", () => {
  it("takes a name, a six-digit color and an icon's name, and returns itself as JSON that reads back the same", () => {
    assert.deepEqual(story.toJson(), { name: "User Story", color: "009CCC", icon: "icon_book", image: null });
    assert.deepEqual(HostWorkItemType.fromJson(story.toJson()), story);
  });

  it("holds the icon as the host draws it, SVG with or without an XML declaration, reads it back from JSON, and reads JSON without it as none", () => {
    const drawn: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book", svg);
    const declared: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book", `<?xml version="1.0" encoding="utf-8"?>\n${svg}`);

    assert.deepEqual([drawn.image, HostWorkItemType.fromJson(drawn.toJson()), HostWorkItemType.fromJson(declared.toJson()).image],
      [svg, drawn, declared.image]);
    assert.equal(HostWorkItemType.fromJson({ name: "User Story", color: "009CCC", icon: "icon_book" }).image, null);
  });

  it("refuses an image that isn't SVG or is longer than 65536 characters, naming the parameter or the field by its path", () => {
    for (const image of ["", "<html><svg></svg></html>", "<svgx>", `${svg.slice(0, -6)}${" ".repeat(65_536)}</svg>`])
      assert.throws(() => new HostWorkItemType("Bug", "CC293D", "icon_insect", image),
        { name: "HostingArgumentException", parameterName: "image", message: "The argument image is invalid: expected an SVG image of at most 65536 characters." });
    assert.throws(() => HostWorkItemType.fromJson({ ...story.toJson(), image: "<img>" }, "$.type"), { name: "HostingFieldException", field: "$.type.image" });
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

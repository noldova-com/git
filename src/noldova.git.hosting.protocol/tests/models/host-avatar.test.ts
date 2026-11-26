/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostAvatar } from "../../src/api/index.ts";

describe("HostAvatar", () => {
  it("returns a picture or none as JSON that reads back the same", () => {
    for (const avatar of ["data:image/png;base64,iVBORw0KGgo=", null]) {
      const answer: HostAvatar = new HostAvatar(avatar);

      assert.deepEqual(answer.toJson(), { avatar });
      assert.deepEqual(HostAvatar.fromJson(JSON.parse(JSON.stringify(answer.toJson()))), answer);
    }
  });

  it("refuses a picture that isn't an image's base64 data address and JSON with a field it doesn't define, naming the field by its path", () => {
    assert.throws(() => new HostAvatar("https://avatars.githubusercontent.com/u/1"), {
      name: "HostingArgumentException", parameterName: "avatar",
      message: "The argument avatar is invalid: expected a PNG, JPEG, GIF or WebP image of at most 64 KiB as a base64 data address."
    });
    assert.throws(() => HostAvatar.fromJson({ avatar: "data:image/svg+xml;base64,PHN2Zz4=" }, "$.answer"), { name: "HostingFieldException", field: "$.answer.avatar" });
    assert.throws(() => HostAvatar.fromJson({ avatar: null, size: 64 }), { name: "HostingFieldException", field: "$.size" });
    assert.throws(() => HostAvatar.fromJson({}), { name: "JsonException", path: "$.avatar" });
  });
});

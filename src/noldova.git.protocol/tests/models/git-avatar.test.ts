/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { GitAvatar } from "../../src/models/git-avatar.ts";

describe("GitAvatar", () => {
  it("keeps an image or none, and reads back the same", () => {
    for (const image of ["data:image/png;base64,iVBORw0KGgo=", "data:image/webp;base64,UklGRg==", null]) {
      const avatar = new GitAvatar(image);

      assert.deepEqual(avatar.toJson(), { image });
      assert.deepEqual(GitAvatar.fromJson(JSON.parse(JSON.stringify(avatar.toJson()))), avatar);
    }
  });

  it("takes an image of up to 90000 characters and refuses a longer one, another type, a web address or broken base64, naming its path", () => {
    const longest = `data:image/gif;base64,${"A".repeat(90_000 - 22)}`;

    assert.equal(new GitAvatar(longest).image, longest);
    assert.throws(() => new GitAvatar(`${longest}A`), {
      name: "ProtocolFieldException", field: "image",
      message: "The field image is invalid: expected a PNG, JPEG, GIF or WebP image as a base64 data address of at most 90000 characters, or null."
    });
    for (const image of ["data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/a.png", "data:image/png;base64,a b", "data:image/png;base64,"])
      assert.throws(() => GitAvatar.fromJson({ image }, "$.answer"), { name: "ProtocolFieldException", field: "$.answer.image" });
    assert.throws(() => GitAvatar.fromJson({}), { name: "JsonException", path: "$.image" });
    assert.throws(() => GitAvatar.fromJson({ image: null, size: 64 }), { name: "ProtocolFieldException", field: "$.size" });
  });
});

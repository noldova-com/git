/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RedirectAnswer } from "../../src/models/redirect-answer.ts";

describe("RedirectAnswer", () => {
  it("holds the browser's answer to the sign-in: a code when the person signed in, or the error Microsoft named", () => {
    const signedIn = new RedirectAnswer("code-1", null);
    const refused = new RedirectAnswer(null, "access_denied");

    assert.deepEqual([[signedIn.code, signedIn.error], [refused.code, refused.error]], [["code-1", null], [null, "access_denied"]]);
  });
});

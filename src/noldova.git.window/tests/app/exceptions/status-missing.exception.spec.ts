/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { StatusMissingException } from "../../../src/app/exceptions/status-missing.exception.ts";

describe("StatusMissingException", () => {
  it("says the view has no status to read a diff against, with no cause", () => {
    const exception: StatusMissingException = new StatusMissingException();

    expect([exception.message, exception.cause]).toEqual(["The Git view has no status to read a diff against.", undefined]);
  });
});

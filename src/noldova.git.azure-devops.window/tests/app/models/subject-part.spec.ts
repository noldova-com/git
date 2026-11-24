/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SubjectPart } from "../../../src/app/models/subject-part.ts";

describe("SubjectPart", () => {
  it("holds a run of a subject and the work item it names, or null for plain text", () => {
    const parts = [new SubjectPart("AB#42", 42), new SubjectPart(" Fix the greeting", null)];

    expect(parts.map(t => [t.text, t.id])).toEqual([["AB#42", 42], [" Fix the greeting", null]]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ActiveConflict, ConflictState } from "@noldova/code.editor.merge.angular";
import { describe, expect, it } from "vitest";

import { GitConflictDetail } from "../../../src/app/models/git-conflict-detail.ts";

describe("GitConflictDetail", () => {
  it("holds the active conflict and the marker check's answer", () => {
    const active: ActiveConflict = new ActiveConflict(1, 3, "const base = 0;\n", ConflictState.Unresolved, 10, 14);
    const detail: GitConflictDetail = new GitConflictDetail(active, null, ["src/x.ts"], null);

    expect([detail.active, detail.language, detail.leftoverMarkers, detail.markerFailure]).toEqual([active, null, ["src/x.ts"], null]);
  });

  it("holds no conflict while none is active, and why the marker check failed", () => {
    const detail: GitConflictDetail = new GitConflictDetail(null, null, null, "Git couldn't read src/x.ts.");

    expect([detail.active, detail.language, detail.leftoverMarkers, detail.markerFailure]).toEqual([null, null, null, "Git couldn't read src/x.ts."]);
  });
});

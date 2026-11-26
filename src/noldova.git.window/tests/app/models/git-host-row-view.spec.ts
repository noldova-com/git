/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injector } from "@angular/core";
import { describe, expect, it } from "vitest";

import { GitHostRowView } from "../../../src/app/models/git-host-row-view.ts";

describe("GitHostRowView", () => {
  it("holds the row's component and its injector", () => {
    class RowComponent {}
    const injector: Injector = Injector.create({ providers: [] });
    const view = new GitHostRowView(RowComponent, injector);

    expect(view.component).toBe(RowComponent);
    expect(view.injector).toBe(injector);
  });
});

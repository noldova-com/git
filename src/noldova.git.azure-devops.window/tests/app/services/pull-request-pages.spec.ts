/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { describe, expect, it } from "vitest";

import { PullRequestPages } from "../../../src/app/services/pull-request-pages.ts";

describe("PullRequestPages", () => {
  it("says a pull request's page is in front only while a followed page showing it is the active document", () => {
    const instance = signal("fabrikam/web/7");
    const active = signal(true);
    const unfollow = PullRequestPages.follow(instance, active);
    const other = PullRequestPages.follow(signal("fabrikam/web/8"), signal(false));
    const looks: boolean[] = [PullRequestPages.isActive("fabrikam/web/7"), PullRequestPages.isActive("fabrikam/web/8"), PullRequestPages.isActive("fabrikam/web/9")];
    active.set(false);
    looks.push(PullRequestPages.isActive("fabrikam/web/7"));
    active.set(true);
    instance.set("fabrikam/web/9");
    looks.push(PullRequestPages.isActive("fabrikam/web/7"), PullRequestPages.isActive("fabrikam/web/9"));
    unfollow();
    other();
    looks.push(PullRequestPages.isActive("fabrikam/web/9"));

    expect(looks).toEqual([true, false, false, false, false, true, false]);
  });
});

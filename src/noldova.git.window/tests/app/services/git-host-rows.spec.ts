/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import type { IGitHostRow } from "../../../src/app/interfaces/i-git-host-row.ts";
import { GitHostRows } from "../../../src/app/services/git-host-rows.ts";

@Component({ selector: "nol-git-test-row", template: "" })
class TestRowComponent {
}

describe("GitHostRows", () => {
  const github: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
  const plain: GitRemote = new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh);

  it("gives the first added row that claims the remote, and none once it is removed", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const first: IGitHostRow = { claims: t => t.host === "github.com", component: TestRowComponent };
    const second: IGitHostRow = { claims: () => true, component: TestRowComponent };
    const removeFirst: () => void = GitHostRows.provide(context, first);
    const removeSecond: () => void = GitHostRows.provide(context, second);

    const found: (IGitHostRow | undefined)[] = [GitHostRows.rowFor(github)?.row, GitHostRows.rowFor(plain)?.row];
    const same: boolean = GitHostRows.rowFor(github) === GitHostRows.rowFor(github);
    removeSecond();
    found.push(GitHostRows.rowFor(plain)?.row);
    removeFirst();
    found.push(GitHostRows.rowFor(github)?.row);

    expect([found, same, GitHostRows.rowFor(plain)]).toEqual([[first, second, undefined, undefined], true, null]);
    expect(GitHostRows.rowFor(github)).toBeNull();
  });

  it("gives each row with the context that provided it", () => {
    const git: FakeWindowPartContext = new FakeWindowPartContext();
    const host: FakeWindowPartContext = new FakeWindowPartContext();
    const removeFirst: () => void = GitHostRows.provide(host, { claims: t => t.host === "github.com", component: TestRowComponent });
    const removeSecond: () => void = GitHostRows.provide(git, { claims: () => true, component: TestRowComponent });

    const contexts = [GitHostRows.rowFor(github)?.context, GitHostRows.rowFor(plain)?.context];
    removeFirst();
    removeSecond();

    expect(contexts[0]).toBe(host);
    expect(contexts[1]).toBe(git);
  });

  it("logs a claim that throws and asks the next row", () => {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    const next: IGitHostRow = { claims: () => true, component: TestRowComponent };
    const removeBroken: () => void = GitHostRows.provide(context, { claims: () => { throw new RangeError("broken"); }, component: TestRowComponent });
    const removeNext: () => void = GitHostRows.provide(context, next);

    const found: IGitHostRow | undefined = GitHostRows.rowFor(github)?.row;
    removeBroken();
    removeNext();

    expect(found).toBe(next);
    expect(context.callsOf("log")).toEqual([["The Git view shows the plain remote line, since a host row's claim failed: RangeError: broken"]]);
  });
});

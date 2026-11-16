/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import assert from "node:assert/strict";

import { describe, test } from "vitest";

import { type IPermissionDetail, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";
import { FailureCode } from "@noldova/git.protocol";

import { RequestTooLargeException } from "../../src/exceptions/request-too-large.exception.ts";
import { WritePermission } from "../../src/models/write-permission.ts";

describe("WritePermission", () => {
  const options = [PermissionOption.AllowOnce, PermissionOption.Deny];
  const detail: IPermissionDetail = { label: "Files", kind: PermissionDetailKind.Code, value: "M a.txt" };
  const refused = (error: unknown): boolean => error instanceof RequestTooLargeException && error.code === FailureCode.Refused;

  test("builds the request as given while it fits Noldova Desktop's limits", () => {
    assert.deepEqual(WritePermission.create("git.commit", "/repo", "Commit 1 file to main", [detail], ToolRisk.Medium, options), {
      action: "git.commit",
      subject: "/repo",
      title: "Commit 1 file to main",
      details: [detail],
      risk: ToolRisk.Medium,
      options
    });
  });

  test("names what Allow always holds for only when the request offers it below High risk", () => {
    const always = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];

    assert.deepEqual(WritePermission.create("git.commit", "/repo", "Commit", [detail], ToolRisk.Medium, always).labels,
      { [PermissionOption.AllowAlways]: "Always allow in this repository" });
    assert.equal(WritePermission.create("git.push", "/repo", "Push", [detail], ToolRisk.High, always).labels, undefined);
    assert.equal(WritePermission.create("git.commit", "/repo", "Commit", [detail], ToolRisk.Medium, options).labels, undefined);
  });

  test("names each hook that will run, or none", () => {
    assert.deepEqual(WritePermission.hooksDetail(["pre-push", "reference-transaction"]),
      { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "pre-push, reference-transaction" });
    assert.deepEqual(WritePermission.hooksDetail([]), { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "None" });
    assert.deepEqual(WritePermission.hooksDetail(null), { label: "Hooks that will run", kind: PermissionDetailKind.Text, value: "Unknown: the hooks couldn't be read, so any of them may run" });
  });

  test("names each of the repository's filters that will run", () => {
    assert.deepEqual(WritePermission.filtersDetail(["lfs", "crypt"]), { label: "Filters that will run", kind: PermissionDetailKind.Text, value: "lfs, crypt" });
  });

  test("cuts a title past 200 characters with an ellipsis, never between a surrogate pair", () => {
    const fits = "t".repeat(200);
    assert.equal(WritePermission.create("git.push", "s", fits, [], ToolRisk.High, options).title, fits);

    const plain = WritePermission.create("git.push", "s", "t".repeat(201), [], ToolRisk.High, options).title;
    assert.equal(plain, `${"t".repeat(199)}…`);

    const pair = WritePermission.create("git.push", "s", `${"t".repeat(198)}😀tail`, [], ToolRisk.High, options).title;
    assert.equal(pair, `${"t".repeat(198)}…`);
  });

  test("refuses a request whose subject, details or detail count can't fit, before it is raised", () => {
    assert.ok(WritePermission.create("git.commit", "s".repeat(1024), "t", [], ToolRisk.Medium, options));
    assert.throws(() => WritePermission.create("git.commit", "s".repeat(1025), "t", [], ToolRisk.Medium, options), refused);

    const large = { ...detail, value: "v".repeat(80 * 1024) };
    assert.throws(() => WritePermission.create("git.commit", "s", "t", [large], ToolRisk.Medium, options), refused);

    assert.ok(WritePermission.create("git.commit", "s", "t", Array.from({ length: 64 }, () => detail), ToolRisk.Medium, options));
    assert.throws(() => WritePermission.create("git.commit", "s", "t", Array.from({ length: 65 }, () => detail), ToolRisk.Medium, options), refused);
  });
});

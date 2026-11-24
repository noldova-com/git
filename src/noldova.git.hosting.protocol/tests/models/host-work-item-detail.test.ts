/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingArgumentException, HostingFieldException, HostReference, HostWorkItem, HostWorkItemDetail, HostWorkItemType, WorkItemCategory }
  from "../../src/api/index.ts";

const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
const item: HostWorkItem = new HostWorkItem("git-azure-devops", "fabrikam", "Sample Project", 4821, story, "Export notes as Markdown files", "Active",
  WorkItemCategory.InProgress, "https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/4821", null, "Sample Project\\Sprint 47",
  "Sample Project\\Notes app", 4790);
const pullRequest: HostReference = new HostReference("git-azure-devops", "fabrikam", "portal-web", 482);
const detail: HostWorkItemDetail = new HostWorkItemDetail(item, 5, 6, 8, 1000.5, "Readers see a due date 48 h and 2 h before it is due.",
  [4830, 4831, 4832], [pullRequest], 5, ["users/ana/4821-export-notes-markdown"], true);

function planned(points: number | null, remaining: number | null, completed: number | null, order: number | null): HostWorkItemDetail {
  return new HostWorkItemDetail(item, points, remaining, completed, order, null, [], [], 0, []);
}

function linked(acceptance: string | null, children: readonly number[], commits: number, branches: readonly string[]): HostWorkItemDetail {
  return new HostWorkItemDetail(item, null, null, null, null, acceptance, children, [], commits, branches);
}

describe("HostWorkItemDetail", () => {
  it("returns its work item, plan and links as JSON that reads back the same", () => {
    assert.deepEqual(detail.toJson(), {
      item: item.toJson(), points: 5, remaining: 6, completed: 8, order: 1000.5, acceptance: "Readers see a due date 48 h and 2 h before it is due.",
      children: [4830, 4831, 4832], pullRequests: [pullRequest.toJson()], commits: 5, branches: ["users/ana/4821-export-notes-markdown"],
      isWaiting: true
    });
    assert.deepEqual(HostWorkItemDetail.fromJson(JSON.parse(JSON.stringify(detail.toJson()))), detail);
  });

  it("reads back a detail with nothing planned or linked", () => {
    const bare: HostWorkItemDetail = new HostWorkItemDetail(item, null, null, null, null, null, [], [], 0, []);

    assert.deepEqual(HostWorkItemDetail.fromJson(JSON.parse(JSON.stringify(bare.toJson()))), bare);
    assert.equal(bare.toJson()["isWaiting"], null);
  });

  it("reads back whether a linked pull request waits on review, false and true alike", () => {
    const linkedTo = (isWaiting: boolean): HostWorkItemDetail => new HostWorkItemDetail(item, null, null, null, null, null, [], [pullRequest], 0, [], isWaiting);

    assert.deepEqual([false, true].map(t => HostWorkItemDetail.fromJson(JSON.parse(JSON.stringify(linkedTo(t).toJson()))).isWaiting), [false, true]);
  });

  it("keeps its own copies of the children, pull requests and branches", () => {
    const children: number[] = [4830];
    const pullRequests: HostReference[] = [pullRequest];
    const branches: string[] = ["users/ana/4830"];
    const kept: HostWorkItemDetail = new HostWorkItemDetail(item, null, null, null, null, null, children, pullRequests, 0, branches);

    children.push(4831);
    pullRequests.pop();
    branches.push("main");

    assert.deepEqual([kept.children, kept.pullRequests, kept.branches], [[4830], [pullRequest], ["users/ana/4830"]]);
  });

  it("refuses points or hours below zero or not finite, and an order that isn't finite, naming the parameter", () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => planned(value, null, null, null), { name: "HostingArgumentException", parameterName: "points",
        message: "The argument points is invalid: expected a number, zero or more." });
      assert.throws(() => planned(null, value, null, null), { parameterName: "remaining" });
      assert.throws(() => planned(null, null, value, null), { parameterName: "completed" });
    }
    assert.throws(() => planned(null, null, null, Number.POSITIVE_INFINITY), { parameterName: "order", message: "The argument order is invalid: expected a number." });
    assert.doesNotThrow(() => planned(0, 0.5, 0, -3));
  });

  it("refuses blank acceptance criteria, a commit count that isn't a count and a blank branch, naming the parameter", () => {
    assert.throws(() => linked(" ", [], 0, []), { parameterName: "acceptance" });
    assert.throws(() => linked(null, [], -1, []), { parameterName: "commits" });
    assert.throws(() => linked(null, [], 1.5, []), { parameterName: "commits" });
    assert.throws(() => linked(null, [], 0, [" "]), { parameterName: "branches" });
  });

  it("refuses a child that isn't above zero, a child twice and the work item as its own child", () => {
    const expected = { name: "HostingArgumentException", parameterName: "children",
      message: "The argument children is invalid: expected children, each once and none the work item itself." };

    assert.throws(() => linked(null, [0], 0, []), HostingArgumentException);
    assert.throws(() => linked(null, [4830, 4830], 0, []), expected);
    assert.throws(() => linked(null, [4821], 0, []), expected);
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = detail.toJson();

    assert.throws(() => HostWorkItemDetail.fromJson({ ...json, title: "x" }), HostingFieldException);
    assert.throws(() => HostWorkItemDetail.fromJson({ ...json, remaining: -2 }, "$.items.0"), { name: "HostingFieldException", field: "$.items.0.remaining" });
    assert.throws(() => HostWorkItemDetail.fromJson({ ...json, item: { ...item.toJson(), id: 0 } }), { name: "HostingFieldException", field: "$.item.id" });
    assert.throws(() => HostWorkItemDetail.fromJson({ ...json, pullRequests: [{ ...pullRequest.toJson(), number: 0 }] }),
      { name: "HostingFieldException", field: "$.pullRequests.0.number" });
    assert.throws(() => HostWorkItemDetail.fromJson({ ...json, points: "5" }), { name: "JsonException", path: "$.points" });
    assert.throws(() => HostWorkItemDetail.fromJson({ ...json, isWaiting: "yes" }), { name: "JsonException", path: "$.isWaiting" });
  });
});

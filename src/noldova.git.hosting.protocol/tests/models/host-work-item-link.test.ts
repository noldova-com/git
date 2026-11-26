/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { HostingFieldException, HostWorkItemLink, HostWorkItemType, WorkItemCategory } from "../../src/api/index.ts";

const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");
const url: string = "https://dev.azure.com/fabrikam/_workitems/edit/7521";

describe("HostWorkItemLink", () => {
  it("returns its id, title, type, state, state category and page as JSON that reads back the same", () => {
    const link: HostWorkItemLink = new HostWorkItemLink(7521, "Export notes as Markdown files", story, "Active", WorkItemCategory.InProgress, url);

    assert.deepEqual(link.toJson(), { id: 7521, title: "Export notes as Markdown files", type: story.toJson(), state: "Active", category: "InProgress", url });
    assert.deepEqual(HostWorkItemLink.fromJson(JSON.parse(JSON.stringify(link.toJson()))), link);
  });

  it("refuses an id below one, a blank title or state and a page that isn't https, naming the parameter", () => {
    assert.throws(() => new HostWorkItemLink(0, "Fix", story, "Active", WorkItemCategory.InProgress, url), { name: "HostingArgumentException", parameterName: "id" });
    assert.throws(() => new HostWorkItemLink(1, " ", story, "Active", WorkItemCategory.InProgress, url), { name: "HostingArgumentException", parameterName: "title" });
    assert.throws(() => new HostWorkItemLink(1, "Fix", story, "", WorkItemCategory.InProgress, url), { name: "HostingArgumentException", parameterName: "state" });
    assert.throws(() => new HostWorkItemLink(1, "Fix", story, "Active", WorkItemCategory.InProgress, "http://dev.azure.com/x"), { name: "HostingArgumentException", parameterName: "url" });
  });

  it("refuses JSON with a field it doesn't define or out of its range, naming the field by its path", () => {
    const json = new HostWorkItemLink(1, "Fix", story, "Active", WorkItemCategory.InProgress, url).toJson();

    assert.throws(() => HostWorkItemLink.fromJson({ ...json, assignee: null }), HostingFieldException);
    assert.throws(() => HostWorkItemLink.fromJson({ ...json, id: -4 }, "$.workItems.0"), { name: "HostingFieldException", field: "$.workItems.0.id" });
    assert.throws(() => HostWorkItemLink.fromJson({ ...json, type: { ...story.toJson(), color: "blue" } }), { name: "HostingFieldException", field: "$.type.color" });
    assert.throws(() => HostWorkItemLink.fromJson({ ...json, state: 1 }), { name: "JsonException", path: "$.state" });
    assert.throws(() => HostWorkItemLink.fromJson({ ...json, category: "Doing" }), { name: "JsonException", path: "$.category" });
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { GitWorkspace } from "../../../src/app/models/git-workspace.ts";

describe("GitWorkspace", () => {
  const workspace: GitWorkspace = new GitWorkspace("w1", "Sites", ["/a", "/b", "/c", "/d"]);

  it("reads a stored workspace, dropping a folder listed twice, and writes it back", () => {
    const read: GitWorkspace = GitWorkspace.fromJson(JsonReader.fromValue({ id: "w1", name: "Sites", folders: ["/a", "/b", "/a"] }));

    expect(read.toJson()).toEqual({ id: "w1", name: "Sites", folders: ["/a", "/b"] });
  });

  it("refuses a stored workspace with a blank name or no folders", () => {
    expect(() => GitWorkspace.fromJson(JsonReader.fromValue({ id: "w1", name: " ", folders: [] }))).toThrow();
    expect(() => GitWorkspace.fromJson(JsonReader.fromValue({ id: "w1", name: "Sites" }))).toThrow();
  });

  it("renames, adds a folder at the end once, and takes folders off", () => {
    expect(workspace.withName("Apps").toJson()).toEqual({ id: "w1", name: "Apps", folders: ["/a", "/b", "/c", "/d"] });
    expect(workspace.withFolder("/e").folders).toEqual(["/a", "/b", "/c", "/d", "/e"]);
    expect(workspace.withFolder("/b")).toBe(workspace);
    expect(workspace.withoutFolders(new Set(["/b", "/d", "/x"])).folders).toEqual(["/a", "/c"]);
  });

  it("moves folders up or down one place, keeping their order, and leaves one at an end or behind another stuck one where it is", () => {
    expect(workspace.withFoldersMoved(new Set(["/b", "/d"]), -1).folders).toEqual(["/b", "/a", "/d", "/c"]);
    expect(workspace.withFoldersMoved(new Set(["/a", "/b", "/d"]), -1).folders).toEqual(["/a", "/b", "/d", "/c"]);
    expect(workspace.withFoldersMoved(new Set(["/a", "/c"]), 1).folders).toEqual(["/b", "/a", "/d", "/c"]);
    expect(workspace.withFoldersMoved(new Set(["/c", "/d"]), 1).folders).toEqual(["/a", "/b", "/c", "/d"]);
    expect(workspace.withFoldersMoved(new Set(["/x"]), 1).folders).toEqual(["/a", "/b", "/c", "/d"]);
  });
});

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, test, vi } from "vitest";

import { FailureCode, FileChange, GitCode, LineKind } from "@noldova/git.protocol";

import { DiffParser } from "../../src/services/diff.parser.ts";

/** The failure a test expects when git prints what the module can't read. */
interface IUnreadableFailure {
  readonly name: string;
  readonly code: FailureCode;
  readonly gitCode: GitCode;
  readonly message: string;
}

describe("DiffParser", () => {
  const OLD = "a".repeat(40);
  const NEW = "b".repeat(40);
  const NONE = "0".repeat(40);
  const entry = (fields: string, ...paths: readonly string[]): string => [fields, ...paths].map(t => `${t}\0`).join("");
  const output = (entries: readonly string[], patch: string): Buffer => Buffer.from(`${entries.join("")}\0${patch}`);
  const line = (kind: LineKind, oldNumber: number | null, newNumber: number | null, text: string): object => ({ kind, oldNumber, newNumber, text });
  const file = (path: string, change: FileChange, oldMode: string | null, newMode: string | null, hunks: readonly object[], extra: object = {}): object =>
    ({ path, oldPath: path, change, oldMode, newMode, binary: false, submodule: null, hunks, truncated: false, ...extra });
  const json = (value: Buffer, isCut: boolean = false): object => {
    const parsed = DiffParser.parse(value, isCut);
    return { files: parsed.files.map(t => t.toJson()), omittedFiles: parsed.omittedFiles, isCut: parsed.isCut };
  };
  const unreadable = (part: string): IUnreadableFailure =>
    ({ name: "UnreadableOutputException", code: FailureCode.Git, gitCode: GitCode.UnreadableOutput, message: `git diff printed ${part} that the module can't read.` });

  test("reads modified, added, deleted and renamed files, with a rename's similarity score, splitting the patch only at each file's exact header", () => {
    const patch = [
      "diff --git a/a.txt b/a.txt",
      "index 1111111..2222222 100644",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,3 +1,3 @@ function one()",
      " keep\r",
      "-old",
      "+new",
      " diff --git a/new.txt b/new.txt",
      "diff --git a/new.txt b/new.txt",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1 @@",
      "+only",
      "\\ No newline at end of file",
      "diff --git a/gone.bin b/gone.bin",
      "deleted file mode 100644",
      "Binary files a/gone.bin and /dev/null differ",
      "diff --git a/old name.txt b/x b/y.txt",
      "similarity index 90%",
      "rename from old name.txt",
      "rename to x b/y.txt",
      "@@ -2 +2 @@",
      "-b",
      "+c",
      ""
    ].join("\n");

    assert.deepEqual(json(output([
      entry(`:100644 100644 ${OLD} ${NEW} M`, "a.txt"),
      entry(`:000000 100644 ${NONE} ${NEW} A`, "new.txt"),
      entry(`:100644 000000 ${OLD} ${NONE} D`, "gone.bin"),
      entry(`:100644 100644 ${OLD} ${NEW} R090`, "old name.txt", "x b/y.txt")
    ], patch)), {
      files: [
        file("a.txt", FileChange.Modified, "100644", "100644", [{
          oldStart: 1, oldCount: 3, newStart: 1, newCount: 3, header: "function one()", lines: [
            line(LineKind.Context, 1, 1, "keep\r"),
            line(LineKind.Removed, 2, null, "old"),
            line(LineKind.Added, null, 2, "new"),
            line(LineKind.Context, 3, 3, "diff --git a/new.txt b/new.txt")
          ]
        }]),
        file("new.txt", FileChange.Added, null, "100644", [{
          oldStart: 0, oldCount: 0, newStart: 1, newCount: 1, header: "", lines: [line(LineKind.Added, null, 1, "only"), line(LineKind.NoNewlineAtEnd, null, null, "")]
        }]),
        file("gone.bin", FileChange.Deleted, "100644", null, [], { binary: true }),
        file("x b/y.txt", FileChange.Renamed, "100644", "100644", [{
          oldStart: 2, oldCount: 1, newStart: 2, newCount: 1, header: "", lines: [line(LineKind.Removed, 2, null, "b"), line(LineKind.Added, null, 2, "c")]
        }], { oldPath: "old name.txt", similarity: 90 })
      ],
      omittedFiles: 0,
      isCut: false
    });
  });

  test("finds the headers git quotes, keeping a path that isn't UTF-8 as its bytes", () => {
    const strange = Buffer.from([0x74, 0x09, 0x62, 0x5c, 0x01, 0x7f, 0xff]);
    const value = Buffer.concat([
      Buffer.from(entry(`:100644 100644 ${OLD} ${NEW} M`, "café \"q\".txt")),
      Buffer.from(`:100644 100644 ${OLD} ${NEW} M\0`),
      strange,
      Buffer.from("\0\0"),
      Buffer.from(String.raw`diff --git "a/caf\303\251 \"q\".txt" "b/caf\303\251 \"q\".txt"` + "\n@@ -1 +1 @@\n-a\n+b\n"),
      Buffer.from(String.raw`diff --git "a/t\tb\\\001\177\377" "b/t\tb\\\001\177\377"` + "\n@@ -1 +1 @@\n-c\n+d\n")
    ]);

    const files = DiffParser.parse(value, false).files;

    assert.deepEqual(files.map(t => [t.path, t.pathBytes, t.oldPathBytes, t.hunks[0]?.lines.map(l => l.text)]), [
      ["café \"q\".txt", undefined, undefined, ["a", "b"]],
      ["t\tb\\\u0001\u007f�", strange.toString("base64"), strange.toString("base64"), ["c", "d"]]
    ]);
  });

  test("reads a conflict that git shows combined, one it marks unmerged, and the files after them", () => {
    const value = output([
      entry(`::100644 100644 100755 ${OLD} ${NEW} ${NONE} MM`, "both.txt"),
      entry(`:000000 100644 ${NONE} ${NONE} U`, "deleted.txt"),
      entry(`:100644 100644 ${OLD} ${NONE} M`, "a.txt")
    ], "* Unmerged path deleted.txt\ndiff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-a\n+b\n");

    assert.deepEqual(DiffParser.parse(value, false).files.map(t => [t.path, t.change, t.oldMode, t.newMode, t.hunks.length]), [
      ["both.txt", FileChange.Conflict, "100644", "100755", 0],
      ["deleted.txt", FileChange.Conflict, null, "100644", 0],
      ["a.txt", FileChange.Modified, "100644", "100644", 1]
    ]);
  });

  test("ends each file's patch at a combined patch, so a binary conflict can't mark the file before it", () => {
    const modified = (path: string): string => entry(`:100644 100644 ${OLD} ${NONE} M`, path);
    const hunk = (path: string): string => `diff --git a/${path} b/${path}\n@@ -1 +1 @@\n-a\n+b\n`;
    const value = output([entry(`::100644 100644 100644 ${OLD} ${NEW} ${NONE} MM`, "c.bin"), modified("a.txt"), modified("b.txt"), modified("d.txt")],
      `${hunk("a.txt")}${hunk("b.txt")}diff --cc c.bin\nindex 1111111,2222222..0000000\nBinary files differ\n${hunk("d.txt")}`);
    const single = output([entry(`::100644 100644 100644 ${OLD} ${NEW} ${NONE} MM`, "both.txt"), modified("z.txt")],
      `diff --combined both.txt\n@@@ -1,1 -1,1 +1,5 @@@\n++<<<<<<< HEAD\n${hunk("z.txt")}`);

    assert.deepEqual(DiffParser.parse(value, false).files.map(t => [t.path, t.change, t.binary, t.hunks.length]), [
      ["c.bin", FileChange.Conflict, false, 0],
      ["a.txt", FileChange.Modified, false, 1],
      ["b.txt", FileChange.Modified, false, 1],
      ["d.txt", FileChange.Modified, false, 1]
    ]);
    assert.deepEqual(DiffParser.parse(single, false).files.map(t => [t.path, t.hunks.map(h => h.lines.map(l => l.text))]), [["both.txt", []], ["z.txt", [["a", "b"]]]]);
  });

  test("moves a submodule's commits from its patch to its submodule change, taking a missing one from the raw entry", () => {
    const value = output([
      entry(`:160000 160000 ${OLD} ${NONE} M`, "lib"),
      entry(`:000000 160000 ${NONE} ${NEW} A`, "added")
    ], [
      "diff --git a/lib b/lib",
      "@@ -1 +1 @@",
      `-Subproject commit ${OLD}`,
      `+Subproject commit ${NEW}-dirty`,
      "diff --git a/added b/added",
      "new file mode 160000",
      "@@ -0,0 +1 @@",
      `+Subproject commit ${NEW}`,
      ""
    ].join("\n"));

    assert.deepEqual(DiffParser.parse(value, false).files.map(t => [t.path, t.submodule?.toJson(), t.hunks.length]), [
      ["lib", { oldCommit: OLD, newCommit: NEW }, 0],
      ["added", { oldCommit: null, newCommit: NEW }, 0]
    ]);
  });

  test("keeps both halves of a type change, and gives a single file the whole patch whatever its header", () => {
    const typeChange = output([
      entry(`:100644 120000 ${OLD} ${NEW} T`, "link"),
      entry(`:100644 100644 ${OLD} ${NEW} M`, "z.txt")
    ], [
      "diff --git a/link b/link",
      "deleted file mode 100644",
      "@@ -1 +0,0 @@",
      "-text",
      "diff --git a/link b/link",
      "new file mode 120000",
      "@@ -0,0 +1 @@",
      "+target",
      "\\ No newline at end of file",
      "diff --git a/z.txt b/z.txt",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      ""
    ].join("\n"));
    const single = output([entry(`:000000 100644 ${NONE} ${NONE} A`, "new dir/u.txt")], "diff --git a/dev/null b/new dir/u.txt\n@@ -0,0 +1 @@\n+u\n");

    assert.deepEqual(DiffParser.parse(typeChange, false).files.map(t => [t.path, t.change, t.hunks.map(h => h.lines.length)]), [
      ["link", FileChange.TypeChanged, [1, 2]],
      ["z.txt", FileChange.Modified, [2]]
    ]);
    assert.deepEqual(DiffParser.parse(single, false).files.map(t => [t.path, t.hunks[0]?.lines[0]?.text]), [["new dir/u.txt", "u"]]);
    assert.deepEqual(json(Buffer.alloc(0)), { files: [], omittedFiles: 0, isCut: false });
  });

  test("scans each file's own section for combined headers, so the work grows with the output, not with files times output", () => {
    const count = 400;
    const entries = Array.from({ length: count }, (_, index) => entry(`:100644 100644 ${OLD} ${NEW} M`, `f${index}.txt`));
    const patch = Array.from({ length: count }, (_, index) =>
      [`diff --git a/f${index}.txt b/f${index}.txt`, "index 1111111..2222222 100644", `--- a/f${index}.txt`, `+++ b/f${index}.txt`, "@@ -1 +1 @@", "-old", "+new", ""].join("\n")).join("");
    const value = output(entries, patch);
    const spy = vi.spyOn(Buffer.prototype, "indexOf");
    let scanned = 0;
    try {
      assert.equal(DiffParser.parse(value, false).files.length, count);
      scanned = spy.mock.calls.reduce((sum: number, [needle, from]: readonly unknown[], index: number): number => {
        const searched: unknown = spy.mock.contexts[index];
        const result = spy.mock.results[index];
        const at: number = result?.type === "return" && typeof result.value === "number" ? result.value : -1;
        const start: number = typeof from === "number" ? from : 0;
        const length: number = searched instanceof Uint8Array ? searched.length : 0;
        const size: number = typeof needle === "string" || needle instanceof Uint8Array ? needle.length : 1;
        return sum + (at < 0 ? length - start : at - start + size);
      }, 0);
    } finally {
      spy.mockRestore();
    }

    assert.ok(scanned < 8 * value.length, `scanned ${scanned} bytes of ${value.length}`);
  });

  test("reads a cut output, leaving out what it lost and marking the last file it keeps", () => {
    const modified = (path: string): string => entry(`:100644 100644 ${OLD} ${NEW} M`, path);
    const inEntries = Buffer.from(`${modified("a.txt")}:100644 100644 ${OLD} ${NEW} M\0b.t`);
    const inPatch = output([modified("a.txt"), modified("b.txt")], "diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-a\n+b\ndiff --git a/b.txt b/b.txt\n@@ -1,2 +1,2 @@\n-x\n+y\n+cut li");
    const beforeHeader = output([modified("a.txt"), modified("b.txt")], "diff --git a/a.txt b/a.txt\n@@ -1 +1 @@\n-a\n");

    assert.deepEqual(DiffParser.parse(inEntries, true).files.map(t => [t.path, t.truncated]), [["a.txt", true]]);
    assert.deepEqual(DiffParser.parse(Buffer.from(`:100644 100644 ${OLD} ${NEW} R100\0old\0`), true).files, []);
    assert.deepEqual(DiffParser.parse(Buffer.from(":100644 100644"), true).files, []);
    const parsed = DiffParser.parse(inPatch, true);
    assert.deepEqual(parsed.files.map(t => [t.path, t.truncated, t.hunks[0]?.lines.map(l => l.text)]), [["a.txt", false, ["a", "b"]], ["b.txt", true, ["x", "y"]]]);
    assert.equal(parsed.isCut, true);
    assert.deepEqual(json(beforeHeader, true), {
      files: [file("a.txt", FileChange.Modified, "100644", "100644", [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, header: "", lines: [line(LineKind.Removed, 1, null, "a")] }], { truncated: true })],
      omittedFiles: 1,
      isCut: true
    });
  });

  const modifiedA = entry(`:100644 100644 ${OLD} ${NEW} M`, "a.txt");
  for (const [label, value, part] of [
    ["a raw entry it can't read", Buffer.from(entry(":100644 100644 xyz M", "a.txt")), "an entry it can't read"],
    ["a combined entry it can't read", Buffer.from(entry("::bad", "a.txt")), "an entry it can't read"],
    ["text between the entries and the patch", Buffer.from(`${modifiedA}junk`), "an entry it can't read"],
    ["an unknown kind of change", Buffer.from(entry(`:100644 100644 ${OLD} ${NEW} X`, "a.txt")), "an unknown kind of change"],
    ["an entry without its path", Buffer.from(`:100644 100644 ${OLD} ${NEW} M\0a.txt`), "an incomplete entry"],
    ["a rename without its new path", Buffer.from(`:100644 100644 ${OLD} ${NEW} R100\0old\0`), "an incomplete entry"],
    ["an entry without its end", Buffer.from(":100644 100644"), "an incomplete entry"],
    ["a file without its patch", output([modifiedA, entry(`:100644 100644 ${OLD} ${NEW} M`, "b.txt")], "diff --git a/a.txt b/a.txt\n"), "a file without its patch"],
    ["a hunk shorter than its header", output([modifiedA], "diff --git a/a.txt b/a.txt\n@@ -1,2 +1,2 @@\n-x\n+y\n"), "a hunk shorter than its header says"],
    ["a hunk line of an unknown kind", output([modifiedA], "@@ -1 +1 @@\n?x\n"), "a hunk line it can't read"],
    ["an empty hunk line", output([modifiedA], "@@ -1 +1 @@\n\n"), "a hunk line it can't read"],
    ["an added file with an old mode", Buffer.from(entry(`:100644 100644 ${OLD} ${NEW} A`, "a.txt")), "values the diff model refuses"]
  ] as const)
    test(`fails on ${label}, naming it without git's bytes`, () => {
      assert.throws(() => DiffParser.parse(value, false), unreadable(part));
    });
});

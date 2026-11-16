/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

export class FakeGhFixture {
  private static readonly SCRIPT: string = [
    "const [mode, size] = process.argv.slice(2);",
    "const { spawn } = process.getBuiltinModule(\"node:child_process\");",
    "const net = process.getBuiltinModule(\"node:net\");",
    "const again = next => spawn(process.execPath, [process.argv[1], next, size], { cwd: process.getBuiltinModule(\"node:os\").tmpdir(), detached: true, stdio: [\"ignore\", \"inherit\", \"inherit\"], windowsHide: true });",
    "if (mode === \"escape\")",
    "  again(\"escape-middle\").once(\"exit\", () => net.connect(Number(size), \"127.0.0.1\"));",
    "if (mode === \"escape-middle\")",
    "  again(\"escaped\").unref();",
    "if (mode === \"escaped\")",
    "  net.connect(Number(size), \"127.0.0.1\").on(\"error\", () => undefined).on(\"close\", () => process.exit(0));",
    "if (mode === \"hang\")",
    "  setInterval(() => {}, 60_000);",
    "if (mode === \"errors\")",
    "  process.stderr.write(\"e\".repeat(Number(size)));",
    "if (mode === \"print\")",
    "  process.stdout.write(\"printed\\n\");",
    ""
  ].join("\n");

  public static async createAsync(folder: string): Promise<void> {
    const script = path.join(folder, "fake-gh.mjs");
    await writeFile(script, FakeGhFixture.SCRIPT);
    if (process.platform === "win32") {
      await writeFile(path.join(folder, "gh.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
      return;
    }
    const gh = path.join(folder, "gh");
    await writeFile(gh, `#!${process.execPath}\n${FakeGhFixture.SCRIPT}`);
    await chmod(gh, 0o755);
  }
}

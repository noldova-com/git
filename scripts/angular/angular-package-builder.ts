/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AngularCompileFailedException } from "../exceptions/angular-compile-failed.exception.ts";
import { AngularCompileTimeoutException } from "../exceptions/angular-compile-timeout.exception.ts";
import { AngularEntriesMissingException } from "../exceptions/angular-entries-missing.exception.ts";
import { ProcessTimeoutException } from "../exceptions/process-timeout.exception.ts";
import { Resources } from "../resources.ts";
import { PackageBinary } from "../services/package-binary.ts";
import type { ProcessRunner } from "../services/process-runner.ts";

export class AngularPackageBuilder {
  private readonly runner: ProcessRunner;

  public constructor(runner: ProcessRunner) {
    this.runner = runner;
  }

  public async compileAsync(project: string, sources: string, output: string): Promise<void> {
    const entries = path.join(sources, Resources.apiFolder);
    const files = existsSync(entries)
      ? (await readdir(entries)).filter(t => t.endsWith(Resources.typeScriptExtension) && !t.endsWith(Resources.declarationExtension)).sort().map(t => path.join(entries, t))
      : [];
    if (files.length === 0)
      throw new AngularEntriesMissingException(entries);

    const work = await mkdtemp(path.join(os.tmpdir(), Resources.angularWorkPrefix));
    try {
      const configuration = path.join(work, Resources.projectFile);
      await writeFile(configuration, `${JSON.stringify({
        extends: path.join(project, Resources.projectFile),
        compilerOptions: {
          rootDir: sources,
          outDir: output,
          declaration: false,
          sourceMap: true,
          types: []
        },
        angularCompilerOptions: { compilationMode: "partial" },
        files,
        include: []
      }, null, Resources.jsonIndent)}${Resources.lineEnd}`);
      const compiler = await PackageBinary.locateAsync(project, Resources.angularCompilerPackage, Resources.angularCompilerCommand);
      const result = await this.runner.captureAsync(process.execPath, [compiler, Resources.angularProjectOption, configuration], project, Resources.angularCompileTimeoutMilliseconds)
        .catch((error: unknown) => {
          if (error instanceof ProcessTimeoutException)
            throw new AngularCompileTimeoutException(sources, Resources.angularCompileTimeoutMilliseconds, error);
          throw error;
        });
      if (!result.isSuccessful)
        throw new AngularCompileFailedException(sources, result.exitCode, result.text);
    }
    finally {
      await rm(work, { recursive: true, force: true });
    }
  }
}

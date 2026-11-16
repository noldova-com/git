/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PackageCopyCheck } from "../../checks/package-copy-check.ts";
import { ProcessException } from "../../exceptions/process.exception.ts";
import { SingleCopyPackage } from "../../models/single-copy-package.ts";
import { VersionRange } from "../../models/version-range.ts";
import { Resources } from "../../resources.ts";
import { type JsonObject, JsonValue } from "../../services/json-value.ts";
import { NpmCommand } from "../../services/npm-command.ts";
import { ProcessRunner } from "../../services/process-runner.ts";

class InstalledPackage {
  private static readonly root: string = path.resolve(import.meta.dirname, ...Resources.fixtureRootSegments);
  private static readonly scripts: string = path.join(InstalledPackage.root, Resources.fixtureScriptsFolder);

  private readonly runner: ProcessRunner = new ProcessRunner();
  private readonly npm: NpmCommand = new NpmCommand(this.runner, process.env);

  private static async listAsync(folder: string, prefix: string): Promise<readonly string[]> {
    return (await readdir(folder)).filter(t => t.startsWith(prefix) && t.endsWith(Resources.archiveExtension)).sort().map(t => path.join(folder, t));
  }

  private static async emptyAsync(folder: string): Promise<string> {
    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });
    return folder;
  }

  public async runAsync(): Promise<number> {
    const npmPath: string | undefined = process.env[Resources.npmPathVariable];
    if (npmPath === undefined || npmPath.length === 0) {
      console.error(Resources.fixtureNpmMissing);
      return Resources.failureExitCode;
    }
    const archives: readonly string[] = await InstalledPackage.listAsync(path.join(InstalledPackage.root, Resources.archivesFolder), Resources.fixtureArchivePrefix);
    if (archives.length !== Resources.fixtureArchiveCount) {
      console.error(Resources.fixtureArchivesMissing);
      return Resources.failureExitCode;
    }
    const contexts: readonly string[] = await InstalledPackage.readContextsAsync();
    if (contexts.length === 0) {
      console.error(Resources.fixtureContextUnread);
      return Resources.failureExitCode;
    }
    const work: string = await mkdtemp(path.join(tmpdir(), Resources.fixtureWorkPrefix));
    try {
      for (const context of contexts) {
        process.stdout.write(Resources.formatFixtureContext(context));
        const ran: number = await this.installAndOpenAsync(path.join(work, context), npmPath, archives, context);
        if (ran !== Resources.successExitCode)
          return ran;
      }
      return Resources.successExitCode;
    }
    finally {
      await rm(work, { recursive: true, force: true, maxRetries: Resources.fixtureRemoveRetries });
    }
  }

  private static async readContextsAsync(): Promise<readonly string[]> {
    const window: unknown = (await InstalledPackage.readFieldsAsync(Resources.fixtureContextRangeFile))[Resources.peersField];
    const peer: unknown = JsonValue.isObject(window) ? window[Resources.contextCoreName] : undefined;
    const lowest: string | undefined = typeof peer === "string" ? VersionRange.parse(peer)?.lowest : undefined;
    const pins: unknown = (await InstalledPackage.readFieldsAsync(Resources.manifestFile))[Resources.devDependenciesField];
    const pin: unknown = JsonValue.isObject(pins) ? pins[Resources.contextCoreName] : undefined;
    if (lowest === undefined || typeof pin !== "string")
      return [];
    return lowest === pin ? [pin] : [lowest, pin];
  }

  private static async readFieldsAsync(file: string): Promise<JsonObject> {
    const fields: unknown = JsonValue.parseFile(file, await readFile(path.join(InstalledPackage.root, file), Resources.encoding));
    return JsonValue.isObject(fields) ? fields : {};
  }

  private async installAndOpenAsync(work: string, npmPath: string, archives: readonly string[], context: string): Promise<number> {
    const app: string = await InstalledPackage.emptyAsync(path.join(work, Resources.fixtureAppFolder));
    const peers: string = await InstalledPackage.emptyAsync(path.join(work, Resources.fixturePeersFolder));
    for (const name of Resources.fixturePeers) {
      const folder: string = path.join(InstalledPackage.root, Resources.nodeModulesFolder, ...name.split(Resources.pathSeparator));
      const result = await this.npm.runAsync([...Resources.fixturePackArguments, folder], peers);
      if (!result.isSuccessful) {
        console.error(`${result.text}${Resources.lineEnd}${Resources.fixturePeersMissing}`);
        return Resources.failureExitCode;
      }
    }
    const packed: readonly string[] = await InstalledPackage.listAsync(peers, '');
    if (packed.length !== Resources.fixturePeers.length) {
      console.error(Resources.fixturePeersMissing);
      return Resources.failureExitCode;
    }
    for (const file of Resources.fixtureScriptFiles) {
      const target: string = path.join(app, Resources.fixtureScriptsFolder, file);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(InstalledPackage.scripts, file), target);
    }
    await writeFile(path.join(app, Resources.manifestFile), Resources.formatFixtureManifest(context));
    const installed: number = await this.runner.runAsync(process.execPath, [npmPath, ...Resources.fixtureInstallArguments, ...archives, ...packed], app,
      Resources.installTimeoutMilliseconds);
    if (installed !== Resources.successExitCode)
      return installed;
    if (!await new PackageCopyCheck(app, this.npm, SingleCopyPackage.contextCore, Resources.fixturePlace).runAsync(process.stdout))
      return Resources.failureExitCode;
    const peersRead: number = await this.runner.runAsync(process.execPath, [Resources.fixturePeersModule, InstalledPackage.root], app);
    if (peersRead !== Resources.successExitCode)
      return peersRead;
    process.stdout.write(Resources.fixturePeersRead);
    const compiled: number = await this.runner.runAsync(process.execPath,
      [path.join(InstalledPackage.root, ...Resources.typeScriptCompiler), ...Resources.fixtureCompileArguments, Resources.fixtureRuntimeModule], app);
    if (compiled !== Resources.successExitCode)
      return compiled;
    const ran: number = await this.runner.runAsync(process.execPath, [Resources.fixtureRuntimeModule], app);
    if (ran !== Resources.successExitCode)
      return ran;
    process.stdout.write(Resources.fixtureCompiled);
    for (const part of Resources.fixtureRuntimeParts) {
      const opened: number = await this.runner.runAsync(process.execPath, [Resources.fixtureOpenModule, part], app);
      if (opened !== Resources.successExitCode)
        return opened;
    }
    return Resources.successExitCode;
  }
}

try {
  process.exitCode = await new InstalledPackage().runAsync();
}
catch (error) {
  if (!(error instanceof ProcessException))
    throw error;
  console.error(error.message);
  process.exitCode = Resources.failureExitCode;
}

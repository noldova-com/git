/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { ArchiveInstallFailedException } from "../exceptions/archive-install-failed.exception.ts";
import { InstalledVersionMissingException } from "../exceptions/installed-version-missing.exception.ts";
import { JsonFileNotObjectException } from "../exceptions/json-file-not-object.exception.ts";
import { Resources } from "../resources.ts";
import { type JsonObject, JsonValue } from "./json-value.ts";
import type { NpmCommand } from "./npm-command.ts";

export class PackageInstall {
  private readonly root: string;
  private readonly npm: NpmCommand;

  public constructor(root: string, npm: NpmCommand) {
    this.root = root;
    this.npm = npm;
  }

  public async installPackedAsync(): Promise<void> {
    const folder = path.join(this.root, Resources.archivesFolder);
    const archives = (await readdir(folder)).filter(t => t.endsWith(Resources.archiveExtension)).sort().map(t => path.join(folder, t));
    const kept = await this.readInstalledPinsAsync();
    const result = await this.npm.runAsync([...Resources.archiveInstallArguments, ...archives, ...kept], this.root);
    if (!result.isSuccessful)
      throw new ArchiveInstallFailedException(archives.map(t => path.basename(t)), result.exitCode, result.text);
  }

  private async readInstalledPinsAsync(): Promise<readonly string[]> {
    const root = await this.readObjectAsync(path.join(this.root, Resources.manifestFile), Resources.manifestFile);
    const names = new Set<string>();
    for (const field of Resources.rootPinFields) {
      const pins: unknown = root[field];
      if (JsonValue.isObject(pins))
        for (const name of Object.keys(pins).filter(t => t.startsWith(Resources.noldovaPrefix)))
          names.add(name);
    }
    const archives = await this.readLockedArchivesAsync();
    const kept: string[] = [];
    for (const name of [...names].sort()) {
      const file = path.join(this.root, Resources.nodeModulesFolder, ...name.split(Resources.pathSeparator), Resources.manifestFile);
      if (!existsSync(file))
        continue;
      const archive = archives.get(name);
      if (archive !== undefined) {
        kept.push(archive);
        continue;
      }
      const version: unknown = (await this.readObjectAsync(file, file))[Resources.versionField];
      if (typeof version !== "string")
        throw new InstalledVersionMissingException(file);
      kept.push(Resources.formatPackageSpec(name, version));
    }
    return kept;
  }

  private async readLockedArchivesAsync(): Promise<ReadonlyMap<string, string>> {
    const archives = new Map<string, string>();
    const file = path.join(this.root, Resources.lockFile);
    if (!existsSync(file))
      return archives;
    const packages: unknown = (await this.readObjectAsync(file, Resources.lockFile))[Resources.lockPackagesField];
    if (!JsonValue.isObject(packages))
      return archives;
    for (const [key, entry] of Object.entries(packages)) {
      if (!key.startsWith(Resources.lockModulesPrefix) || !JsonValue.isObject(entry))
        continue;
      const resolved: unknown = entry[Resources.lockResolvedField];
      if (typeof resolved === "string" && resolved.startsWith(Resources.fileProtocol))
        archives.set(key.slice(Resources.lockModulesPrefix.length), path.resolve(this.root, resolved.slice(Resources.fileProtocol.length)));
    }
    return archives;
  }

  private async readObjectAsync(file: string, name: string): Promise<JsonObject> {
    const json: unknown = JsonValue.parseFile(name, await readFile(file, Resources.encoding));
    if (!JsonValue.isObject(json))
      throw new JsonFileNotObjectException(name);
    return json;
  }
}

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

// Installs every archive packed so far into the repository's node_modules, as an outside user installs them, so the parts built
// after them and the tests import the packed packages, never their sources. Each install names all of them, since npm removes
// a package the install doesn't name that the lock doesn't list either. It also names the version node_modules holds of each
// @noldova/ package the root package.json pins, since an install otherwise takes the lockfile's version back, and the Module
// range workflow installs Noldova Desktop's newest version in range, and the versions it pins, without saving them.
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
    const kept: string[] = [];
    for (const name of [...names].sort()) {
      const file = path.join(this.root, Resources.nodeModulesFolder, ...name.split(Resources.pathSeparator), Resources.manifestFile);
      if (!existsSync(file))
        continue;
      const version: unknown = (await this.readObjectAsync(file, file))[Resources.versionField];
      if (typeof version !== "string")
        throw new InstalledVersionMissingException(file);
      kept.push(Resources.formatPackageSpec(name, version));
    }
    return kept;
  }

  private async readObjectAsync(file: string, name: string): Promise<JsonObject> {
    const json: unknown = JsonValue.parseFile(name, await readFile(file, Resources.encoding));
    if (!JsonValue.isObject(json))
      throw new JsonFileNotObjectException(name);
    return json;
  }
}

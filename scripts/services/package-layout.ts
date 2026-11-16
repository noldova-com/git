/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PackageUnnamedException } from "../exceptions/package-unnamed.exception.ts";
import type { IModulePackage } from "../interfaces/i-module-package.ts";
import { RepositoryModule } from "../models/repository-module.ts";
import { Resources } from "../resources.ts";
import { JsonValue } from "./json-value.ts";

export class PackageLayout {
  private static readonly folders: readonly string[] = [
    ...RepositoryModule.shared.map(t => t.folder),
    ...RepositoryModule.all.flatMap(t => [t.protocolFolder, t.windowFolder, t.folder])
  ];

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async readPackagesAsync(): Promise<readonly IModulePackage[]> {
    const packages: IModulePackage[] = [];
    for (const folder of PackageLayout.folders) {
      const file = path.posix.join(folder, Resources.manifestFile);
      const manifest: unknown = JsonValue.parseFile(file, await readFile(path.join(this.root, file), Resources.encoding));
      const name: unknown = JsonValue.isObject(manifest) ? manifest[Resources.nameField] : undefined;
      if (typeof name !== "string")
        throw new PackageUnnamedException(file);
      packages.push({ folder, name });
    }
    return packages;
  }
}

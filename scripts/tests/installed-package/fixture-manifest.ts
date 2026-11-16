/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import { InstalledPackageCheckFailedException } from "../../exceptions/installed-package-check-failed.exception.ts";
import { InstalledPackageResources } from "./installed-package-resources.ts";

export class FixtureManifest {
  public readonly version: string;
  public readonly dependencies: Readonly<Record<string, string>>;
  public readonly devDependencies: Readonly<Record<string, string>>;
  public readonly peerDependencies: Readonly<Record<string, string>>;

  private constructor(version: string, dependencies: Readonly<Record<string, string>>, devDependencies: Readonly<Record<string, string>>,
    peerDependencies: Readonly<Record<string, string>>) {
    this.version = version;
    this.dependencies = dependencies;
    this.devDependencies = devDependencies;
    this.peerDependencies = peerDependencies;
  }

  public static async readAsync(file: string): Promise<FixtureManifest> {
    const fields: unknown = JSON.parse(await readFile(file, InstalledPackageResources.encoding));
    if (!FixtureManifest.isFields(fields))
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatManifestInvalid(file));
    const version: unknown = fields[InstalledPackageResources.versionField];
    if (typeof version !== "string")
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatManifestInvalid(file));
    return new FixtureManifest(version, FixtureManifest.readPins(fields, InstalledPackageResources.dependenciesField, file),
      FixtureManifest.readPins(fields, InstalledPackageResources.devDependenciesField, file), FixtureManifest.readPins(fields, InstalledPackageResources.peersField, file));
  }

  private static readPins(fields: Readonly<Record<string, unknown>>, field: string, file: string): Readonly<Record<string, string>> {
    const pins: unknown = fields[field] ?? {};
    if (!FixtureManifest.isPins(pins))
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatPinsInvalid(file, field));
    return pins;
  }

  private static isFields(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static isPins(value: unknown): value is Readonly<Record<string, string>> {
    return FixtureManifest.isFields(value) && Object.values(value).every(t => typeof t === "string");
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { BinaryCommandMissingException } from "../exceptions/binary-command-missing.exception.ts";
import { BinaryManifestMalformedException } from "../exceptions/binary-manifest-malformed.exception.ts";
import { BinaryMissingException } from "../exceptions/binary-missing.exception.ts";
import { Resources } from "../resources.ts";

export class PackageBinary {
  public static async locateAsync(folder: string, packageName: string, command: string): Promise<string> {
    const segments: readonly string[] = [Resources.nodeModulesFolder, ...packageName.split(Resources.pathSeparator), Resources.manifestFile];
    let directory = folder;
    while (!existsSync(path.join(directory, ...segments)) && path.dirname(directory) !== directory)
      directory = path.dirname(directory);
    const manifest = path.join(directory, ...segments);
    if (!existsSync(manifest))
      throw new BinaryMissingException(folder, packageName);
    const commands: unknown = PackageBinary.field(PackageBinary.parse(await readFile(manifest, Resources.encoding), manifest), Resources.binField);
    const script: unknown = PackageBinary.field(commands, command);
    if (typeof script !== "string")
      throw new BinaryCommandMissingException(manifest, command);
    return path.join(path.dirname(manifest), script);
  }

  private static parse(text: string, manifest: string): unknown {
    try {
      return JSON.parse(text);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new BinaryManifestMalformedException(manifest, error);
    }
  }

  private static field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? new Map<string, unknown>(Object.entries(value)).get(key) : undefined;
  }
}

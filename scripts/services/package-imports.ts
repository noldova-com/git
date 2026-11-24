/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { AngularCoreUnpinnedException } from "../exceptions/angular-core-unpinned.exception.ts";
import { ImportUnpinnedException } from "../exceptions/import-unpinned.exception.ts";
import { PackagePins } from "../models/package-pins.ts";
import { RepositoryModule } from "../models/repository-module.ts";
import { Resources } from "../resources.ts";

export class PackageImports {
  private static readonly ownScope: string = RepositoryModule.main.packageName;

  public static async resolveAsync(folder: string, pins: ReadonlyMap<string, string>, version: string, file: string,
    ownPeers: readonly string[] = []): Promise<PackagePins> {
    const dependencies = new Map<string, string>();
    const peers = new Map<string, string>();
    for (const name of await PackageImports.listAsync(folder)) {
      const pin = name.startsWith(`${PackageImports.ownScope}${Resources.dot}`) ? version : pins.get(name);
      if (pin === undefined)
        throw new ImportUnpinnedException(name, file);
      (PackageImports.isPeer(name) || ownPeers.includes(name) ? peers : dependencies).set(name, pin);
    }
    const angular = pins.get(Resources.angularCore);
    if (angular === undefined)
      throw new AngularCoreUnpinnedException(file);
    peers.set(Resources.angularCore, angular);
    return new PackagePins(dependencies, peers);
  }

  private static async listAsync(folder: string): Promise<readonly string[]> {
    const names = new Set<string>();
    for (const file of await readdir(folder, { recursive: true })) {
      const isDeclaration = file.endsWith(Resources.declarationExtension);
      if (!isDeclaration && !file.endsWith(Resources.javaScriptExtension))
        continue;
      const text = await readFile(path.join(folder, file), Resources.encoding);
      for (const match of (isDeclaration ? PackageImports.withoutComments(text) : text).matchAll(Resources.packageImportPattern))
        names.add(String(match[2]));
    }
    return [...names].sort();
  }

  private static withoutComments(text: string): string {
    let code = "";
    let quote: string | null = null;
    for (let index = 0; index < text.length; index++) {
      const character: string = text.charAt(index);
      const next: string = text.charAt(index + 1);
      if (quote !== null) {
        code += character;
        if (character === Resources.escapeCharacter) {
          code += next;
          index++;
        }
        else if (character === quote)
          quote = null;
      }
      else if (character === Resources.commentSlash && next === Resources.commentSlash) {
        const end: number = text.indexOf(Resources.lineEnd, index);
        index = end === -1 ? text.length : end - 1;
      }
      else if (character === Resources.commentSlash && next === Resources.commentStar) {
        const end: number = text.indexOf(Resources.blockCommentEnd, index + 2);
        index = end === -1 ? text.length : end + 1;
      }
      else {
        if (Resources.quotes.includes(character))
          quote = character;
        code += character;
      }
    }
    return code;
  }

  private static isPeer(name: string): boolean {
    return Resources.peerPrefixes.some(t => name.startsWith(t)) || Resources.peerNames.includes(name);
  }
}

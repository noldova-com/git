/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import { NpmListFailedException } from "../exceptions/npm-list-failed.exception.ts";
import { NpmListUnreadableException } from "../exceptions/npm-list-unreadable.exception.ts";
import type { SingleCopyPackage } from "../models/single-copy-package.ts";
import { Resources } from "../resources.ts";
import { JsonValue } from "../services/json-value.ts";
import type { NpmCommand } from "../services/npm-command.ts";

export class PackageCopyCheck {
  private readonly root: string;
  private readonly npm: NpmCommand;
  private readonly single: SingleCopyPackage;
  private readonly place: string;
  private readonly arguments: readonly string[];

  public constructor(root: string, npm: NpmCommand, single: SingleCopyPackage, place: string) {
    this.root = root;
    this.npm = npm;
    this.single = single;
    this.place = place;
    this.arguments = [Resources.npmListCommand, single.name, ...Resources.npmListOptions];
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const result = await this.npm.runAsync(this.arguments, this.root);
    let tree: unknown;
    try {
      tree = JSON.parse(result.output);
    }
    catch (error) {
      if (!(error instanceof SyntaxError))
        throw error;
      throw new NpmListUnreadableException(this.arguments, this.place, result.text, error);
    }
    const failure = PackageCopyCheck.field(tree, Resources.npmListErrorField);
    const code = PackageCopyCheck.field(failure, Resources.npmListCodeField);
    if (failure !== undefined && code !== Resources.npmListProblemsCode)
      throw new NpmListFailedException(this.arguments, this.place, String(code), String(PackageCopyCheck.field(failure, Resources.npmListSummaryField)));
    const copies = new Map<string, string>();
    PackageCopyCheck.collect(tree, this.single.name, copies);
    if (copies.size === 0) {
      output.write(Resources.formatNoCopyFound(this.single.name, this.place));
      return false;
    }
    if (copies.size === 1) {
      output.write(Resources.formatOneCopyFound(this.single.name, this.place));
      return true;
    }
    output.write(Resources.formatCopiesFound(this.place, copies.size, this.single.name, this.single.consequence));
    for (const [folder, version] of [...copies].sort(([left], [right]) => Number(left > right) - Number(left < right)))
      output.write(Resources.formatCopyAt(version, path.relative(this.root, folder).replaceAll(Resources.windowsPathSeparator, Resources.pathSeparator)));
    output.write(`${this.single.remedy}${Resources.lineEnd}`);
    return false;
  }

  private static collect(node: unknown, name: string, copies: Map<string, string>): void {
    const dependencies = PackageCopyCheck.field(node, Resources.dependenciesField);
    if (typeof dependencies !== "object" || dependencies === null)
      return;
    for (const [dependency, child] of Object.entries(dependencies)) {
      const folder = PackageCopyCheck.field(child, Resources.npmListPathField);
      if (dependency === name && typeof folder === "string")
        copies.set(folder, String(PackageCopyCheck.field(child, Resources.versionField)));
      PackageCopyCheck.collect(child, name, copies);
    }
  }

  private static field(value: unknown, name: string): unknown {
    return JsonValue.isObject(value) ? value[name] : undefined;
  }
}

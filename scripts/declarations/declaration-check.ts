/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { RepositoryModule } from "../models/repository-module.ts";
import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";

type JsonObject = { readonly [key: string]: unknown };

class DeclarationCheck {
  private static readonly ownPrefix: string = `${RepositoryModule.main.packageName}${Resources.dot}`;

  private readonly root: string;
  private readonly problems: string[] = [];
  private readonly ranges: VersionRange[] = [];

  public constructor(root: string) {
    this.root = root;
  }

  public run(): readonly string[] {
    const rootManifest: JsonObject | null = this.readObject(join(this.root, Resources.manifestFile));
    const listed: JsonObject[] = [];
    for (const module of RepositoryModule.all) {
      const found: number = this.problems.length;
      listed.push(...this.checkModule(module, rootManifest));
      this.problems.splice(found, this.problems.length - found, ...this.problems.slice(found).map(t => Resources.formatModuleProblem(module.folder, t)));
    }
    if (rootManifest !== null)
      this.checkRootPins(rootManifest, listed);
    return this.problems;
  }

  private checkModule(module: RepositoryModule, rootManifest: JsonObject | null): readonly JsonObject[] {
    const packageRoot: string = join(this.root, module.folder);
    const declaration: JsonObject | null = this.readObject(join(packageRoot, Resources.moduleFile));
    const packageManifest: JsonObject | null = this.readObject(join(packageRoot, Resources.manifestFile));
    const windowManifest: JsonObject | null = this.readObject(join(this.root, module.windowFolder, Resources.manifestFile));
    if (declaration !== null)
      this.checkDeclaration(declaration, module);
    if (declaration !== null && packageManifest !== null)
      this.checkPackageManifest(packageManifest, declaration, module.packageName);
    const noldovaDesktop: VersionRange | null = declaration === null ? null : this.readNoldovaDesktop(declaration);
    if (noldovaDesktop !== null)
      this.ranges.push(noldovaDesktop);
    if (packageManifest === null || windowManifest === null || rootManifest === null)
      return [];
    return this.checkPins(packageManifest, windowManifest, rootManifest, noldovaDesktop);
  }

  private checkDeclaration(declaration: JsonObject, module: RepositoryModule): void {
    const fields: readonly string[] = Object.keys(declaration);
    if (fields.length !== Resources.moduleFields.length || Resources.moduleFields.some(t => !fields.includes(t)))
      this.problems.push(Resources.declarationFieldsInvalid);
    const id: unknown = declaration[Resources.idField];
    if (typeof id !== "string" || !Resources.moduleIdPattern.test(id) || id === Resources.reservedModuleId) {
      this.problems.push(Resources.declarationIdInvalid);
      return;
    }
    const version: unknown = declaration[Resources.versionField];
    if (typeof version !== "string" || !Resources.moduleVersionPattern.test(version))
      this.problems.push(Resources.declarationVersionInvalid);
    for (const field of Resources.declarationTextFields) {
      const value: unknown = declaration[field];
      if (typeof value !== "string" || value.trim() === "")
        this.problems.push(Resources.formatDeclarationTextBlank(field));
    }
    for (const part of this.readTexts(declaration, Resources.partsField)) {
      const folder: string | undefined = DeclarationCheck.partFolders(module).get(part);
      if (folder === undefined)
        this.problems.push(Resources.formatDeclarationPartUnknown(part));
      else if (!existsSync(join(this.root, folder)))
        this.problems.push(Resources.formatDeclarationPartMissing(part, folder));
    }
    this.checkDependencies(declaration[Resources.dependenciesField], id);
    this.checkContributions(declaration[Resources.contributesField], id);
  }

  private static partFolders(module: RepositoryModule): ReadonlyMap<string, string> {
    return new Map<string, string>([
      [Resources.runtimePart, `${module.folder}${Resources.pathSeparator}${Resources.sourceFolder}`],
      [Resources.windowPart, module.windowFolder],
      [Resources.cliPart, `${module.folder}${Resources.cliSuffix}`]
    ]);
  }

  private checkDependencies(dependencies: unknown, id: string): void {
    if (!DeclarationCheck.isObject(dependencies)) {
      this.problems.push(Resources.declarationDependenciesInvalid);
      return;
    }
    for (const [dependency, version] of Object.entries(dependencies)) {
      if (!Resources.moduleIdPattern.test(dependency) || dependency === id)
        this.problems.push(Resources.formatDeclarationDependencyInvalid(dependency));
      else if (typeof version !== "string" || !Resources.moduleVersionPattern.test(version))
        this.problems.push(Resources.formatDeclarationDependencyInexact(dependency));
    }
  }

  private checkContributions(contributes: unknown, id: string): void {
    if (!DeclarationCheck.isObject(contributes)) {
      this.problems.push(Resources.declarationContributesInvalid);
      return;
    }
    for (const kind of Object.keys(contributes)) {
      if (!Resources.contributionKinds.includes(kind)) {
        this.problems.push(Resources.formatDeclarationKindUnknown(kind));
        continue;
      }
      for (const name of this.readTexts(contributes, kind)) {
        if (kind === Resources.toolsKind) {
          this.checkToolName(name, id);
          continue;
        }
        const [owner, local, ...rest] = name.split(Resources.dot);
        if (owner !== id || local === undefined || !Resources.contributionNamePattern.test(local) || rest.length > 0)
          this.problems.push(Resources.formatDeclarationContributionInvalid(kind, name, id));
      }
    }
  }

  private checkToolName(name: string, id: string): void {
    const prefix: string = `${id.replaceAll(Resources.dash, Resources.underscore)}${Resources.underscore}`;
    if (!Resources.toolNamePattern.test(name) || !name.startsWith(prefix) || name.length === prefix.length)
      this.problems.push(Resources.formatDeclarationToolInvalid(name, prefix));
  }

  private checkPackageManifest(packageManifest: JsonObject, declaration: JsonObject, packageName: string): void {
    if (packageManifest[Resources.nameField] !== packageName)
      this.problems.push(Resources.formatManifestNameDiffers(packageName));
    if (packageManifest[Resources.versionField] !== declaration[Resources.versionField])
      this.problems.push(Resources.manifestVersionDiffers);
    if (packageManifest[Resources.privateField] !== undefined)
      this.problems.push(Resources.manifestPrivate);
  }

  private readNoldovaDesktop(declaration: JsonObject): VersionRange | null {
    const text: unknown = declaration[Resources.noldovaDesktopField];
    const range: VersionRange | null = typeof text === "string" ? VersionRange.parse(text) : null;
    if (range === null || range.toString() !== VersionRange.from(range.lowest).toString()) {
      this.problems.push(Resources.declarationNoldovaDesktopInvalid);
      return null;
    }
    return range;
  }

  private checkPins(packageManifest: JsonObject, windowManifest: JsonObject, rootManifest: JsonObject, noldovaDesktop: VersionRange | null): readonly JsonObject[] {
    for (const field of Resources.dependencyFields.filter(t => t !== Resources.dependenciesField && t !== Resources.peersField))
      this.readPins(packageManifest, field, Resources.packageManifestDescription);
    this.checkPeers(packageManifest, rootManifest, noldovaDesktop);
    this.checkWindowPeers(windowManifest, rootManifest);
    const packagePins: JsonObject = this.readPins(packageManifest, Resources.dependenciesField, Resources.packageManifestDescription);
    const windowPins: JsonObject = this.readPins(windowManifest, Resources.dependenciesField, Resources.windowManifestDescription);
    const rootPins: JsonObject = DeclarationCheck.pinsOf(rootManifest);
    for (const name of Object.keys(windowPins).filter(t => t.startsWith(Resources.contextPrefix)))
      this.problems.push(Resources.formatContextDependency(Resources.windowManifestDescription, name));
    for (const name of Object.keys(packagePins).filter(t => !t.startsWith(DeclarationCheck.ownPrefix))) {
      if (packagePins[name] !== rootPins[name])
        this.problems.push(Resources.formatRootPinDiffers(name, Resources.packageManifestName));
    }
    for (const name of Object.keys(windowPins).filter(t => Object.hasOwn(rootPins, t))) {
      if (windowPins[name] !== rootPins[name])
        this.problems.push(Resources.formatRootPinDiffers(name, Resources.windowManifestName));
    }
    this.checkBuiltAgainst(windowPins, noldovaDesktop === null ? [] : [noldovaDesktop], Resources.windowManifestDescription);
    return [packagePins, windowPins];
  }

  private checkPeers(packageManifest: JsonObject, rootManifest: JsonObject, noldovaDesktop: VersionRange | null): void {
    const peers: unknown = packageManifest[Resources.peersField] ?? {};
    if (!DeclarationCheck.isObject(peers)) {
      this.problems.push(Resources.formatPeersNotObject(Resources.peersField));
      return;
    }
    for (const [name, needed] of Object.entries(peers)) {
      const text: string = typeof needed === "string" ? needed : "";
      if (VersionRange.isCore(name)) {
        if (noldovaDesktop !== null && text !== noldovaDesktop.toString())
          this.problems.push(Resources.formatCorePeerDiffers(name, noldovaDesktop.toString(), Resources.peersField));
      }
      else if (!Resources.declarationPinPattern.test(text) && !(VersionRange.isRanged(name) && VersionRange.parse(text) !== null))
        this.problems.push(Resources.formatPeerInexact(name, VersionRange.isRanged(name), Resources.peersField));
      else if (name.startsWith(Resources.contextPrefix))
        this.checkRootPinInside(name, VersionRange.parse(text), rootManifest, Resources.packageManifestName);
    }
  }

  private checkWindowPeers(windowManifest: JsonObject, rootManifest: JsonObject): void {
    const peers: unknown = windowManifest[Resources.peersField] ?? {};
    if (!DeclarationCheck.isObject(peers)) {
      this.problems.push(Resources.formatPinsNotObject(Resources.windowManifestDescription, Resources.peersField));
      return;
    }
    for (const [name, needed] of Object.entries(peers)) {
      const range: VersionRange | null = typeof needed === "string" && name.startsWith(Resources.contextPrefix) ? VersionRange.parse(needed) : null;
      if (range === null || !range.isWritten())
        this.problems.push(Resources.formatWindowPeerInvalid(name));
      else
        this.checkRootPinInside(name, range, rootManifest, Resources.windowManifestName);
    }
  }

  private checkRootPinInside(name: string, range: VersionRange | null, rootManifest: JsonObject, manifest: string): void {
    const pins: unknown = rootManifest[Resources.devDependenciesField];
    const pin: unknown = DeclarationCheck.isObject(pins) ? pins[name] : undefined;
    if (range !== null && (typeof pin !== "string" || !range.includes(pin)))
      this.problems.push(Resources.formatRootPinOutsidePeer(manifest, name, range.toString()));
  }

  private checkBuiltAgainst(pins: JsonObject, ranges: readonly VersionRange[], description: string): void {
    for (const [name, pin] of Object.entries(pins))
      for (const range of ranges)
        if (VersionRange.isCore(name) && typeof pin === "string" && !range.includes(pin))
          this.problems.push(Resources.formatBuiltOutsideCore(description, name, pin, range.toString()));
  }

  private checkRootPins(rootManifest: JsonObject, listed: readonly JsonObject[]): void {
    for (const field of Resources.dependencyFields.filter(t => t !== Resources.dependenciesField)) {
      const pins: JsonObject = this.readPins(rootManifest, field, Resources.rootManifestDescription);
      if (field === Resources.devDependenciesField)
        this.checkBuiltAgainst(pins, [...new Map(this.ranges.map(t => [t.toString(), t])).values()], Resources.rootManifestDescription);
    }
    for (const name of Object.keys(this.readPins(rootManifest, Resources.dependenciesField, Resources.rootManifestDescription))) {
      if (!listed.some(t => Object.hasOwn(t, name)))
        this.problems.push(Resources.formatRootPinUnlisted(name));
    }
  }

  private static pinsOf(manifest: JsonObject): JsonObject {
    const dependencies: unknown = manifest[Resources.dependenciesField] ?? {};
    return DeclarationCheck.isObject(dependencies) ? dependencies : {};
  }

  private readPins(manifest: JsonObject, field: string, description: string): JsonObject {
    const dependencies: unknown = manifest[field] ?? {};
    if (!DeclarationCheck.isObject(dependencies)) {
      this.problems.push(Resources.formatPinsNotObject(description, field));
      return {};
    }
    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version !== "string" || !Resources.declarationPinPattern.test(version))
        this.problems.push(Resources.formatPinInexact(description, name, field));
    }
    return dependencies;
  }

  private readTexts(owner: JsonObject, field: string): readonly string[] {
    const values: unknown = owner[field];
    if (!Array.isArray(values) || values.some(t => typeof t !== "string")) {
      this.problems.push(Resources.formatDeclarationListInvalid(field));
      return [];
    }
    if (new Set(values).size !== values.length)
      this.problems.push(Resources.formatDeclarationListRepeats(field));
    return values;
  }

  private readObject(path: string): JsonObject | null {
    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, Resources.encoding));
    }
    catch (error) {
      if (!(error instanceof SyntaxError || DeclarationCheck.isMissing(error)))
        throw error;
      this.problems.push(Resources.formatJsonUnreadable(path, error));
      return null;
    }
    if (DeclarationCheck.isObject(value))
      return value;
    this.problems.push(Resources.formatJsonNotObject(path));
    return null;
  }

  private static isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && typeof error.code === "string" && Resources.missingFileCodes.includes(error.code);
  }

  private static isObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

const problems: readonly string[] = new DeclarationCheck(process.cwd()).run();
for (const problem of problems)
  console.error(problem);
process.exitCode = problems.length > 0 ? Resources.failureExitCode : Resources.successExitCode;

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AngularPackageBuilder } from "../angular/angular-package-builder.ts";
import { CompileFailedException } from "../exceptions/compile-failed.exception.ts";
import { CompiledMissingException } from "../exceptions/compiled-missing.exception.ts";
import { DependenciesNotObjectException } from "../exceptions/dependencies-not-object.exception.ts";
import { ExportNotSourceException } from "../exceptions/export-not-source.exception.ts";
import { ExportsNotMappedException } from "../exceptions/exports-not-mapped.exception.ts";
import { JsonFileNotObjectException } from "../exceptions/json-file-not-object.exception.ts";
import { JsonValueException } from "../exceptions/json-value.exception.ts";
import { ManifestVersionDiffersException } from "../exceptions/manifest-version-differs.exception.ts";
import { ModuleVersionMissingException } from "../exceptions/module-version-missing.exception.ts";
import { NoldovaDesktopMissingException } from "../exceptions/noldova-desktop-missing.exception.ts";
import { OwnPinDiffersException } from "../exceptions/own-pin-differs.exception.ts";
import { PackFailedException } from "../exceptions/pack-failed.exception.ts";
import { PackageException } from "../exceptions/package.exception.ts";
import { PrivatePackageException } from "../exceptions/private-package.exception.ts";
import { VersionFileDiffersException } from "../exceptions/version-file-differs.exception.ts";
import type { IModulePackage } from "../interfaces/i-module-package.ts";
import type { ProcessResult } from "../models/process-result.ts";
import { RepositoryModule } from "../models/repository-module.ts";
import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";
import { ArchiveCheck } from "./archive-check.ts";
import { Git } from "./git.ts";
import { type JsonObject, JsonValue } from "./json-value.ts";
import type { NpmCommand } from "./npm-command.ts";
import { PackageImports } from "./package-imports.ts";
import type { PackageInstall } from "./package-install.ts";
import { PackageLayout } from "./package-layout.ts";
import type { ProcessRunner } from "./process-runner.ts";

export class PackagePacker {
  private static readonly mainFolder: string = RepositoryModule.main.folder;
  private static readonly ownScope: string = RepositoryModule.main.packageName;
  private static readonly mainModuleFile: string = path.posix.join(PackagePacker.mainFolder, Resources.moduleFile);
  private static readonly versionFiles: readonly string[] = [...Resources.versionFiles,
    ...RepositoryModule.all.filter(t => t !== RepositoryModule.main).map(t => path.posix.join(t.folder, Resources.moduleFile))];

  private readonly root: string;
  private readonly npm: NpmCommand;
  private readonly runner: ProcessRunner;
  private readonly angular: AngularPackageBuilder;
  private readonly install: PackageInstall;
  private readonly report: (line: string) => void;

  public constructor(root: string, npm: NpmCommand, runner: ProcessRunner, angular: AngularPackageBuilder, install: PackageInstall, report: (line: string) => void) {
    this.root = root;
    this.npm = npm;
    this.runner = runner;
    this.angular = angular;
    this.install = install;
    this.report = report;
  }

  public async runAsync(): Promise<number> {
    try {
      const version = await this.readModuleVersionAsync();
      await this.checkVersionFilesAsync(version);
      const commit = await this.readCommitAsync();
      await rm(path.join(this.root, Resources.archivesFolder), { recursive: true, force: true });
      await rm(path.join(this.root, ...Resources.compiledSegments), { recursive: true, force: true });
      for (const shared of RepositoryModule.shared)
        await this.packProtocolAsync(shared.folder, PackagePacker.sharedCompiled(shared), PackagePacker.sharedWork(shared), version, commit);
      for (const module of RepositoryModule.all) {
        await this.packProtocolAsync(module.protocolFolder, PackagePacker.protocolCompiled(module),
          PackagePacker.moduleWork(module, Resources.protocolPart), version, commit);
        await this.packWindowAsync(module, version, commit);
        await this.packModuleAsync(module, version, commit);
      }
      await new ArchiveCheck(this.root).checkAsync(Resources.archivesFolder, version, commit, Resources.packageScope);
      return Resources.successExitCode;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof JsonValueException))
        throw error;
      this.report(error.message);
      return Resources.failureExitCode;
    }
  }

  public async listCopiesAsync(): Promise<readonly (readonly [string, string, string])[]> {
    const copies: (readonly [string, string, string])[] = [];
    for (const part of await new PackageLayout(this.root).readPackagesAsync()) {
      copies.push([Resources.licenseFile, part.name, Resources.licenseFile]);
      copies.push([path.posix.join(part.folder, Resources.readmeFile), part.name, Resources.readmeFile]);
      if (existsSync(path.join(this.root, part.folder, Resources.noticesFile)))
        copies.push([path.posix.join(part.folder, Resources.noticesFile), part.name, Resources.noticesFile]);
      const module = RepositoryModule.all.find(t => t.folder === part.folder);
      if (module !== undefined)
        copies.push(...this.listModuleFiles(module).map(t => [path.posix.join(module.folder, t), part.name, t] as const));
    }
    return copies;
  }

  private static manifestOf(manifest: JsonObject, file: string): JsonObject {
    const exports: unknown = manifest[Resources.exportsField];
    if (typeof exports !== "object" || exports === null || Array.isArray(exports))
      throw new ExportsNotMappedException(file);
    const mapped = Object.entries(exports).map(([subpath, target]) => {
      if (target === Resources.manifestExport)
        return [subpath, target] as const;
      if (typeof target !== "string" || !target.endsWith(Resources.typeScriptExtension) || target.endsWith(Resources.declarationExtension))
        throw new ExportNotSourceException(file, subpath);
      const stem = target.slice(0, -Resources.typeScriptExtension.length);
      return [subpath, { types: `${stem}${Resources.declarationExtension}`, default: `${stem}${Resources.javaScriptExtension}` }] as const;
    });
    return { ...manifest, [Resources.exportsField]: Object.fromEntries(mapped) };
  }

  private static readPins(manifest: JsonObject, field: string, file: string): ReadonlyMap<string, string> {
    const dependencies: unknown = manifest[field] ?? {};
    if (!JsonValue.isObject(dependencies))
      throw new DependenciesNotObjectException(file, field);
    return new Map(Object.entries(dependencies).filter((t): t is [string, string] => typeof t[1] === "string"));
  }

  private static require(result: ProcessResult, packageName: string): void {
    if (!result.isSuccessful)
      throw new PackFailedException(packageName, result.exitCode, result.text);
  }

  private async packProtocolAsync(folder: string, compiled: readonly string[], work: readonly string[], version: string, commit: string | null): Promise<void> {
    await this.compileAsync(folder);
    const output = this.locateWork(work);
    await rm(output, { recursive: true, force: true });
    await this.copyCompiledAsync(compiled, path.join(output, Resources.sourceFolder));
    await this.copyDeclarationsAsync(path.join(this.root, folder, Resources.sourceFolder), path.join(output, Resources.sourceFolder));
    const file = path.posix.join(folder, Resources.manifestFile);
    await this.finishAsync(folder, output, PackagePacker.manifestOf(await this.readManifestAsync(file, version), file), commit);
  }

  private async packWindowAsync(module: RepositoryModule, version: string, commit: string | null): Promise<void> {
    const folder = module.windowFolder;
    const output = this.locateWork(PackagePacker.moduleWork(module, Resources.windowPart));
    await rm(output, { recursive: true, force: true });
    const sources = path.join(this.root, folder, Resources.sourceFolder);
    await this.angular.compileAsync(path.join(this.root, folder), sources, path.join(output, Resources.sourceFolder));
    await this.copyDeclarationsAsync(sources, path.join(output, Resources.sourceFolder));
    const file = path.posix.join(folder, Resources.manifestFile);
    const manifest = await this.readManifestAsync(file, version);
    const ownPeers = module.dependencies.flatMap(t => [t.protocolName, t.windowName]);
    const declaredPeers = PackagePacker.readPins(manifest, Resources.peersField, file);
    const { dependencies, peers: pinned } = await PackageImports.resolveAsync(path.join(output, Resources.sourceFolder),
      new Map([...PackagePacker.readPins(manifest, Resources.dependenciesField, file), ...declaredPeers]), version, file, ownPeers);
    const noldovaDesktop = await this.readNoldovaDesktopAsync(module);
    const peers = new Map([...pinned].map(([name, pin]): [string, string] => [name, declaredPeers.get(name)
      ?? (ownPeers.includes(name) ? VersionRange.sibling(version).toString() : PackagePacker.readPeerRange(name, pin, noldovaDesktop))]));
    const { dependencies: _, devDependencies: __, scripts: ___, allowScripts: ____, ...published } = manifest;
    const sorted = (pins: ReadonlyMap<string, string>): JsonObject => Object.fromEntries([...pins].sort(([a], [b]) => PackagePacker.compareOrdinal(a, b)));
    await this.finishAsync(folder, output, PackagePacker.manifestOf({
      ...published,
      dependencies: sorted(dependencies),
      peerDependencies: sorted(peers),
      peerDependenciesMeta: Object.fromEntries([...peers.keys()].sort().map(t => [t, { optional: true }]))
    }, file), commit);
  }

  private async packModuleAsync(module: RepositoryModule, version: string, commit: string | null): Promise<void> {
    await this.compileAsync(module.folder);
    const source = path.join(this.root, module.folder);
    const output = this.locateWork(PackagePacker.moduleWork(module, path.posix.basename(module.folder)));
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    for (const file of this.listModuleFiles(module))
      await copyFile(path.join(source, file), path.join(output, file));
    const sources = path.join(output, Resources.sourceFolder);
    await this.copyCompiledAsync(PackagePacker.runtimeCompiled(module), sources);
    await this.copyDeclarationsAsync(path.join(source, Resources.sourceFolder), sources);
    const window = path.join(Resources.sourceFolder, Resources.apiFolder, Resources.windowEntryFile);
    const { default: typescript } = await import("typescript");
    const options = { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2025, verbatimModuleSyntax: true };
    const script = typescript.transpileModule(await readFile(path.join(source, window), Resources.encoding), { compilerOptions: options }).outputText;
    await writeFile(path.join(output, `${window.slice(0, -Resources.typeScriptExtension.length)}${Resources.javaScriptExtension}`), script);
    const file = path.posix.join(module.folder, Resources.manifestFile);
    const manifest = await this.readManifestAsync(file, version);
    const own = [...PackagePacker.readPins(manifest, Resources.dependenciesField, file)].filter(([name]) => name.startsWith(`${PackagePacker.ownScope}${Resources.dot}`));
    for (const [name, pin] of own)
      if (pin !== version)
        throw new OwnPinDiffersException(file, name, pin, version);
    await this.finishAsync(module.folder, output, PackagePacker.manifestOf(manifest, file), commit);
  }

  private async copyCompiledAsync(segments: readonly string[], target: string): Promise<void> {
    const compiled = path.join(this.root, ...segments);
    if (!existsSync(compiled))
      throw new CompiledMissingException(path.posix.join(...segments));
    for (const file of (await readdir(compiled, { recursive: true })).filter(t => t.endsWith(Resources.javaScriptExtension))) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      await copyFile(path.join(compiled, file), path.join(target, file));
    }
  }

  private async copyDeclarationsAsync(sources: string, target: string): Promise<void> {
    for (const file of (await readdir(sources, { recursive: true })).filter(t => t.endsWith(Resources.declarationExtension))) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true });
      await writeFile(path.join(target, file), (await readFile(path.join(sources, file), Resources.encoding)).replace(Resources.declarationImportPattern, Resources.declarationImportReplacement));
    }
  }

  private async finishAsync(folder: string, output: string, manifest: JsonObject, commit: string | null): Promise<void> {
    await mkdir(output, { recursive: true });
    await copyFile(path.join(this.root, Resources.licenseFile), path.join(output, Resources.licenseFile));
    await copyFile(path.join(this.root, folder, Resources.readmeFile), path.join(output, Resources.readmeFile));
    if (existsSync(path.join(this.root, folder, Resources.noticesFile)))
      await copyFile(path.join(this.root, folder, Resources.noticesFile), path.join(output, Resources.noticesFile));
    const stamped: JsonObject = commit === null ? manifest : { ...manifest, [Resources.commitField]: commit };
    await writeFile(path.join(output, Resources.manifestFile), `${JSON.stringify(stamped, null, Resources.jsonIndent)}${Resources.lineEnd}`);
    const archives = path.join(this.root, Resources.archivesFolder);
    await mkdir(archives, { recursive: true });
    PackagePacker.require(await this.npm.runAsync([...Resources.packArguments, archives], output), String(manifest[Resources.nameField]));
    await this.install.installPackedAsync();
  }

  private async compileAsync(folder: string): Promise<void> {
    const compiled = await this.runner.runAsync(process.execPath,
      [path.join(this.root, ...Resources.typeScriptCompiler), Resources.projectOption, path.posix.join(folder, Resources.projectFile)], this.root);
    if (compiled !== Resources.successExitCode)
      throw new CompileFailedException(folder, compiled);
  }

  private listModuleFiles(module: RepositoryModule): readonly string[] {
    return Resources.moduleFiles.filter(t => existsSync(path.join(this.root, module.folder, t)));
  }

  private static compareOrdinal(left: string, right: string): number {
    return Number(left > right) - Number(left < right);
  }

  private async readCommitAsync(): Promise<string | null> {
    if (!existsSync(path.join(this.root, Resources.gitFolder))) {
      this.report(Resources.commitUnstampedOutsideGit);
      return null;
    }
    const git = new Git(this.root, this.runner);
    if ((await git.readOutputAsync(Resources.gitStatusArguments)).length > 0) {
      this.report(Resources.commitUnstampedChanged);
      return null;
    }
    return (await git.readOutputAsync(Resources.gitCommitArguments)).trim();
  }

  private static readPeerRange(name: string, pin: string, noldovaDesktop: VersionRange): string {
    if (VersionRange.isCore(name))
      return noldovaDesktop.toString();
    return VersionRange.isRanged(name) || VersionRange.isAngular(name) ? VersionRange.from(pin).toString() : pin;
  }

  private async readNoldovaDesktopAsync(module: RepositoryModule): Promise<VersionRange> {
    const file = path.posix.join(module.folder, Resources.moduleFile);
    const range: unknown = (await this.readJsonAsync(file))[Resources.noldovaDesktopField];
    const parsed = typeof range === "string" ? VersionRange.parse(range) : null;
    if (parsed === null)
      throw new NoldovaDesktopMissingException(file);
    return parsed;
  }

  private async readModuleVersionAsync(): Promise<string> {
    const file = PackagePacker.mainModuleFile;
    const version: unknown = (await this.readJsonAsync(file))[Resources.versionField];
    if (typeof version !== "string")
      throw new ModuleVersionMissingException(file);
    return version;
  }

  private async checkVersionFilesAsync(version: string): Promise<void> {
    for (const file of PackagePacker.versionFiles) {
      const found: unknown = (await this.readJsonAsync(file))[Resources.versionField];
      if (found !== version)
        throw new VersionFileDiffersException(file, String(found), PackagePacker.mainModuleFile, version);
    }
  }

  private async readManifestAsync(file: string, version: string): Promise<JsonObject> {
    const manifest = await this.readJsonAsync(file);
    if (manifest[Resources.versionField] !== version)
      throw new ManifestVersionDiffersException(file, String(manifest[Resources.versionField]), version);
    if (manifest[Resources.privateField] !== undefined)
      throw new PrivatePackageException(file);
    return manifest;
  }

  private async readJsonAsync(file: string): Promise<JsonObject> {
    const json: unknown = JsonValue.parseFile(file, await readFile(path.join(this.root, file), Resources.encoding));
    if (!JsonValue.isObject(json))
      throw new JsonFileNotObjectException(file);
    return json;
  }

  private static protocolCompiled(module: RepositoryModule): readonly string[] {
    return [...Resources.compiledSegments, path.posix.basename(module.protocolFolder), Resources.sourceFolder];
  }

  private static runtimeCompiled(module: RepositoryModule): readonly string[] {
    return [...Resources.compiledSegments, path.posix.basename(module.folder), Resources.sourceFolder];
  }

  private static sharedCompiled(shared: IModulePackage): readonly string[] {
    return [...Resources.compiledSegments, path.posix.basename(shared.folder), Resources.sourceFolder];
  }

  private static moduleWork(module: RepositoryModule, part: string): readonly string[] {
    return [module.name, part];
  }

  private static sharedWork(shared: IModulePackage): readonly string[] {
    return [path.posix.basename(shared.folder)];
  }

  private locateWork(segments: readonly string[]): string {
    return path.join(this.root, ...Resources.packagesWorkSegments, ...segments);
  }
}

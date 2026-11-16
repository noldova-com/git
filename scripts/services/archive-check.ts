/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { ArchiveFindingsException } from "../exceptions/archive-findings.exception.ts";
import { ArchiveFolderMissingException } from "../exceptions/archive-folder-missing.exception.ts";
import { ArchiveManifestNotObjectException } from "../exceptions/archive-manifest-not-object.exception.ts";
import { JsonValueNotObjectException } from "../exceptions/json-value-not-object.exception.ts";
import { ReleaseArchive } from "../models/release-archive.ts";
import { VersionRange } from "../models/version-range.ts";
import { Resources } from "../resources.ts";
import { ArchiveReader } from "./archive-reader.ts";
import { type JsonObject, JsonValue } from "./json-value.ts";
import { PackageLayout } from "./package-layout.ts";

export class ArchiveCheck {
  private readonly root: string;
  private readonly archiveReader: ArchiveReader = new ArchiveReader();

  public constructor(root: string) {
    this.root = root;
  }

  public async checkAsync(folder: string, version: string, commit: string | null, scope: string): Promise<readonly ReleaseArchive[]> {
    const directory = path.resolve(this.root, folder);
    if (!existsSync(directory))
      throw new ArchiveFolderMissingException(folder);

    const archives = (await new PackageLayout(this.root).readPackagesAsync()).map(t => new ReleaseArchive(t, path.join(directory, ArchiveCheck.nameArchive(t.name, version))));
    const expected = archives.map(t => path.basename(t.filePath));
    const found = (await readdir(directory)).sort();
    const findings = [
      ...expected.filter(t => !found.includes(t)).map(t => Resources.formatArchiveMissing(folder, t)),
      ...found.filter(t => !expected.includes(t)).map(t => Resources.formatArchiveUnexpected(folder, t, version))
    ];

    const names = archives.map(t => t.part.name);
    const contents = new Map<ReleaseArchive, ReadonlyMap<string, Buffer>>();
    for (const archive of archives.filter(t => found.includes(path.basename(t.filePath))))
      contents.set(archive, await this.archiveReader.readAsync(archive.filePath));
    const [noldovaDesktop, rangeFindings] = ArchiveCheck.readNoldovaDesktop(contents);
    findings.push(...rangeFindings);
    for (const [archive, entries] of contents)
      findings.push(...ArchiveCheck.checkArchive(archive, entries, version, commit, scope, names, noldovaDesktop));

    if (findings.length > 0)
      throw new ArchiveFindingsException(findings);

    return archives;
  }

  private static readNoldovaDesktop(contents: ReadonlyMap<ReleaseArchive, ReadonlyMap<string, Buffer>>): readonly [string | null, readonly string[]] {
    const findings: string[] = [];
    const ranges = new Set<string>();
    for (const [archive, entries] of contents) {
      const content = entries.get(Resources.archiveModuleEntry);
      if (content === undefined)
        continue;
      const archiveName = path.basename(archive.filePath);
      let field: unknown;
      try {
        field = JsonValue.object(JSON.parse(content.toString(Resources.encoding)), archiveName)[Resources.noldovaDesktopField];
      }
      catch (error) {
        if (!(error instanceof SyntaxError || error instanceof JsonValueNotObjectException))
          throw error;
        findings.push(Resources.formatArchiveModuleNotObject(archiveName));
        continue;
      }
      const range = typeof field === "string" ? VersionRange.parse(field) : null;
      if (range === null)
        findings.push(Resources.formatArchiveNoldovaDesktopUnranged(archiveName, field === undefined ? Resources.nothingNamed : JSON.stringify(field)));
      else
        ranges.add(range.toString());
    }
    if (ranges.size > 1)
      findings.push(Resources.formatArchiveNoldovaDesktopsDiffer([...ranges]));
    return [findings.length === 0 && ranges.size === 1 ? [...ranges][0] ?? null : null, findings];
  }

  private static checkArchive(archive: ReleaseArchive, entries: ReadonlyMap<string, Buffer>, version: string, commit: string | null, scope: string, names: readonly string[],
    noldovaDesktop: string | null): readonly string[] {
    const archiveName = path.basename(archive.filePath);
    const content = entries.get(Resources.archiveManifestEntry);
    if (content === undefined)
      return [Resources.formatArchiveManifestMissing(archiveName)];

    const context = Resources.formatArchiveManifestContext(archiveName);
    const manifest = ArchiveCheck.parseObject(content.toString(Resources.encoding), context);
    const findings: string[] = [...ArchiveCheck.checkContents(archiveName, manifest, entries, noldovaDesktop)];
    const name = JsonValue.text(manifest, Resources.nameField, context);
    if (name !== archive.part.name)
      findings.push(Resources.formatArchiveFieldDiffers(archiveName, Resources.nameField, name, archive.part.name));
    if (!name.startsWith(`${scope}${Resources.pathSeparator}`))
      findings.push(Resources.formatArchiveOutsideScope(archiveName, name, scope));

    const foundVersion = JsonValue.text(manifest, Resources.versionField, context);
    if (foundVersion !== version)
      findings.push(Resources.formatArchiveFieldDiffers(archiveName, Resources.versionField, foundVersion, version));
    if (commit !== null && manifest[Resources.commitField] !== commit)
      findings.push(Resources.formatArchiveCommitDiffers(archiveName, manifest[Resources.commitField], commit));
    if (manifest[Resources.privateField] === true)
      findings.push(Resources.formatArchiveMarkedPrivate(archiveName));

    const dependencies = manifest[Resources.dependenciesField] === undefined ? null : JsonValue.nullableChild(manifest, Resources.dependenciesField, context);
    if (dependencies !== null)
      for (const dependency of Object.keys(dependencies).filter(t => names.includes(t))) {
        const range = JsonValue.text(dependencies, dependency, context);
        if (range !== version)
          findings.push(Resources.formatArchiveDependencyDiffers(archiveName, dependency, range, version));
      }

    return findings;
  }

  private static parseObject(text: string, context: string): JsonObject {
    try {
      return JsonValue.object(JSON.parse(text), context);
    }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof JsonValueNotObjectException))
        throw error;
      throw new ArchiveManifestNotObjectException(context, error);
    }
  }

  private static nameArchive(name: string, version: string): string {
    return `${name.replace(Resources.scopePattern, Resources.scopeReplacement)}${Resources.dash}${version}${Resources.archiveExtension}`;
  }

  private static checkContents(archiveName: string, manifest: JsonObject, entries: ReadonlyMap<string, Buffer>, noldovaDesktop: string | null): readonly string[] {
    const findings: string[] = [];
    const exports = manifest[Resources.exportsField];
    const targets = typeof exports === "object" && exports !== null
      ? Object.entries(exports).flatMap(([subpath, target]: [string, unknown]) =>
        (typeof target === "object" && target !== null ? Object.values(target) : [target]).map(t => [subpath, String(t)] as const))
      : [];
    if (targets.length === 0)
      findings.push(Resources.formatArchiveExportsNothing(archiveName));
    for (const [subpath, target] of targets)
      if (!entries.has(path.posix.join(Resources.archiveFolder, target)))
        findings.push(Resources.formatArchiveExportMissing(archiveName, subpath, target));
    if (targets.some(([subpath]) => Resources.partExports.includes(subpath)) && !entries.has(Resources.archiveModuleEntry))
      findings.push(Resources.formatArchiveModuleMissing(archiveName));
    const packageName = manifest[Resources.nameField];
    const isWindow = typeof packageName === "string" && packageName.endsWith(Resources.windowSuffix);
    for (const field of Resources.pinFields) {
      const pins = manifest[field];
      for (const [name, pin] of typeof pins === "object" && pins !== null ? Object.entries(pins) : []) {
        if (noldovaDesktop !== null && field === Resources.peersField && VersionRange.isCore(name)) {
          if (pin !== noldovaDesktop)
            findings.push(Resources.formatArchiveCorePeerDiffers(archiveName, name, String(pin), field, noldovaDesktop));
          continue;
        }
        const isRanged = field === Resources.peersField && VersionRange.isRanged(name);
        const isAngular = field === Resources.peersField && isWindow && VersionRange.isAngular(name);
        const range = typeof pin === "string" ? VersionRange.parse(pin) : null;
        if (isAngular) {
          if (range?.isWritten() !== true)
            findings.push(Resources.formatArchiveAngularPeerUnranged(archiveName, name, String(pin), field));
          continue;
        }
        if (typeof pin !== "string" || !(Resources.exactPinPattern.test(pin) || (isRanged && range !== null)))
          findings.push(Resources.formatArchivePinInexact(archiveName, name, String(pin), field, isRanged));
      }
    }
    if (isWindow) {
      const peers = manifest[Resources.peersField];
      const meta = manifest[Resources.peersMetaField];
      for (const peer of JsonValue.isObject(peers) ? Object.keys(peers) : []) {
        const entry: unknown = JsonValue.isObject(meta) ? meta[peer] : undefined;
        if (!JsonValue.isObject(entry) || entry[Resources.optionalField] !== true)
          findings.push(Resources.formatArchivePeerNotOptional(archiveName, peer));
      }
    }
    return findings;
  }
}

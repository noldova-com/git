/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { InstalledPackageCheckFailedException } from "../../exceptions/installed-package-check-failed.exception.ts";
import { VersionRange } from "../../models/version-range.ts";
import { FixtureManifest } from "./fixture-manifest.ts";
import { InstalledPackageResources } from "./installed-package-resources.ts";

class PackedPeersCheck {
  public static async runAsync(root: string | undefined): Promise<void> {
    if (root === undefined)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.rootMissing);
    const gitWindow: FixtureManifest = await PackedPeersCheck.readInstalledAsync(InstalledPackageResources.gitWindowName);
    PackedPeersCheck.checkNoContextDependency(InstalledPackageResources.gitWindowName, gitWindow);
    const projects: [FixtureManifest, string][] = [[gitWindow, InstalledPackageResources.gitWindowFolder]];
    for (const [name, folder, takesGitWindow] of InstalledPackageResources.hostWindows) {
      const hostWindow: FixtureManifest = await PackedPeersCheck.readInstalledAsync(name);
      if (takesGitWindow)
        PackedPeersCheck.checkWindowPeer(name, gitWindow, hostWindow);
      PackedPeersCheck.checkNoContextDependency(name, hostWindow);
      projects.push([hostWindow, folder]);
    }
    for (const [packed, folder] of projects)
      PackedPeersCheck.checkAngularPeers(packed, await FixtureManifest.readAsync(path.join(root, folder, InstalledPackageResources.manifestFile)), folder);
    PackedPeersCheck.checkSamples();
    const rootManifest: FixtureManifest = await FixtureManifest.readAsync(path.join(root, InstalledPackageResources.manifestFile));
    for (const [name, peers] of InstalledPackageResources.contextPeers) {
      const installed: FixtureManifest = await PackedPeersCheck.readInstalledAsync(name);
      for (const peer of peers)
        PackedPeersCheck.checkContextPeer(name, peer, installed.peerDependencies[peer], rootManifest.devDependencies[peer] ?? "");
    }
  }

  private static async readInstalledAsync(name: string): Promise<FixtureManifest> {
    return await FixtureManifest.readAsync(path.join(InstalledPackageResources.nodeModulesFolder, name, InstalledPackageResources.manifestFile));
  }

  private static checkWindowPeer(name: string, gitWindow: FixtureManifest, hostWindow: FixtureManifest): void {
    const peer: string | undefined = hostWindow.peerDependencies[InstalledPackageResources.gitWindowName];
    const isDependency: boolean = hostWindow.dependencies[InstalledPackageResources.gitWindowName] !== undefined;
    if (peer !== VersionRange.sibling(gitWindow.version).toString() || isDependency)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatWindowPeerDiffers(name, gitWindow.version, peer, isDependency));
  }

  private static checkNoContextDependency(name: string, packed: FixtureManifest): void {
    const dependency: string | undefined = Object.keys(packed.dependencies).find(t => t.startsWith(InstalledPackageResources.contextPrefix));
    if (dependency !== undefined)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatContextDependency(name, dependency));
  }

  private static checkAngularPeers(packed: FixtureManifest, project: FixtureManifest, folder: string): void {
    const pins: readonly (readonly [string, string])[] = Object.entries(project.dependencies)
      .filter(([name]) => name.startsWith(InstalledPackageResources.angularPrefix) && packed.peerDependencies[name] !== undefined);
    const wrong = pins.filter(([name, pin]) =>
      packed.peerDependencies[name] !== InstalledPackageResources.formatAngularPeer(pin, Number(pin.split(InstalledPackageResources.dot)[0])));
    if (packed.peerDependencies[InstalledPackageResources.angularCoreName] === undefined || wrong.length > 0)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatAngularPeersDiffer(folder,
        JSON.stringify(Object.fromEntries(pins.map(([name]) => [name, packed.peerDependencies[name]])))));
  }

  private static checkSamples(): void {
    const misread = InstalledPackageResources.rangeSamples.filter(([peer, pin, taken]) => PackedPeersCheck.takesPin(peer, pin) !== taken);
    if (misread.length > 0)
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatRangeCheckMisreads(JSON.stringify(misread)));
  }

  private static checkContextPeer(name: string, peer: string, found: string | undefined, pin: string): void {
    if (!PackedPeersCheck.takesPin(found, pin))
      throw new InstalledPackageCheckFailedException(InstalledPackageResources.formatContextPeerDiffers(name, peer, found, pin, VersionRange.from(pin).refused));
  }

  private static takesPin(peer: string | undefined, pin: string): boolean {
    const range: VersionRange | null = peer === undefined ? null : VersionRange.parse(peer);
    return range !== null && range.isWritten() && range.includes(pin) && range.refused === VersionRange.from(pin).refused;
  }
}

try {
  await PackedPeersCheck.runAsync(process.argv[2]);
}
catch (error) {
  if (!(error instanceof InstalledPackageCheckFailedException))
    throw error;
  console.error(error.message);
  process.exitCode = InstalledPackageResources.failureExitCode;
}

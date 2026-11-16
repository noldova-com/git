/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class InstalledPackageResources {
  public static readonly encoding: BufferEncoding = "utf8";
  public static readonly failureExitCode: number = 1;
  public static readonly dot: string = ".";
  public static readonly listSeparator: string = ", ";
  public static readonly manifestFile: string = "package.json";
  public static readonly nodeModulesFolder: string = "node_modules";
  public static readonly versionField: string = "version";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly devDependenciesField: string = "devDependencies";
  public static readonly peersField: string = "peerDependencies";
  public static readonly gitWindowName: string = "@noldova/git.window";
  public static readonly gitHubWindowName: string = "@noldova/git.github.window";
  public static readonly gitWindowFolder: string = "src/noldova.git.window";
  public static readonly gitHubWindowFolder: string = "src/noldova.git.github.window";
  public static readonly angularPrefix: string = "@angular/";
  public static readonly angularCoreName: string = "@angular/core";
  public static readonly contextPeers: readonly (readonly [string, readonly string[]])[] = [
    ["@noldova/git", ["@noldova/context.exceptions", "@noldova/context.json"]],
    ["@noldova/git.github", ["@noldova/context.exceptions", "@noldova/context.json"]],
    ["@noldova/git.protocol", ["@noldova/context.exceptions", "@noldova/context.json"]],
    ["@noldova/git.hosting.protocol", ["@noldova/context.exceptions", "@noldova/context.json"]],
    ["@noldova/git.window", ["@noldova/context.exceptions", "@noldova/context.json"]],
    ["@noldova/git.github.window", ["@noldova/context.json"]]
  ];
  public static readonly contextPrefix: string = "@noldova/context.";
  public static readonly rangeSamples: readonly (readonly [string | undefined, string, boolean])[] = [
    [">=0.0.2 <0.1.0", "0.0.2", true], [">=0.0.1 <0.1.0", "0.0.2", true], [">=1.2.0 <2.0.0", "1.4.1", true], [">=0.0.3 <0.1.0", "0.0.2", false],
    [">=0.0.2 <0.2.0", "0.0.2", false], [">=0.0.2 <0.0.3", "0.0.2", false], [">=0.0.9 <0.2.0", "0.1.3", false], ["0.0.2", "0.0.2", false],
    ["^0.0.2", "0.0.2", false], [undefined, "0.0.2", false]
  ];
  public static readonly noPeer: string = "none";
  public static readonly noContextPeer: string = "no peer";
  public static readonly asDependency: string = ", and as a dependency";
  public static readonly rootMissing: string = "Name the repository's root folder, whose window projects' and root manifests the packed peers are held against.";
  public static readonly sampleOwner: string = "team";
  public static readonly sampleRepository: string = "repo";
  public static readonly sampleNumber: number = 7;
  public static readonly readingSeparator: string = " ";
  public static readonly expectedReading: string = "git git-github team/repo#7";
  public static readonly runtimeMissing: string = "Name the module package's runtime export to open, such as @noldova/git/runtime.";
  public static readonly openWorkPrefix: string = "noldova-git-open-";
  public static readonly databaseName: string = "fixture";
  public static readonly expectedStates: string = "false,true,false";
  public static readonly logSeparator: string = " | ";
  public static readonly noMethods: string = "no methods";
  public static readonly noTools: string = "no tools";
  public static readonly noServices: string = "no services";

  public static formatManifestInvalid(file: string): string {
    return `${file} must be an object with a version.`;
  }

  public static formatPinsInvalid(file: string, field: string): string {
    return `${file}'s ${field} must map names to versions.`;
  }

  public static formatWindowPeerDiffers(version: string, peer: string | undefined, isDependency: boolean): string {
    return `The GitHub window part takes the Git window part ${version} as the peer ${peer ?? InstalledPackageResources.noPeer}, not from it to the next minor`
      + `${isDependency ? InstalledPackageResources.asDependency : ""}.`;
  }

  public static formatContextDependency(name: string, dependency: string): string {
    return `${name} takes ${dependency} as a dependency, which installs a second copy of context beside the app's; it must be a peer.`;
  }

  public static formatAngularPeer(pin: string, major: number): string {
    return `>=${pin} <${major + 1}.0.0`;
  }

  public static formatAngularPeersDiffer(folder: string, peers: string): string {
    return `The window part from ${folder} takes Angular as ${peers}, not each from its pin to the next major.`;
  }

  public static formatRangeCheckMisreads(misread: string): string {
    return `The context range check misreads ${misread}.`;
  }

  public static formatContextPeerDiffers(name: string, peer: string, found: string | undefined, pin: string, refused: string): string {
    return `${name} takes ${peer} as ${found ?? InstalledPackageResources.noContextPeer}, not a range from a tested version at or below the root's pin ${pin} to ${refused}.`;
  }

  public static formatProtocolsMisread(read: string): string {
    return `The installed protocols read ${read}.`;
  }

  public static formatActivityDiffers(states: string, log: string): string {
    return `The installed runtime part was active ${states} before, during and after its activation; log: ${log}`;
  }

  public static formatToolsKept(tools: string, kept: string): string {
    return `The installed runtime part registered the tools ${tools} but kept ${kept} after its deactivation.`;
  }

  public static formatTools(tools: string): string {
    return `the tools ${tools}, withdrawn on deactivation`;
  }

  public static formatServices(services: string): string {
    return `the services ${services}`;
  }

  public static formatOpened(name: string, methods: string, tools: string, services: string): string {
    return `Activated and deactivated the runtime part from ${name}, which registered ${methods}, ${tools} and ${services}.`;
  }
}

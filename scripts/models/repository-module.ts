/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type { IModulePackage } from "../interfaces/i-module-package.ts";
import { Resources } from "../resources.ts";

export class RepositoryModule {
  public static readonly main: RepositoryModule = new RepositoryModule(Resources.mainModuleName, Resources.mainPackageName);
  public static readonly gitHub: RepositoryModule = new RepositoryModule(Resources.gitHubModuleName, Resources.gitHubPackageName, [RepositoryModule.main]);
  public static readonly azureDevOps: RepositoryModule = new RepositoryModule(Resources.azureDevOpsModuleName, Resources.azureDevOpsPackageName,
    [RepositoryModule.main]);
  public static readonly all: readonly RepositoryModule[] = [RepositoryModule.main, RepositoryModule.gitHub, RepositoryModule.azureDevOps];
  public static readonly shared: readonly IModulePackage[] = [{ folder: Resources.hostingProtocolFolder, name: Resources.hostingProtocolPackageName }];

  public readonly name: string;
  public readonly packageName: string;
  public readonly dependencies: readonly RepositoryModule[];

  public constructor(name: string, packageName: string, dependencies: readonly RepositoryModule[] = []) {
    this.name = name;
    this.packageName = packageName;
    this.dependencies = dependencies;
  }

  public get folder(): string {
    return path.posix.join(Resources.sourceFolder, this.name);
  }

  public get protocolFolder(): string {
    return `${this.folder}${Resources.protocolSuffix}`;
  }

  public get windowFolder(): string {
    return `${this.folder}${Resources.windowSuffix}`;
  }

  public get protocolName(): string {
    return `${this.packageName}${Resources.protocolSuffix}`;
  }

  public get windowName(): string {
    return `${this.packageName}${Resources.windowSuffix}`;
  }

  public get archivePrefix(): string {
    return this.packageName.replace(Resources.scopeMark, "").replace(Resources.pathSeparator, Resources.dash);
  }
}

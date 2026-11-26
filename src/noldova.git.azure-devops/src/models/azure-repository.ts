/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class AzureRepository {
  public readonly organization: string;
  public readonly project: string;
  public readonly name: string;

  private constructor(organization: string, project: string, name: string) {
    this.organization = organization;
    this.project = project;
    this.name = name;
  }

  public static parse(host: string, path: string): AzureRepository | null {
    const full: string | null = AzureRepository.fullPathOf(host, path);
    if (full === null || !Resources.fullPathPattern.test(full))
      return null;
    const first: number = full.indexOf(Resources.pathSeparator);
    const last: number = full.lastIndexOf(Resources.pathSeparator);
    const project: string | null = AzureRepository.decode(full.slice(first + 1, last));
    const name: string | null = AzureRepository.decode(full.slice(last + 1));
    return project === null || name === null ? null : new AzureRepository(full.slice(0, first), project, name);
  }

  private static decode(text: string): string | null {
    try {
      return decodeURIComponent(text);
    }
    catch {
      return null;
    }
  }

  private static fullPathOf(host: string, path: string): string | null {
    if (host === Resources.host)
      return Resources.webPathPattern.test(path) ? path.replace(Resources.webPathPattern, Resources.fullPathReplacement) : null;
    if (host === Resources.sshHost || host === Resources.visualStudioSshHost)
      return Resources.sshPathPattern.test(path) ? path.replace(Resources.sshPathPattern, Resources.sshPathReplacement) : null;
    if (!host.endsWith(Resources.visualStudioSuffix) || !Resources.collectionPathPattern.test(path))
      return null;
    return `${host.slice(0, -Resources.visualStudioSuffix.length)}${Resources.pathSeparator}${path.replace(Resources.collectionPathPattern, Resources.fullPathReplacement)}`;
  }
}

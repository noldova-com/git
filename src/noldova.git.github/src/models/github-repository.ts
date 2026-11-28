/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHubNames } from "@noldova/git.github.protocol";
import { HostReference } from "@noldova/git.hosting.protocol";

import { Resources } from "../resources.ts";

export class GitHubRepository {
  public readonly host: string;
  public readonly owner: string;
  public readonly name: string;

  private constructor(host: string, owner: string, name: string) {
    this.host = host;
    this.owner = owner;
    this.name = name;
  }

  public static parse(host: string, path: string): GitHubRepository | null {
    const trimmed: string = path.endsWith(Resources.gitSuffix) ? path.slice(0, -Resources.gitSuffix.length) : path;
    if (!Resources.repositoryPathPattern.test(trimmed))
      return null;
    const slash: number = trimmed.indexOf(Resources.repositoryPathSeparator);
    return new GitHubRepository(host.toLowerCase(), trimmed.slice(0, slash), trimmed.slice(slash + 1));
  }

  public static ofReference(reference: HostReference): GitHubRepository | null {
    return reference.host === GitHubNames.moduleId
      ? GitHubRepository.parse(reference.place ?? Resources.host, Resources.formatRepositoryName(reference.owner, reference.repository)) : null;
  }

  public get place(): string | null {
    return this.host === Resources.host ? null : this.host;
  }

  public get repositoryPath(): string {
    return Resources.formatRepositoryName(this.owner, this.name);
  }

  public get path(): string {
    return Resources.formatRepositoryReadPath(encodeURIComponent(this.owner), encodeURIComponent(this.name));
  }

  public referenceOf(number: number): HostReference {
    return new HostReference(GitHubNames.moduleId, this.owner, this.name, number, this.place);
  }

  public pathOf(rest: string): string {
    return Resources.formatRepositoryPath(encodeURIComponent(this.owner), encodeURIComponent(this.name), rest);
  }
}

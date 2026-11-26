/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class GitArguments {
  public readonly options: readonly string[];
  public readonly revisions: readonly string[];
  public readonly paths: readonly string[];

  public constructor(options: readonly string[], revisions: readonly string[] = [], paths: readonly string[] = []) {
    this.options = options;
    this.revisions = revisions;
    this.paths = paths;
  }

  public get values(): readonly string[] {
    return [
      ...this.options,
      ...(this.revisions.length > 0 ? [Resources.endOfOptions, ...this.revisions] : []),
      ...(this.paths.length > 0 ? [Resources.endOfRevisions, ...this.paths] : [])
    ];
  }

  public withRevisions(revisions: readonly string[]): GitArguments {
    return new GitArguments(this.options, [...this.revisions, ...revisions], this.paths);
  }

  public withPaths(paths: readonly string[]): GitArguments {
    return new GitArguments(this.options, this.revisions, [...this.paths, ...paths]);
  }

  public withLiteralPaths(): GitArguments {
    return new GitArguments(this.options, this.revisions, this.paths.map(t => `${Resources.literalPathMagic}${t}`));
  }

  public withSettings(settings: readonly string[]): GitArguments {
    return new GitArguments([...settings, ...this.options], this.revisions, this.paths);
  }
}

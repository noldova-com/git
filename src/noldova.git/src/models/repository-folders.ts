/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RepositoryFolders {
  public readonly top: string;
  public readonly gitFolder: string;
  public readonly commonGitFolder: string;

  public constructor(top: string, gitFolder: string, commonGitFolder: string) {
    this.top = top;
    this.gitFolder = gitFolder;
    this.commonGitFolder = commonGitFolder;
  }
}

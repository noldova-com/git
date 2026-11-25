/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** An Azure DevOps address's organization, from its host or its first segment, and the path after it. */
export class OrganizationPath {
  public readonly organization: string;
  public readonly path: string;

  public constructor(organization: string, path: string) {
    this.organization = organization;
    this.path = path;
  }
}

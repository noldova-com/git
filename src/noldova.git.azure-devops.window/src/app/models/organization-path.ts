/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OrganizationPath {
  public readonly organization: string;
  public readonly path: string;

  public constructor(organization: string, path: string) {
    this.organization = organization;
    this.path = path;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProjectPlace {
  public readonly organization: string;
  public readonly project: string;

  public constructor(organization: string, project: string) {
    this.organization = organization;
    this.project = project;
  }
}

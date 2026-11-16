/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly accessMember: string = "access";

  public static formatManageAccessUrl(clientId: string): string {
    return `https://github.com/settings/connections/applications/${clientId}`;
  }
}

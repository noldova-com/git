/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostAccount } from "@noldova/git.hosting.protocol";

import type { EnterpriseEntry } from "./enterprise-entry.ts";

export class SignedInEnterprise {
  public readonly entry: EnterpriseEntry;
  public readonly person: HostAccount;

  public constructor(entry: EnterpriseEntry, person: HostAccount) {
    this.entry = entry;
    this.person = person;
  }
}

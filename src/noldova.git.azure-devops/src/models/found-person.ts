/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.ts";

export class FoundPerson {
  public readonly descriptor: string;
  public readonly name: string;
  public readonly login: string;
  public readonly isGroup: boolean;

  public constructor(descriptor: string, name: string, login: string, isGroup: boolean) {
    this.descriptor = descriptor;
    this.name = name;
    this.login = login;
    this.isGroup = isGroup;
  }

  public toJson(): JsonValue {
    return { [Resources.descriptorField]: this.descriptor, [Resources.nameField]: this.name, [Resources.loginField]: this.login,
      [Resources.isGroupField]: this.isGroup };
  }
}

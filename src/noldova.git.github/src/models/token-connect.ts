/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";

export class TokenConnect {
  public readonly host: string;
  public readonly token: string;

  public constructor(host: string, token: string) {
    this.host = host;
    this.token = token;
  }

  public static fromJson(value: unknown): TokenConnect {
    const reader: JsonReader = JsonReader.fromValue(value);
    return new TokenConnect(reader.readNonBlankString(Resources.hostField), reader.readNonBlankString(Resources.tokenField));
  }
}

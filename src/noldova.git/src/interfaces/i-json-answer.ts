/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/git.protocol";

/** A read's answer, which the runtime sends to the window as its JSON. */
export interface IJsonAnswer {
  toJson(): JsonObject;
}

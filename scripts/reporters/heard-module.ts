/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TestModule } from "vitest/node";

export class HeardModule {
  public readonly module: TestModule;
  public heard: number;

  public constructor(module: TestModule, heard: number) {
    this.module = module;
    this.heard = heard;
  }
}

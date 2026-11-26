/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Injector, Type } from "@angular/core";

export class GitHostRowView {
  public readonly component: Type<unknown>;
  public readonly injector: Injector;

  public constructor(component: Type<unknown>, injector: Injector) {
    this.component = component;
    this.injector = injector;
  }
}

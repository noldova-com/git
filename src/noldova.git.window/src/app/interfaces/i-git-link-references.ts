/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Injector } from "@angular/core";
import type { ILinkReferenceSource } from "@noldova/ui.components.angular";

export interface IGitLinkReferences {
  referencesFor(folder: string): ILinkReferenceSource | null;

  opens?(folder: string, url: string, injector: Injector): boolean;
}

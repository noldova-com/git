/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Injector } from "@angular/core";
import type { ILinkReferenceSource } from "@noldova/ui.components.angular";

/** What a host module gives the Git view so that links to its items in a commit's message show as reference chips. */
export interface IGitLinkReferences {
  /**
   * The links this host knows in the repository at a folder, or null when it knows none there.
   * The view reads it inside a computed signal, so a source whose answer depends on signals keeps the message current.
   */
  referencesFor(folder: string): ILinkReferenceSource | null;

  /**
   * Opens a link of the host's own, such as a reference card's action, in the repository at a folder, and answers true; false leaves the link
   * to the window, which opens it in a browser. The injector is the window's, so the host can open a kit dialog over it.
   */
  opens?(folder: string, url: string, injector: Injector): boolean;
}

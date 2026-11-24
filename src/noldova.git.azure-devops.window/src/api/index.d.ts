/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/desktop.window";

/**
 * The Azure DevOps module's window part, which Noldova Desktop activates in each window.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/git.azure-devops.window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export declare const windowPart: IWindowPart;

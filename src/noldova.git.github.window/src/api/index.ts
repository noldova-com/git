/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/desktop.window";

import { GitHubWindowPart } from "../app/services/github-window-part.ts";

export { GitHubLook } from "../app/models/github-look.ts";
export { GitHubLookColor } from "../app/models/github-look-color.ts";
export { GitHubLooks } from "../app/services/github-looks.ts";

export const windowPart: IWindowPart = new GitHubWindowPart();

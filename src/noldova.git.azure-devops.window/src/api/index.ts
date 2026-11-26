/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/desktop.window";

import { AzureDevOpsWindowPart } from "../app/services/azure-devops-window-part.ts";

export const windowPart: IWindowPart = new AzureDevOpsWindowPart();

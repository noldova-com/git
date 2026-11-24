/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { windowPart } from "../../src/api/index.ts";
import { AzureDevOpsWindowPart } from "../../src/app/services/azure-devops-window-part.ts";

describe("api", () => {
  it("exports the Azure DevOps module's window part as windowPart", () => {
    expect(windowPart).toBeInstanceOf(AzureDevOpsWindowPart);
    expect(windowPart.moduleId).toBe("git-azure-devops");
  });
});

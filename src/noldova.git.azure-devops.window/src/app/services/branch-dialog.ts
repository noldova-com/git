/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Injector } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { DialogService } from "@noldova/ui.components.angular";

import { AzureDevOpsBranchComponent } from "../components/azure-devops-branch/azure-devops-branch.component.ts";
import type { BranchRequest } from "../models/branch-request.ts";
import { Resources } from "../../resources.ts";

export class BranchDialog {
  public static open(context: IWindowPartContext, request: BranchRequest, injector: Injector): void {
    const dialog = injector.get(DialogService).open(AzureDevOpsBranchComponent, Resources.branchNameSelector);
    dialog.componentRef?.setInput(Resources.requestInput, request);
    dialog.componentRef?.setInput(Resources.contextInput, context);
    dialog.componentInstance?.closed.subscribe(() => {
      dialog.close();
    });
  }
}

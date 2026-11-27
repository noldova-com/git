/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";

export class AccountSettings {
  public static open(context: IWindowPartContext): void {
    void AccountSettings.openAsync(context);
  }

  private static async openAsync(context: IWindowPartContext): Promise<void> {
    try {
      await context.runCommandAsync(Resources.openSettingsCommand, { [Resources.settingsPageArgument]: Resources.accountsPage });
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      context.log(Resources.formatRequestFailed(Resources.openSettingsCommand, String(error)));
    }
  }
}

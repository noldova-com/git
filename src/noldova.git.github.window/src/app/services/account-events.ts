/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { HostAccountList, HostingProtocolException } from "@noldova/git.hosting.protocol";

import { Resources } from "../../resources.ts";

export class AccountEvents {
  public static follow(context: IWindowPartContext, changed: (accounts: HostAccountList) => void): () => void {
    return context.onEvent(GitHubNames.accountsChangedEvent, payload => {
      let accounts: HostAccountList;
      try {
        accounts = HostAccountList.fromJson(payload);
      }
      catch (error) {
        if (!(error instanceof JsonException || error instanceof HostingProtocolException))
          throw error;
        context.log(Resources.formatEventUnread(GitHubNames.accountsChangedEvent, String(error)));
        return;
      }
      changed(accounts);
    });
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccountList, HostingProtocolException, SignInState } from "@noldova/git.hosting.protocol";

import { Resources } from "../../resources.ts";

export class AccountEvents {
  public static follow(context: IWindowPartContext, changed: (accounts: HostAccountList) => void): () => void {
    return context.onEvent(AzureDevOpsNames.accountsChangedEvent, payload => {
      let accounts: HostAccountList;
      try {
        accounts = HostAccountList.fromJson(payload);
      }
      catch (error) {
        if (!(error instanceof JsonException || error instanceof HostingProtocolException))
          throw error;
        context.log(Resources.formatEventUnread(AzureDevOpsNames.accountsChangedEvent, String(error)));
        return;
      }
      changed(accounts);
    });
  }

  public static followOthers(context: IWindowPartContext, changed: () => void): () => void {
    let before: ReadonlyMap<number, SignInState> = new Map();
    return AccountEvents.follow(context, list => {
      const states: ReadonlyMap<number, SignInState> = new Map(list.accounts.map(t => [t.id, t.signIn.state]));
      const ids: ReadonlySet<number> = new Set([...states.keys(), ...before.keys()]);
      const isChanged: boolean = [...ids].some(t => t !== Resources.firstAccount && states.get(t) !== before.get(t) && states.get(t) !== SignInState.Waiting);
      before = states;
      if (isChanged)
        changed();
    });
  }
}

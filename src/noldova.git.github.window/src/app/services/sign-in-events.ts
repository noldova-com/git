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
import { HostingProtocolException, HostSignIn } from "@noldova/git.hosting.protocol";

import { Resources } from "../../resources.ts";

export class SignInEvents {
  public static follow(context: IWindowPartContext, changed: (signIn: HostSignIn) => void): () => void {
    return context.onEvent(GitHubNames.signInChangedEvent, payload => {
      let signIn: HostSignIn;
      try {
        signIn = HostSignIn.fromJson(payload);
      }
      catch (error) {
        if (!(error instanceof JsonException || error instanceof HostingProtocolException))
          throw error;
        context.log(Resources.formatEventUnread(GitHubNames.signInChangedEvent, String(error)));
        return;
      }
      changed(signIn);
    });
  }
}

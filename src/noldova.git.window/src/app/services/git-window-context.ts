/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { GitWindowInactiveException } from "../exceptions/git-window-inactive.exception.ts";

export class GitWindowContext {
  private static active: IWindowPartContext | null = null;

  public static provide(context: IWindowPartContext): () => void {
    GitWindowContext.active = context;
    return () => {
      if (GitWindowContext.active === context)
        GitWindowContext.active = null;
    };
  }

  public static current(): IWindowPartContext {
    if (Object.isNull(GitWindowContext.active))
      throw new GitWindowInactiveException();
    return GitWindowContext.active;
  }
}

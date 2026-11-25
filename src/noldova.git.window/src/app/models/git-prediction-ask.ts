/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PredictionAction } from "@noldova/git.protocol";

/** An action on a commit whose outcome Git is asked to predict, with the label its line names it by. */
export class GitPredictionAsk {
  public readonly label: string;
  public readonly action: PredictionAction;

  public constructor(label: string, action: PredictionAction) {
    this.label = label;
    this.action = action;
  }
}

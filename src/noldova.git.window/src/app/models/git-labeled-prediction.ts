/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitPrediction } from "@noldova/git.protocol";

export class GitLabeledPrediction {
  public readonly label: string;
  public readonly prediction: GitPrediction;

  public constructor(label: string, prediction: GitPrediction) {
    this.label = label;
    this.prediction = prediction;
  }
}

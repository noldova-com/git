/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Where an agent's run in a repository stands, which its row's icon shows. */
export enum GitAgentState {
  /** The agent is working. */
  Working = "Working",
  /** The agent waits for the person, such as for an answer or an approval. */
  WaitingForYou = "WaitingForYou",
  /** The run ended with its work done. */
  Done = "Done",
  /** The run ended with a failure. */
  Failed = "Failed"
}

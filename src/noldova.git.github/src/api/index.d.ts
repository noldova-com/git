/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";

/** The service the runtime part publishes as `git-github.access`, as `@noldova/git.github.protocol` declares it. */
export type { IGitHubAccess } from "@noldova/git.github.protocol";

/**
 * The GitHub module's runtime part, which Noldova Desktop activates in the app's main process.
 *
 * @example
 * ```ts
 * import { RuntimePart } from "@noldova/git.github/runtime";
 *
 * const part = new RuntimePart();
 * console.log(part.isActive);
 * ```
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * Whether Noldova Desktop has activated the part and not yet deactivated it.
   */
  public get isActive(): boolean;

  /**
   * Activates the part: it declares the `git-github.signInChanged` event, registers the sign-in's methods `git-github.readSignIn`,
   * `git-github.startSignIn`, `git-github.cancelSignIn` and `git-github.signOut`, and the methods `git-github.readReference`,
   * `git-github.readBranchPullRequest` and `git-github.createPullRequest`, publishes the `git-github.access` service, restores the sign-in kept
   * on this computer and then registers the agent tools `git_github_read`, `git_github_pr_checks` and `git_github_pr_create`.
   *
   * @param context The runtime's context for this part, which the part keeps until it deactivates.
   * @returns A promise that resolves once the part is active and its tools are registered.
   * @throws The failure itself, as a rejection, when reading the kept sign-in fails other than as the secrets' own `MethodFailureException`;
   * the part's methods, event and service stay registered, and its tools aren't.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimePart } from "@noldova/git.github/runtime";
   *
   * export async function activateAsync(context: IRuntimePartContext): Promise<RuntimePart> {
   *   const part = new RuntimePart();
   *   await part.activateAsync(context);
   *   return part;
   * }
   * ```
   */
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Deactivates the part and lets go of its context.
   *
   * @returns A promise that resolves once the part is inactive; it never rejects.
   * Calling it again, or before {@link RuntimePart.activateAsync}, does nothing.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimePart } from "@noldova/git.github/runtime";
   *
   * export async function activateAndStopAsync(context: IRuntimePartContext): Promise<void> {
   *   const part = new RuntimePart();
   *   await part.activateAsync(context);
   *   await part.deactivateAsync();
   * }
   * ```
   */
  public deactivateAsync(): Promise<void>;
}

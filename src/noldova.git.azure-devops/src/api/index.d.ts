/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";

/**
 * The Azure DevOps module's runtime part, which Noldova Desktop activates in the app's main process.
 *
 * @example
 * ```ts
 * import { RuntimePart } from "@noldova/git.azure-devops/runtime";
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
   * Activates the part: it declares the `git-azure-devops.signInChanged` event, registers the sign-in's methods `git-azure-devops.readSignIn`,
   * `git-azure-devops.signInWithToken` and `git-azure-devops.signOut`, and the methods `git-azure-devops.readReference`,
   * `git-azure-devops.readBranchPullRequest` and `git-azure-devops.readPullRequest`, and then restores the sign-in kept on this computer.
   *
   * @param context The runtime's context for this part, which the part keeps until it deactivates.
   * @returns A promise that resolves once the part is active.
   * @throws The failure itself, as a rejection, when reading the kept sign-in fails other than as the secrets' own `MethodFailureException`;
   * the part's methods and event stay registered.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimePart } from "@noldova/git.azure-devops/runtime";
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
   * import { RuntimePart } from "@noldova/git.azure-devops/runtime";
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

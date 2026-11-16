/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePart, IRuntimePartContext, Migration } from "@noldova/desktop.runtime";

/**
 * The Git module's runtime part, which Noldova Desktop activates in the app's main process.
 *
 * @example
 * ```ts
 * import { RuntimePart } from "@noldova/git/runtime";
 *
 * const part = new RuntimePart();
 * console.log(part.isActive);
 * ```
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * The migrations of the module's database: `create-worktrees`, which makes the `worktrees` table. Noldova Desktop runs them before activation.
   */
  public readonly migrations: readonly Migration[];

  /**
   * Whether Noldova Desktop has activated the part and not yet deactivated it.
   */
  public get isActive(): boolean;

  /**
   * Activates the part: it registers `git.status`, `git.diff`, `git.branches`, `git.log`, `git.worktrees`, `git.pullHooks`, `git.watch`, `git.unwatch`, `git.stage`, `git.unstage`, `git.createBranch`, `git.switchBranch`, `git.commit`, `git.push` and `git.pull`, offers the agent tools `git_status`, `git_diff`, `git_log`, `git_branches`, `git_stage`, `git_unstage`, `git_create_branch`, `git_switch_branch`, `git_commit`, `git_push` and `git_pull` in the repository that holds the session's `git.folder`, and declares `git.changed`, and publishes `git.repositories`, a `GitRepositories` whose status read goes as `git.status` does; the reads read the repository holding a folder through the
   * person's own git, 2.39 or later, one read at a time per repository, and answer its `GitStatus`, `GitDiff`, `GitBranches`, `GitLog`, `GitWorktrees` and `GitHooks`. A failure answers with Noldova Desktop's code and a `GitFailure` in its details:
   * refused parameters as `InvalidParams`, a folder outside a repository as `NotFound`, a missing or older git, or a folder the person's account may not read, as `Unavailable`, and any other
   * failure of git as `Internal`; no message holds a URL's name, password or token.
   * `git.watch` answers once the watch has started, so a change made after the answer is heard: within a few seconds at most, when the file system never confirms the start.
   * While a window watches a folder, it hears `git.changed` each time the status of the folder's repository moves, and once after its first read;
   * a closed window or connection drops its watches, and deactivating stops every watch and withdraws the tools.
   * Each write is a person's own click: it answers `Unauthorized` to any caller but the app's main process acting for a window, and never asks.
   * It runs on the status its `basedOn` fingerprint names, one write at a time per repository, and answers `null`; a status that moved since fails as
   * `Conflict` with the `Stale` code, a write the status can't take fails with its Git code, and a write cancelled or out of time after git
   * started fails with `OutcomeUnknown`. A push sends only the current branch, to its upstream or under its own name, never forced.
   *
   * @param context The runtime's context for this part, which the part keeps until it deactivates.
   * @returns A promise that resolves once the part is active; it rejects, leaving the part inactive, when the module's `worktrees` table can't be read or when Noldova Desktop refuses to register one of its methods or tools.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimePart } from "@noldova/git/runtime";
   *
   * async function activateAsync(context: IRuntimePartContext): Promise<RuntimePart> {
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
   * import { RuntimePart } from "@noldova/git/runtime";
   *
   * async function activateBrieflyAsync(context: IRuntimePartContext): Promise<void> {
   *   const part = new RuntimePart();
   *   await part.activateAsync(context);
   *   await part.deactivateAsync();
   * }
   * ```
   */
  public deactivateAsync(): Promise<void>;
}

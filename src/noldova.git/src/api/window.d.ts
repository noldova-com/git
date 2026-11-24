/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The Git module's window part, its folder provider, host rows and link sources, which come from its own package, `@noldova/git.window`,
 * that this package pins exactly.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/git/window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export { GitAvatars, GitFolder, GitFolderProvidedException, GitHostRows, GitLinkReferences, GitWindowException, type IGitAvatars, type IGitHostRow, type IGitLinkReferences, windowPart }
  from "@noldova/git.window";

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPart } from "@noldova/desktop.window";
import type { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";

/**
 * The GitHub module's window part, which Noldova Desktop activates in each window.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/git.github.window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export declare const windowPart: IWindowPart;

/**
 * A GitHub state's colors in one mode, as CSS colors: its text and icon, and the fill behind its badge.
 *
 * @example
 * ```ts
 * import { GitHubLooks } from "@noldova/git.github.window";
 * import { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
 *
 * console.log(GitHubLooks.of(ReferenceKind.PullRequest, ReferenceState.Merged)?.dark.color);
 * ```
 */
export declare class GitHubLookColor {
  /**
   * The text's and the icon's color, such as `#A371F7` or `var(--nol-status-ok)`.
   */
  public readonly color: string;

  /**
   * The badge's fill, such as `color-mix(in srgb, #A371F7 18%, transparent)`.
   */
  public readonly background: string;

  /**
   * Makes a state's colors in one mode.
   *
   * @param color The text's and the icon's color.
   * @param background The badge's fill.
   * @example
   * ```ts
   * import { GitHubLookColor } from "@noldova/git.github.window";
   *
   * const purple = new GitHubLookColor("#8250DF", "color-mix(in srgb, #8250DF 14%, transparent)");
   * ```
   */
  public constructor(color: string, background: string);
}

/**
 * How GitHub shows an issue or a pull request in one state: the kind's and the state's labels in GitHub's words, the state's
 * Octicon and its colors in light and dark.
 *
 * @example
 * ```ts
 * import { GitHubLooks } from "@noldova/git.github.window";
 * import { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
 *
 * const look = GitHubLooks.of(ReferenceKind.PullRequest, ReferenceState.Draft);
 * console.log(look?.kindLabel, look?.stateLabel, look?.light.color);
 * ```
 */
export declare class GitHubLook {
  /**
   * The kind's label, `Pull request` or `Issue`.
   */
  public readonly kindLabel: string;

  /**
   * The state's label, as GitHub's state badge reads: `Open`, `Draft`, `Merged` or `Closed`; an issue closed as done and one closed as not planned both read `Closed`, and their icons and colors tell them apart.
   */
  public readonly stateLabel: string;

  /**
   * The state's 16px monochrome Octicon as a `data:image/svg+xml` address, which a mask draws in the state's color; the icon has no fill, so an image draws it black.
   */
  public readonly icon: string;

  /**
   * The state's colors in the light themes.
   */
  public readonly light: GitHubLookColor;

  /**
   * The state's colors in the dark themes.
   */
  public readonly dark: GitHubLookColor;

  /**
   * Makes a look.
   *
   * @param kindLabel The kind's label.
   * @param stateLabel The state's label.
   * @param icon The state's icon as a `data:image/svg+xml` address.
   * @param light The colors in the light themes.
   * @param dark The colors in the dark themes.
   * @example
   * ```ts
   * import { GitHubLook, GitHubLookColor } from "@noldova/git.github.window";
   *
   * const color = new GitHubLookColor("var(--nol-status-ok)", "color-mix(in srgb, var(--nol-status-ok) 16%, transparent)");
   * const look = new GitHubLook("Pull request", "Open", "data:image/svg+xml,", color, color);
   * ```
   */
  public constructor(kindLabel: string, stateLabel: string, icon: string, light: GitHubLookColor, dark: GitHubLookColor);
}

/**
 * GitHub's look for each kind and state, fixed in the module, so an app draws a GitHub reference chip from a `HostItem`'s kind and
 * state alone: open in the ok status color, draft and not planned muted, merged and done issues in GitHub's purple, a closed pull
 * request in the failed status color.
 *
 * @example
 * ```ts
 * import { GitHubLooks } from "@noldova/git.github.window";
 * import { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
 *
 * const look = GitHubLooks.of(ReferenceKind.Issue, ReferenceState.ClosedNotPlanned);
 * console.log(look?.stateLabel, GitHubLooks.mark.length);
 * ```
 */
export declare class GitHubLooks {
  /**
   * GitHub's 16px monochrome mark as a `data:image/svg+xml` address.
   */
  public static readonly mark: string;

  /**
   * Answers GitHub's look for a kind in a state.
   *
   * @param kind The item's kind.
   * @param state The item's state.
   * @returns The look, or null for a state the kind doesn't have, such as a merged issue.
   * @example
   * ```ts
   * import { GitHubLooks } from "@noldova/git.github.window";
   * import { ReferenceKind, ReferenceState } from "@noldova/git.hosting.protocol";
   *
   * console.log(GitHubLooks.of(ReferenceKind.PullRequest, ReferenceState.Merged)?.stateLabel);
   * console.log(GitHubLooks.of(ReferenceKind.Issue, ReferenceState.Merged));
   * ```
   */
  public static of(kind: ReferenceKind, state: ReferenceState): GitHubLook | null;
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal, Type } from "@angular/core";
import { Exception, type ExceptionOptions } from "@noldova/context.exceptions";
import type { IWindowPart, IWindowPartContext } from "@noldova/desktop.window";
import type { GitRemote } from "@noldova/git.protocol";

/**
 * The base of the Git window part's own exceptions; catch it to catch them all.
 * It is abstract: providing a second folder provider throws {@link GitFolderProvidedException}.
 * @example
 * ```ts
 * import { GitWindowException } from "@noldova/git.window";
 *
 * export function isGitWindowFailure(error: unknown): boolean {
 *   return error instanceof GitWindowException;
 * }
 * ```
 */
export declare abstract class GitWindowException extends Exception {
  /**
   * The exception's name, `GitWindowException` unless a subclass names itself.
   */
  public override readonly name: string;

  /**
   * Creates the exception; only the window part's own exceptions call it.
   * @param message The message, from the window part's resources.
   * @param options The cause, when there is one.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * Thrown when an app provides the Git view's folder while another provider is still registered.
 */
export declare class GitFolderProvidedException extends GitWindowException {
  /**
   * The exception's name, `GitFolderProvidedException`.
   */
  public override readonly name: string;

  /**
   * Creates the exception, with a message that says to unregister the first provider.
   */
  public constructor();
}

/**
 * A host module's row in the Git view, shown under the branch for a remote the module claims, such as GitHub's pull request and its checks.
 *
 * @remarks
 * The view renders the component with the inputs `folder` (the repository's absolute folder), `branch` (the current branch, or `null` on a detached
 * HEAD), `head` (the commit HEAD names, or `null` before the first commit) and `remote` (the {@link GitRemote} it claimed). Its injector gives
 * `WindowPartTokens.context` as the providing module's context, not the Git view's, so the row reads and asks under its own module.
 */
export interface IGitHostRow {
  /**
   * Whether the row shows for this remote; the first registered row that claims a remote wins.
   * @param remote The repository's remote; its host and path are untrusted.
   * @returns `true` when the row shows for the remote.
   */
  claims(remote: GitRemote): boolean;

  /**
   * The standalone component the view renders in the row's place.
   */
  readonly component: Type<unknown>;
}

/**
 * A host row as {@link GitHostRows.provide} added it, with the context of the window part that provided it.
 */
export interface IProvidedGitHostRow {
  /**
   * The providing window part's context, which the view gives the row's component as `WindowPartTokens.context`.
   */
  readonly context: IWindowPartContext;

  /**
   * The row.
   */
  readonly row: IGitHostRow;
}

/**
 * The folder the Git view shows, which the app provides.
 */
export declare class GitFolder {
  /**
   * The provided folder, or `null` when there is no provider, it gives none, its value is refused, or reading it throws; a refused value or a throw
   * is logged through the provider's context, and the view shows a throw's message as its failure.
   */
  public static readonly folder: Signal<string | null>;

  /**
   * The message of the error the provided folder threw when read, which the view shows as its failure, or `null` when reading it didn't throw or
   * there is no provider.
   * @example
   * ```ts
   * import { computed, type Signal } from "@angular/core";
   * import { GitFolder } from "@noldova/git.window";
   *
   * export const folderUnreadable: Signal<boolean> = computed(() => GitFolder.failure() !== null);
   * ```
   */
  public static readonly failure: Signal<string | null>;

  /**
   * Provides the folder the Git view shows.
   * @param context The window part's context, which logs a folder the view refuses.
   * @param folder The folder, an absolute path of at most 4096 characters, or `null` for none.
   * @returns A function that unregisters the provider.
   * @throws {GitFolderProvidedException} When another provider is still registered.
   * @example
   * ```ts
   * import { signal } from "@angular/core";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitFolder } from "@noldova/git.window";
   *
   * export function showFolder(context: IWindowPartContext): () => void {
   *   return GitFolder.provide(context, signal("/home/a/repo"));
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, folder: Signal<string | null>): () => void;
}

/**
 * The host rows other modules add to the Git view.
 */
export declare class GitHostRows {
  /**
   * Adds a host row; rows are asked in the order they were added.
   * @param context The providing window part's context, which logs a claim that throws.
   * @param row The row.
   * @returns A function that removes the row.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import { GitHostRows } from "@noldova/git.window";
   *
   * export function addRow(context: IWindowPartContext, component: import("@angular/core").Type<unknown>): () => void {
   *   return GitHostRows.provide(context, { claims: t => t.host === "github.com", component });
   * }
   * ```
   */
  public static provide(context: IWindowPartContext, row: IGitHostRow): () => void;

  /**
   * Finds the row for a remote.
   * @param remote The repository's remote.
   * @returns The first added row that claims the remote, with its providing context, the same object for as long as the row stays added, or `null`
   * when none does and the view shows the plain remote line; a row whose claim throws is logged and skipped.
   */
  public static rowFor(remote: GitRemote): IProvidedGitHostRow | null;
}

/**
 * The Git module's window part, which Noldova Desktop activates in each window; it registers the Git view, `git.view`, in the right dock.
 *
 * @example
 * ```ts
 * import { windowPart } from "@noldova/git.window";
 *
 * console.log(windowPart.moduleId);
 * ```
 */
export declare const windowPart: IWindowPart;

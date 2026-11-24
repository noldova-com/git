/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
/** How a list of changed files is laid out. */
export enum GitFileLayout {
  /** Nested folders, each a step in under its parent, a folder holding only one folder shown with it as one row. */
  Tree = "Tree",
  /** One row for each folder that holds files, by its whole path, with its files under it. */
  Folders = "Folders",
  /** Whole paths, without folders. */
  List = "List"
}

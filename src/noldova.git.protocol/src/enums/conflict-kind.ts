/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ConflictKind = {
  BothModified: "BothModified",
  BothAdded: "BothAdded",
  BothDeleted: "BothDeleted",
  AddedByUs: "AddedByUs",
  AddedByThem: "AddedByThem",
  DeletedByUs: "DeletedByUs",
  DeletedByThem: "DeletedByThem"
} as const;

export type ConflictKind = (typeof ConflictKind)[keyof typeof ConflictKind];

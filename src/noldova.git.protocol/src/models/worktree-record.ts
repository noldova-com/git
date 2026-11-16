/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class WorktreeRecord {
  private static readonly FIELDS: readonly string[] = [
    Resources.keyField,
    Resources.repositoryField,
    Resources.pathField,
    Resources.branchField,
    Resources.baseField
  ];

  public readonly key: string;
  public readonly repository: string;
  public readonly path: string;
  public readonly branch: string;
  public readonly base: string;

  public constructor(key: string, repository: string, path: string, branch: string, base: string, reader?: JsonReader) {
    FieldCheck.requireText(key, Resources.keyField, reader);
    FieldCheck.requireText(repository, Resources.repositoryField, reader);
    FieldCheck.requireText(path, Resources.pathField, reader);
    FieldCheck.requireText(branch, Resources.branchField, reader);
    FieldCheck.requireObjectId(base, Resources.baseField, reader);

    this.key = key;
    this.repository = repository;
    this.path = path;
    this.branch = branch;
    this.base = base;
  }

  public static fromJson(value: unknown, path?: string): WorktreeRecord {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, WorktreeRecord.FIELDS);
    return new WorktreeRecord(
      reader.readString(Resources.keyField),
      reader.readString(Resources.repositoryField),
      reader.readString(Resources.pathField),
      reader.readString(Resources.branchField),
      reader.readString(Resources.baseField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.keyField]: this.key,
      [Resources.repositoryField]: this.repository,
      [Resources.pathField]: this.path,
      [Resources.branchField]: this.branch,
      [Resources.baseField]: this.base
    };
  }
}

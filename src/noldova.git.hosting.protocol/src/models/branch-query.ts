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

export class BranchQuery {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.pathField, Resources.branchField, Resources.headCommitField];

  public readonly host: string;
  public readonly path: string;
  public readonly branch: string;
  public readonly headCommit: string | null;

  public constructor(host: string, path: string, branch: string, headCommit: string | null, reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(path, Resources.pathField, reader);
    FieldCheck.requireText(branch, Resources.branchField, reader);
    if (headCommit !== null)
      FieldCheck.requireCommit(headCommit, Resources.headCommitField, reader);

    this.host = host;
    this.path = path;
    this.branch = branch;
    this.headCommit = headCommit;
  }

  public static fromJson(value: unknown, path?: string): BranchQuery {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, BranchQuery.FIELDS);
    return new BranchQuery(
      reader.readString(Resources.hostField),
      reader.readString(Resources.pathField),
      reader.readString(Resources.branchField),
      reader.readNullableString(Resources.headCommitField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.pathField]: this.path,
      [Resources.branchField]: this.branch,
      [Resources.headCommitField]: this.headCommit
    };
  }
}

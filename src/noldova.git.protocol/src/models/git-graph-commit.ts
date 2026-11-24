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
import { GitCommit } from "./git-commit.ts";
import { GitRef } from "./git-ref.ts";

/** A commit in the graph of every branch: the commit, its author's email and the labels that point at it. */
export class GitGraphCommit {
  private static readonly FIELDS: readonly string[] = [Resources.commitField, Resources.emailField, Resources.refsField];

  public readonly commit: GitCommit;
  public readonly email: string;
  public readonly refs: readonly GitRef[];

  public constructor(commit: GitCommit, email: string, refs: readonly GitRef[], reader?: JsonReader) {
    FieldCheck.requireLine(email, Resources.emailField, reader);

    this.commit = commit;
    this.email = email;
    this.refs = refs;
  }

  public static fromJson(value: unknown, path?: string): GitGraphCommit {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitGraphCommit.FIELDS);
    return new GitGraphCommit(FieldCheck.readModel(reader, Resources.commitField, GitCommit.fromJson), reader.readString(Resources.emailField),
      FieldCheck.readModels(reader, Resources.refsField, GitRef.fromJson), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.commitField]: this.commit.toJson(), [Resources.emailField]: this.email, [Resources.refsField]: this.refs.map(t => t.toJson()) };
  }
}

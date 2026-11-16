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

export class PullRequestDraft {
  private static readonly FIELDS: readonly string[] = [Resources.hostField, Resources.pathField, Resources.headBranchField, Resources.baseBranchField,
    Resources.titleField, Resources.bodyField, Resources.isDraftField];

  public readonly host: string;
  public readonly path: string;
  public readonly headBranch: string;
  public readonly baseBranch: string;
  public readonly title: string;
  public readonly body: string;
  public readonly isDraft: boolean;

  public constructor(host: string, path: string, headBranch: string, baseBranch: string, title: string, body: string, isDraft: boolean,
    reader?: JsonReader) {
    FieldCheck.requireText(host, Resources.hostField, reader);
    FieldCheck.requirePath(path, Resources.pathField, reader);
    FieldCheck.requireText(headBranch, Resources.headBranchField, reader);
    FieldCheck.requireText(baseBranch, Resources.baseBranchField, reader);
    FieldCheck.requireText(title, Resources.titleField, reader);
    if (headBranch === baseBranch)
      FieldCheck.fail(Resources.baseBranchField, Resources.otherBranchExpected, reader);

    this.host = host;
    this.path = path;
    this.headBranch = headBranch;
    this.baseBranch = baseBranch;
    this.title = title;
    this.body = body;
    this.isDraft = isDraft;
  }

  public static fromJson(value: unknown, path?: string): PullRequestDraft {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, PullRequestDraft.FIELDS);
    return new PullRequestDraft(
      reader.readString(Resources.hostField),
      reader.readString(Resources.pathField),
      reader.readString(Resources.headBranchField),
      reader.readString(Resources.baseBranchField),
      reader.readString(Resources.titleField),
      reader.readString(Resources.bodyField),
      reader.readBoolean(Resources.isDraftField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.hostField]: this.host,
      [Resources.pathField]: this.path,
      [Resources.headBranchField]: this.headBranch,
      [Resources.baseBranchField]: this.baseBranch,
      [Resources.titleField]: this.title,
      [Resources.bodyField]: this.body,
      [Resources.isDraftField]: this.isDraft
    };
  }
}

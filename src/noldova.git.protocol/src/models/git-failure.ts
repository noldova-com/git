/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { FailureCode } from "../enums/failure-code.ts";
import { GitCode } from "../enums/git-code.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitFailure {
  private static readonly FIELDS: readonly string[] = [Resources.codeField, Resources.gitCodeField, Resources.messageField, Resources.gitVersionField];

  public readonly code: FailureCode;
  public readonly gitCode: GitCode | null;
  public readonly message: string;
  public readonly gitVersion: string | null;

  public constructor(code: FailureCode, gitCode: GitCode | null, message: string, gitVersion: string | null, reader?: JsonReader) {
    FieldCheck.requireText(message, Resources.messageField, reader);
    if (!Object.isNull(gitVersion) && (gitCode !== GitCode.GitTooOld || !Resources.gitVersionPattern.test(gitVersion)))
      FieldCheck.fail(Resources.gitVersionField, Resources.gitVersionExpected, reader);

    this.code = code;
    this.gitCode = gitCode;
    this.message = message;
    this.gitVersion = gitVersion;
  }

  public static fromJson(value: unknown, path?: string): GitFailure {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitFailure.FIELDS);
    return new GitFailure(
      reader.readOneOf(Resources.codeField, Object.values(FailureCode)),
      FieldCheck.readNullableMember(reader, Resources.gitCodeField, Object.values(GitCode)),
      reader.readString(Resources.messageField),
      reader.readNullableString(Resources.gitVersionField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.codeField]: this.code,
      [Resources.gitCodeField]: this.gitCode,
      [Resources.messageField]: this.message,
      [Resources.gitVersionField]: this.gitVersion
    };
  }
}

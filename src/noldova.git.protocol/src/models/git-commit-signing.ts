/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { SigningFormat } from "../enums/signing-format.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

/** `git.commitSigning`'s answer: whether git signs a new commit, from `commit.gpgsign`, and the format it signs in, from `gpg.format`. */
export class GitCommitSigning {
  private static readonly FIELDS: readonly string[] = [Resources.signsField, Resources.formatField];

  public readonly signs: boolean;
  public readonly format: SigningFormat | null;

  public constructor(signs: boolean, format: SigningFormat | null, reader?: JsonReader) {
    if (format !== null && !Object.values(SigningFormat).includes(format))
      FieldCheck.fail(Resources.formatField, Resources.signingFormatExpected, reader);

    this.signs = signs;
    this.format = format;
  }

  public static fromJson(value: unknown, path?: string): GitCommitSigning {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommitSigning.FIELDS);
    return new GitCommitSigning(reader.readBoolean(Resources.signsField), FieldCheck.readNullableMember(reader, Resources.formatField, Object.values(SigningFormat)), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.signsField]: this.signs, [Resources.formatField]: this.format };
  }
}

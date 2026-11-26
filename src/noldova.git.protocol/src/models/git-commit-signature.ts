/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { SignatureState } from "../enums/signature-state.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitCommitSignature {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.stateField, Resources.signerField, Resources.keyField];

  public readonly id: string;
  public readonly state: SignatureState;
  public readonly signer: string | null;
  public readonly key: string | null;

  public constructor(id: string, state: SignatureState, signer: string | null, key: string | null, reader?: JsonReader) {
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    GitCommitSignature.requireSigned(signer, Resources.signerField, state, reader);
    GitCommitSignature.requireSigned(key, Resources.keyField, state, reader);

    this.id = id;
    this.state = state;
    this.signer = signer;
    this.key = key;
  }

  public static fromJson(value: unknown, path?: string): GitCommitSignature {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommitSignature.FIELDS);
    return new GitCommitSignature(reader.readString(Resources.idField), reader.readOneOf(Resources.stateField, Object.values(SignatureState)),
      reader.readNullableString(Resources.signerField), reader.readNullableString(Resources.keyField), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.stateField]: this.state, [Resources.signerField]: this.signer, [Resources.keyField]: this.key };
  }

  private static requireSigned(value: string | null, field: string, state: SignatureState, reader?: JsonReader): void {
    if (value === null)
      return;
    if (state === SignatureState.None)
      FieldCheck.fail(field, Resources.unsignedNullExpected, reader);
    FieldCheck.requireText(value, field, reader);
    FieldCheck.requireLine(value, field, reader);
  }
}

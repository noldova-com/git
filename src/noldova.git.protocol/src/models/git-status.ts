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
import { GitOperation } from "./git-operation.ts";
import { GitRemote } from "./git-remote.ts";
import { StatusEntry } from "./status-entry.ts";
import { StatusUpstream } from "./status-upstream.ts";

export class GitStatus {
  private static readonly FIELDS: readonly string[] = [
    Resources.branchField,
    Resources.headField,
    Resources.upstreamField,
    Resources.entriesField,
    Resources.truncatedField,
    Resources.fingerprintField,
    Resources.operationField,
    Resources.remoteField
  ];

  public readonly branch: string | null;
  public readonly head: string | null;
  public readonly upstream: StatusUpstream | null;
  public readonly entries: readonly StatusEntry[];
  public readonly truncated: boolean;
  public readonly fingerprint: string;
  public readonly operation: GitOperation | null;
  public readonly remote: GitRemote | null;

  public constructor(
    branch: string | null,
    head: string | null,
    upstream: StatusUpstream | null,
    entries: readonly StatusEntry[],
    truncated: boolean,
    fingerprint: string,
    operation: GitOperation | null,
    remote: GitRemote | null,
    reader?: JsonReader) {
    if (branch !== null)
      FieldCheck.requireText(branch, Resources.branchField, reader);
    if (head !== null)
      FieldCheck.requireObjectId(head, Resources.headField, reader);
    FieldCheck.requireText(fingerprint, Resources.fingerprintField, reader);

    this.branch = branch;
    this.head = head;
    this.upstream = upstream;
    this.entries = entries;
    this.truncated = truncated;
    this.fingerprint = fingerprint;
    this.operation = operation;
    this.remote = remote;
  }

  public static fromJson(value: unknown, path?: string): GitStatus {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitStatus.FIELDS);
    return new GitStatus(
      reader.readNullableString(Resources.branchField),
      reader.readNullableString(Resources.headField),
      FieldCheck.readNullableModel(reader, Resources.upstreamField, StatusUpstream.fromJson),
      FieldCheck.readModels(reader, Resources.entriesField, StatusEntry.fromJson),
      reader.readBoolean(Resources.truncatedField),
      reader.readString(Resources.fingerprintField),
      FieldCheck.readNullableModel(reader, Resources.operationField, GitOperation.fromJson),
      FieldCheck.readNullableModel(reader, Resources.remoteField, GitRemote.fromJson),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.branchField]: this.branch,
      [Resources.headField]: this.head,
      [Resources.upstreamField]: this.upstream?.toJson() ?? null,
      [Resources.entriesField]: this.entries.map(t => t.toJson()),
      [Resources.truncatedField]: this.truncated,
      [Resources.fingerprintField]: this.fingerprint,
      [Resources.operationField]: this.operation?.toJson() ?? null,
      [Resources.remoteField]: this.remote?.toJson() ?? null
    };
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import { ReferenceKind } from "../enums/reference-kind.ts";
import { ReferenceState } from "../enums/reference-state.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostChanges } from "./host-changes.ts";
import { HostPerson } from "./host-person.ts";
import { HostReference } from "./host-reference.ts";

export class HostItem {
  private static readonly FIELDS: readonly string[] = [Resources.referenceField, Resources.kindField, Resources.stateField, Resources.titleField,
    Resources.urlField, Resources.authorField, Resources.createdAtField, Resources.closedAtField, Resources.commentsField, Resources.changesField];
  private static readonly KINDS: readonly ReferenceKind[] = Object.values(ReferenceKind);
  private static readonly STATES: readonly ReferenceState[] = Object.values(ReferenceState);
  private static readonly PULL_REQUEST_STATES: readonly ReferenceState[] = [ReferenceState.Open, ReferenceState.Draft, ReferenceState.Merged,
    ReferenceState.Closed];
  private static readonly ISSUE_STATES: readonly ReferenceState[] = [ReferenceState.Open, ReferenceState.ClosedDone, ReferenceState.ClosedNotPlanned];
  private static readonly OPEN_STATES: readonly ReferenceState[] = [ReferenceState.Open, ReferenceState.Draft];

  public readonly reference: HostReference;
  public readonly kind: ReferenceKind;
  public readonly state: ReferenceState;
  public readonly title: string;
  public readonly url: string;
  public readonly author: HostPerson | null;
  public readonly createdAt: number;
  public readonly closedAt: number | null;
  public readonly comments: number;
  public readonly changes: HostChanges | null;

  public constructor(reference: HostReference, kind: ReferenceKind, state: ReferenceState, title: string, url: string, author: HostPerson | null,
    createdAt: number, closedAt: number | null, comments: number, changes: HostChanges | null, reader?: JsonReader) {
    const isPullRequest: boolean = kind === ReferenceKind.PullRequest;
    if (!(isPullRequest ? HostItem.PULL_REQUEST_STATES : HostItem.ISSUE_STATES).includes(state))
      FieldCheck.fail(Resources.stateField, isPullRequest ? Resources.pullRequestStateExpected : Resources.issueStateExpected, reader);
    FieldCheck.requireText(title, Resources.titleField, reader);
    FieldCheck.requireHttps(url, Resources.urlField, reader);
    FieldCheck.requirePositive(createdAt, Resources.createdAtField, reader);
    if (HostItem.OPEN_STATES.includes(state) !== (Object.isNull(closedAt)))
      FieldCheck.fail(Resources.closedAtField, Resources.closedAtExpected, reader);
    if (!Object.isNull(closedAt))
      FieldCheck.requirePositive(closedAt, Resources.closedAtField, reader);
    FieldCheck.requireCount(comments, Resources.commentsField, reader);
    if (isPullRequest !== (!Object.isNull(changes)))
      FieldCheck.fail(Resources.changesField, Resources.changesExpected, reader);

    this.reference = reference;
    this.kind = kind;
    this.state = state;
    this.title = title;
    this.url = url;
    this.author = author;
    this.createdAt = createdAt;
    this.closedAt = closedAt;
    this.comments = comments;
    this.changes = changes;
  }

  public static fromJson(value: unknown, path?: string): HostItem {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostItem.FIELDS);
    const reference = reader.readObject(Resources.referenceField);
    return new HostItem(
      HostReference.fromJson(reference.toJson(), reference.path),
      reader.readOneOf(Resources.kindField, HostItem.KINDS),
      reader.readOneOf(Resources.stateField, HostItem.STATES),
      reader.readString(Resources.titleField),
      reader.readString(Resources.urlField),
      FieldCheck.readNullableModel(reader, Resources.authorField, HostPerson.fromJson),
      reader.readInteger(Resources.createdAtField),
      reader.readNullableInteger(Resources.closedAtField),
      reader.readInteger(Resources.commentsField),
      FieldCheck.readNullableModel(reader, Resources.changesField, HostChanges.fromJson),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.referenceField]: this.reference.toJson(),
      [Resources.kindField]: this.kind,
      [Resources.stateField]: this.state,
      [Resources.titleField]: this.title,
      [Resources.urlField]: this.url,
      [Resources.authorField]: this.author?.toJson() ?? null,
      [Resources.createdAtField]: this.createdAt,
      [Resources.closedAtField]: this.closedAt,
      [Resources.commentsField]: this.comments,
      [Resources.changesField]: this.changes?.toJson() ?? null
    };
  }
}

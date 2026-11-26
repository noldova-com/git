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
import { HostReference } from "./host-reference.ts";
import { HostWorkItem } from "./host-work-item.ts";

export class HostWorkItemDetail {
  private static readonly FIELDS: readonly string[] = [Resources.itemField, Resources.pointsField, Resources.remainingField, Resources.completedField,
    Resources.orderField, Resources.acceptanceField, Resources.childrenField, Resources.pullRequestsField, Resources.commitsField, Resources.branchesField,
    Resources.isWaitingField];

  public readonly item: HostWorkItem;
  public readonly points: number | null;
  public readonly remaining: number | null;
  public readonly completed: number | null;
  public readonly order: number | null;
  public readonly acceptance: string | null;
  public readonly children: readonly number[];
  public readonly pullRequests: readonly HostReference[];
  public readonly commits: number;
  public readonly branches: readonly string[];
  public readonly isWaiting: boolean | null;

  public constructor(item: HostWorkItem, points: number | null, remaining: number | null, completed: number | null, order: number | null,
    acceptance: string | null, children: readonly number[], pullRequests: readonly HostReference[], commits: number, branches: readonly string[],
    isWaiting: boolean | null = null, reader?: JsonReader) {
    HostWorkItemDetail.requireAmount(points, Resources.pointsField, reader);
    HostWorkItemDetail.requireAmount(remaining, Resources.remainingField, reader);
    HostWorkItemDetail.requireAmount(completed, Resources.completedField, reader);
    if (order !== null && !Number.isFinite(order))
      FieldCheck.fail(Resources.orderField, Resources.finiteExpected, reader);
    if (acceptance !== null)
      FieldCheck.requireText(acceptance, Resources.acceptanceField, reader);
    for (const child of children)
      FieldCheck.requirePositive(child, Resources.childrenField, reader);
    if (new Set(children).size !== children.length || children.includes(item.id))
      FieldCheck.fail(Resources.childrenField, Resources.childrenExpected, reader);
    FieldCheck.requireCount(commits, Resources.commitsField, reader);
    for (const branch of branches)
      FieldCheck.requireText(branch, Resources.branchesField, reader);

    this.item = item;
    this.points = points;
    this.remaining = remaining;
    this.completed = completed;
    this.order = order;
    this.acceptance = acceptance;
    this.children = [...children];
    this.pullRequests = [...pullRequests];
    this.commits = commits;
    this.branches = [...branches];
    this.isWaiting = isWaiting;
  }

  public static fromJson(value: unknown, path?: string): HostWorkItemDetail {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostWorkItemDetail.FIELDS);
    const item = reader.readObject(Resources.itemField);
    return new HostWorkItemDetail(
      HostWorkItem.fromJson(item.toJson(), item.path),
      HostWorkItemDetail.readAmount(reader, Resources.pointsField),
      HostWorkItemDetail.readAmount(reader, Resources.remainingField),
      HostWorkItemDetail.readAmount(reader, Resources.completedField),
      HostWorkItemDetail.readAmount(reader, Resources.orderField),
      reader.readNullableString(Resources.acceptanceField),
      reader.readNumberArray(Resources.childrenField),
      reader.readObjectArray(Resources.pullRequestsField).map(t => HostReference.fromJson(t.toJson(), t.path)),
      reader.readInteger(Resources.commitsField),
      reader.readStringArray(Resources.branchesField),
      reader.readValue(Resources.isWaitingField) === null ? null : reader.readBoolean(Resources.isWaitingField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.itemField]: this.item.toJson(),
      [Resources.pointsField]: this.points,
      [Resources.remainingField]: this.remaining,
      [Resources.completedField]: this.completed,
      [Resources.orderField]: this.order,
      [Resources.acceptanceField]: this.acceptance,
      [Resources.childrenField]: [...this.children],
      [Resources.pullRequestsField]: this.pullRequests.map(t => t.toJson()),
      [Resources.commitsField]: this.commits,
      [Resources.branchesField]: [...this.branches],
      [Resources.isWaitingField]: this.isWaiting
    };
  }

  private static requireAmount(value: number | null, field: string, reader?: JsonReader): void {
    if (value !== null && (!Number.isFinite(value) || value < 0))
      FieldCheck.fail(field, Resources.amountExpected, reader);
  }

  private static readAmount(reader: JsonReader, field: string): number | null {
    return reader.readValue(field) === null ? null : reader.readNumber(field);
  }
}

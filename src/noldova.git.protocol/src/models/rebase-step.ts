/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { RebaseAction } from "../enums/rebase-action.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class RebaseStep {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.actionField, Resources.messageField];

  public readonly id: string;
  public readonly action: RebaseAction;
  public readonly message: string | null;

  public constructor(id: string, action: RebaseAction, message: string | null, reader?: JsonReader) {
    FieldCheck.requireObjectId(id, Resources.idField, reader);
    if ((action === RebaseAction.Reword || action === RebaseAction.Squash) !== (message !== null))
      FieldCheck.fail(Resources.messageField, Resources.rebaseMessageExpected, reader);
    if (message !== null) {
      FieldCheck.requireText(message.trim(), Resources.messageField, reader);
      FieldCheck.requireNoNul(message, Resources.messageField, reader);
    }

    this.id = id;
    this.action = action;
    this.message = message;
  }

  public static fromJson(value: unknown, path?: string): RebaseStep {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, RebaseStep.FIELDS);
    return new RebaseStep(
      reader.readString(Resources.idField),
      reader.readOneOf(Resources.actionField, Object.values(RebaseAction)),
      reader.readNullableString(Resources.messageField),
      reader);
  }

  public static requireSteps(steps: readonly RebaseStep[], reader?: JsonReader): void {
    const ids: ReadonlySet<string> = new Set(steps.map(t => t.id));
    const first: RebaseStep | undefined = steps.find(t => t.action !== RebaseAction.Drop);
    if (steps.length === 0 || steps.length > Resources.maximumRebaseSteps || ids.size !== steps.length
      || (first !== undefined && (first.action === RebaseAction.Squash || first.action === RebaseAction.Fixup)))
      FieldCheck.fail(Resources.stepsField, Resources.rebaseStepsExpected, reader);
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.actionField]: this.action, [Resources.messageField]: this.message };
  }
}

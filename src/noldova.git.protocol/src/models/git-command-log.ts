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
import { GitCommand } from "./git-command.ts";

export class GitCommandLog {
  private static readonly FIELDS: readonly string[] = [Resources.commandsField];

  public readonly commands: readonly GitCommand[];

  public constructor(commands: readonly GitCommand[], reader?: JsonReader) {
    if (commands.length > Resources.maximumLoggedCommands)
      FieldCheck.fail(Resources.commandsField, Resources.loggedCommandsExpected, reader);

    this.commands = commands;
  }

  public static fromJson(value: unknown, path?: string): GitCommandLog {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitCommandLog.FIELDS);
    return new GitCommandLog(FieldCheck.readModels(reader, Resources.commandsField, GitCommand.fromJson), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.commandsField]: this.commands.map(t => t.toJson()) };
  }
}

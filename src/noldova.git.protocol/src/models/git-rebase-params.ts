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
import { RebaseStep } from "./rebase-step.ts";

/**
 * The parameters of `git.rebase`: the folder, the full id of the commit to rebase the current branch onto, the steps in the order they run,
 * whether the other local branches on the replayed commits move with them, and the status it is based on.
 */
export class GitRebaseParams {
  private static readonly FIELDS: readonly string[] = [Resources.folderField, Resources.ontoField, Resources.stepsField, Resources.updateRefsField,
    Resources.basedOnField];

  public readonly folder: string;
  public readonly onto: string;
  public readonly steps: readonly RebaseStep[];
  public readonly updateRefs: boolean;
  public readonly basedOn: string;

  public constructor(folder: string, onto: string, steps: readonly RebaseStep[], updateRefs: boolean, basedOn: string, reader?: JsonReader) {
    FieldCheck.requireFolder(folder, Resources.folderField, reader);
    FieldCheck.requireObjectId(onto, Resources.ontoField, reader);
    RebaseStep.requireSteps(steps, reader);
    FieldCheck.requireText(basedOn, Resources.basedOnField, reader);

    this.folder = folder;
    this.onto = onto;
    this.steps = [...steps];
    this.updateRefs = updateRefs;
    this.basedOn = basedOn;
  }

  public static fromJson(value: unknown, path?: string): GitRebaseParams {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRebaseParams.FIELDS);
    return new GitRebaseParams(
      reader.readString(Resources.folderField),
      reader.readString(Resources.ontoField),
      FieldCheck.readModels(reader, Resources.stepsField, RebaseStep.fromJson),
      reader.readBoolean(Resources.updateRefsField),
      reader.readString(Resources.basedOnField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.folderField]: this.folder,
      [Resources.ontoField]: this.onto,
      [Resources.stepsField]: this.steps.map(t => t.toJson()),
      [Resources.updateRefsField]: this.updateRefs,
      [Resources.basedOnField]: this.basedOn
    };
  }
}

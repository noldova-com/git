/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitDiffPaths {
  public readonly paths: readonly string[];

  public constructor(paths: readonly string[], reader?: JsonReader) {
    if (paths.length > Resources.maximumPathCount)
      FieldCheck.fail(Resources.pathsField, Resources.diffPathCountExpected, reader);
    paths.forEach((path, index) => FieldCheck.requireRelativePath(path, Resources.formatItemField(Resources.pathsField, index), reader));

    this.paths = paths;
  }
}

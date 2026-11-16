/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type ToolCall, ToolContent, ToolFailureCode, ToolResult } from "@noldova/desktop.runtime";
import { JsonException } from "@noldova/context.json";
import { GitFolderBinding, ProtocolException, UntrustedSource } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import { GitToolFailures } from "./git-tool-failures.ts";

export class BoundFolder {
  public static of(call: ToolCall): string {
    try {
      return GitFolderBinding.fromBindings(call.bindings).folder;
    } catch (error) {
      if (!(error instanceof JsonException || error instanceof ProtocolException))
        throw error;
      throw GitToolFailures.fail(ToolFailureCode.Refused, Resources.formatNoFolder(String(error)), Resources.noFolderToolCode);
    }
  }

  public static resultOf(text: string | null): ToolResult {
    if (text === null)
      throw GitToolFailures.fail(ToolFailureCode.TooLarge, Resources.resultTooLarge, Resources.tooLargeToolCode);
    return new ToolResult([ToolContent.fromText(text, GitToolFailures.originOf(UntrustedSource.Repository))]);
  }
}

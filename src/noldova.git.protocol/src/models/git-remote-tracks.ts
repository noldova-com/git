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
import { GitBranchTrack } from "./git-branch-track.ts";

export class GitRemoteTracks {
  private static readonly FIELDS: readonly string[] = [Resources.tracksField];

  public readonly tracks: readonly GitBranchTrack[];

  public constructor(tracks: readonly GitBranchTrack[], reader?: JsonReader) {
    tracks.forEach((track, index) => {
      if (!FieldCheck.isBranchName(track.branch) || tracks.findIndex(t => t.branch === track.branch) !== index)
        FieldCheck.fail(Resources.formatItemField(Resources.tracksField, index), Resources.remoteTrackExpected, reader);
    });

    this.tracks = [...tracks];
  }

  public static fromJson(value: unknown, path?: string): GitRemoteTracks {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRemoteTracks.FIELDS);
    return new GitRemoteTracks(FieldCheck.readModels(reader, Resources.tracksField, GitBranchTrack.fromJson), reader);
  }

  public toJson(): JsonObject {
    return { [Resources.tracksField]: this.tracks.map(t => t.toJson()) };
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { RemoteTransport } from "../enums/remote-transport.ts";
import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";

export class GitRemote {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.hostField, Resources.pathField, Resources.transportField];

  public readonly name: string;
  public readonly host: string | null;
  public readonly path: string | null;
  public readonly transport: RemoteTransport;

  public constructor(name: string, host: string | null, path: string | null, transport: RemoteTransport, reader?: JsonReader) {
    FieldCheck.requireText(name, Resources.nameField, reader);
    if (host !== null && (host.length === 0 || Resources.refusedHostPattern.test(host)))
      FieldCheck.fail(Resources.hostField, Resources.hostExpected, reader);
    if (path !== null && (Resources.refusedRemotePathPattern.test(path) || path.split(Resources.pathSeparatorPattern).some(t => Resources.refusedRemoteSegmentPattern.test(t))))
      FieldCheck.fail(Resources.pathField, Resources.remotePathExpected, reader);

    this.name = name;
    this.host = host;
    this.path = path;
    this.transport = transport;
  }

  public static fromJson(value: unknown, path?: string): GitRemote {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, GitRemote.FIELDS);
    return new GitRemote(
      reader.readString(Resources.nameField),
      reader.readNullableString(Resources.hostField),
      reader.readNullableString(Resources.pathField),
      reader.readOneOf(Resources.transportField, Object.values(RemoteTransport)),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      [Resources.hostField]: this.host,
      [Resources.pathField]: this.path,
      [Resources.transportField]: this.transport
    };
  }
}

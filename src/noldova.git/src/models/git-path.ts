/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TextDecoder } from "node:util";

import { Resources } from "../resources.ts";

export class GitPath {
  private static readonly STRICT: TextDecoder = new TextDecoder(Resources.utf8Label, { fatal: true, ignoreBOM: true });
  private static readonly LENIENT: TextDecoder = new TextDecoder(Resources.utf8Label, { ignoreBOM: true });

  public readonly text: string;
  public readonly bytes: string | undefined;

  public constructor(text: string, bytes: string | undefined) {
    this.text = text;
    this.bytes = bytes;
  }

  public static toBytes(text: string, bytes: string | undefined): Buffer {
    return bytes === undefined ? Buffer.from(text) : Buffer.from(bytes, Resources.base64Encoding);
  }

  public static fromBytes(path: Uint8Array): GitPath {
    try {
      return new GitPath(GitPath.STRICT.decode(path), undefined);
    } catch (error) {
      if (!(error instanceof TypeError))
        throw error;
      return new GitPath(GitPath.LENIENT.decode(path), Buffer.from(path).toString(Resources.base64Encoding));
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Resources } from "../resources.ts";

export class LfsPointer {
  public readonly oid: string;
  public readonly size: number;

  public constructor(oid: string, size: number) {
    this.oid = oid;
    this.size = size;
  }

  public static parse(text: Buffer): LfsPointer | null {
    const lines = text.toString(Resources.utf8Encoding).split(Resources.lineEnd);
    if (!lines.slice(0, 1).some(t => Resources.lfsVersionPattern.test(t)))
      return null;
    const oid = lines.map(t => Resources.lfsOidPattern.exec(t)?.[1]).find(t => t !== undefined);
    const size = lines.map(t => Resources.lfsSizePattern.exec(t)?.[1]).find(t => t !== undefined);
    return oid === undefined || size === undefined ? null : new LfsPointer(oid, Number(size));
  }
}

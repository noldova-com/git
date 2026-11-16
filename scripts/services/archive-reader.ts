/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import zlib from "node:zlib";

import { ArchiveEntryMalformedException } from "../exceptions/archive-entry-malformed.exception.ts";
import { ArchiveUnreadableException } from "../exceptions/archive-unreadable.exception.ts";
import { Resources } from "../resources.ts";

export class ArchiveReader {
  public async readAsync(archive: string): Promise<ReadonlyMap<string, Buffer>> {
    const compressed = await readFile(archive);
    let tar: Buffer;
    try {
      tar = zlib.gunzipSync(compressed);
    }
    catch (error) {
      if (!(error instanceof Error && "code" in error && typeof error.code === "string" && Resources.gzipFailureCodes.includes(error.code)))
        throw error;
      throw new ArchiveUnreadableException(archive, error);
    }

    const files = new Map<string, Buffer>();
    let extendedName: string | null = null;
    for (let offset = 0; offset + Resources.tarBlockBytes <= tar.length && tar[offset] !== 0;) {
      const header = tar.subarray(offset, offset + Resources.tarBlockBytes);
      const size = Number.parseInt(ArchiveReader.readField(header, Resources.tarSizeStart, Resources.tarSizeEnd).trim(), Resources.tarSizeRadix);
      if (!Number.isInteger(size) || offset + Resources.tarBlockBytes + size > tar.length)
        throw new ArchiveEntryMalformedException(archive, offset);
      const content = tar.subarray(offset + Resources.tarBlockBytes, offset + Resources.tarBlockBytes + size);
      const type = header.toString(Resources.tarHeaderEncoding, Resources.tarTypeAt, Resources.tarTypeAt + 1);
      if (type === Resources.tarExtendedType)
        extendedName = Resources.tarPathRecord.exec(content.toString(Resources.encoding))?.[1] ?? null;
      else {
        if (Resources.tarFileTypes.includes(type))
          files.set(extendedName ?? ArchiveReader.readName(header), Buffer.from(content));
        extendedName = null;
      }
      offset += Resources.tarBlockBytes * (1 + Math.ceil(size / Resources.tarBlockBytes));
    }
    return files;
  }

  private static readName(header: Buffer): string {
    const name = ArchiveReader.readField(header, Resources.tarNameStart, Resources.tarNameEnd);
    const prefix = ArchiveReader.readField(header, Resources.tarPrefixStart, Resources.tarPrefixEnd);
    return prefix.length > 0 ? `${prefix}${Resources.pathSeparator}${name}` : name;
  }

  private static readField(header: Buffer, start: number, end: number): string {
    return header.toString(Resources.encoding, start, end).replace(Resources.tarFieldEnd, "");
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class AnswerText {
  public static async readAsync(response: Response, limit: number): Promise<string | null> {
    const body: ReadableStream<Uint8Array> | null = response.body;
    if (Object.isNull(body))
      return "";
    const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader();
    const decoder: TextDecoder = new TextDecoder();
    let length: number = 0;
    let text: string = "";
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      length += read.value.length;
      if (length > limit) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(read.value, { stream: true });
    }
    return text + decoder.decode();
  }
}

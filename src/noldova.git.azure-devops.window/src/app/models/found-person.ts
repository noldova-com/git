/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";

export class FoundPerson {
  private static readonly ANSWER: string = "answer";
  private static readonly DESCRIPTOR: string = "descriptor";
  private static readonly NAME: string = "name";
  private static readonly LOGIN: string = "login";
  private static readonly IS_GROUP: string = "isGroup";

  public readonly descriptor: string;
  public readonly name: string;
  public readonly login: string;
  public readonly isGroup: boolean;

  public constructor(descriptor: string, name: string, login: string, isGroup: boolean) {
    this.descriptor = descriptor;
    this.name = name;
    this.login = login;
    this.isGroup = isGroup;
  }

  public static listOf(answer: unknown): readonly FoundPerson[] {
    return JsonReader.fromValue({ [FoundPerson.ANSWER]: answer }).readObjectArray(FoundPerson.ANSWER).map(t => new FoundPerson(
      t.readNonBlankString(FoundPerson.DESCRIPTOR), t.readNonBlankString(FoundPerson.NAME), t.readNonBlankString(FoundPerson.LOGIN),
      t.readBoolean(FoundPerson.IS_GROUP)));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, FailureCode, type SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
import { Fake, UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { MethodFailureException } from "@noldova/desktop.runtime";
import type { FakeModuleLog, FakeModuleSecrets } from "@noldova/desktop.runtime/testing";

import type { IAzureToken } from "../../src/interfaces/i-azure-token.ts";
import { AzureCredential } from "../../src/models/azure-credential.ts";

export class FakeRequest {
  public readonly url: string;
  public readonly init: RequestInit;

  public constructor(url: string, init: RequestInit) {
    this.url = url;
    this.init = init;
  }

  public get body(): unknown {
    return JSON.parse(String(this.init.body));
  }

  public header(name: string): string | null {
    return new Headers(this.init.headers).get(name);
  }
}

/** A wait until a count is reached. */
interface ICountWaiter {
  readonly count: number;
  readonly resolve: () => void;
}

export class FakeAzure {
  private readonly answers: (() => Promise<Response>)[] = [];
  private readonly waiters: ICountWaiter[] = [];

  public readonly requests: FakeRequest[] = [];
  public readonly fetch = (url: string, init: RequestInit): Promise<Response> => {
    this.requests.push(new FakeRequest(url, init));
    for (const waiter of this.waiters.filter(t => t.count <= this.requests.length)) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
    const answer = this.answers.shift();
    if (answer === undefined)
      return Promise.reject(new UnansweredCallException("fetch"));
    const signal = init.signal;
    return new Promise<Response>((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      answer().then(resolve, reject);
    });
  };

  public static json(body: unknown, status: number = 200, headers: Readonly<Record<string, string>> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers });
  }

  public answer(...responses: Response[]): void {
    this.answers.push(...responses.map(t => () => Promise.resolve(t)));
  }

  public fail(error: Error): void {
    this.answers.push(() => Promise.reject(error));
  }

  public hold(): (response: Response) => void {
    let release: (response: Response) => void = () => undefined;
    const held = new Promise<Response>(resolve => {
      release = resolve;
    });
    this.answers.push(() => held);
    return release;
  }

  public askedAsync(count: number): Promise<void> {
    return this.requests.length >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ count, resolve });
    });
  }

  public urls(): readonly string[] {
    return this.requests.map(t => t.url);
  }
}

export function linesOf(log: FakeModuleLog): readonly string[] {
  return log.callsOf("write").map(([message]) => String(message));
}

export class KeptSecrets {
  private readGate: Promise<void> | null = null;
  private saveGate: Promise<void> | null = null;
  private removeGate: Promise<void> | null = null;
  private readonly saving: (() => void)[] = [];

  public readonly values: Map<string, string> = new Map();
  public readFailure: Error | null = null;
  public saveFailure: Error | null = null;
  public removeFailure: Error | null = null;
  public removeFailureName: string | null = null;

  public constructor(secrets: FakeModuleSecrets) {
    secrets.answer("saveAsync", (name, value) => this.saveAsync(name, value));
    secrets.answer("readAsync", name => this.readAsync(name));
    secrets.answer("removeAsync", name => this.removeAsync(name));
  }

  public static failure(reason: SecretFailureReason): MethodFailureException {
    return new MethodFailureException(new Failure(FailureCode.Unavailable, "The secret call failed.", SecretFailures.detailsOf(reason)));
  }

  public holdRead(): () => void {
    return KeptSecrets.gate(gate => {
      this.readGate = gate;
    });
  }

  public holdSave(): () => void {
    return KeptSecrets.gate(gate => {
      this.saveGate = gate;
    });
  }

  public savedAsync(): Promise<void> {
    return new Promise<void>(resolve => {
      this.saving.push(resolve);
    });
  }

  public holdRemove(): () => void {
    return KeptSecrets.gate(gate => {
      this.removeGate = gate;
    });
  }

  private async saveAsync(name: string, value: string): Promise<void> {
    const gate: Promise<void> | null = this.saveGate;
    this.saveGate = null;
    if (this.saveFailure === null)
      this.values.set(name, value);
    for (const saved of this.saving.splice(0))
      saved();
    await gate;
    if (this.saveFailure !== null)
      throw this.saveFailure;
  }

  private async readAsync(name: string): Promise<string | null> {
    await this.readGate;
    if (this.readFailure !== null)
      throw this.readFailure;
    return this.values.get(name) ?? null;
  }

  private async removeAsync(name: string): Promise<void> {
    await this.removeGate;
    if (this.removeFailure !== null && (this.removeFailureName === null || this.removeFailureName === name))
      throw this.removeFailure;
    this.values.delete(name);
  }

  private static gate(hold: (gate: Promise<void>) => void): () => void {
    let release: () => void = () => undefined;
    hold(new Promise<void>(resolve => {
      release = resolve;
    }));
    return release;
  }
}

export class FakeToken extends Fake<IAzureToken> implements IAzureToken {
  public readonly refusedAsync: IAzureToken["refusedAsync"] = (...args) => this.respondAsync("refusedAsync", args, this.answers.refusedAsync);
  public readonly readyAsync: IAzureToken["readyAsync"] = (...args) => this.respondAsync("readyAsync", args, this.answers.readyAsync);

  private readonly credential: AzureCredential | null;
  private readonly raw: string | null;

  public constructor(token: string | null = "azure-token", organization: string | null = "fabrikam") {
    super();
    this.raw = token;
    this.credential = token === null ? null : AzureCredential.ofToken(token);
    this.answer("token", this.credential);
    this.answer("organization", token === null ? null : organization);
    this.answer("refusedAsync", () => Promise.resolve());
    this.answer("readyAsync", () => Promise.resolve());
  }

  public get token(): AzureCredential | null {
    return this.propertyOf("token", this.answers.token);
  }

  public get organization(): string | null {
    return this.propertyOf("organization", this.answers.organization);
  }

  public get refused(): readonly string[] {
    return this.callsOf("refusedAsync").map(([token]) => token === this.credential ? String(this.raw) : "another token");
  }
}

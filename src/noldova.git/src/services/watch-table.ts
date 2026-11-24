/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { ClientWatch } from "../models/client-watch.ts";
import { PendingWatch } from "../models/pending-watch.ts";

export class WatchTable {
  private readonly repositories: Map<string, Map<string, ClientWatch>> = new Map();
  private readonly pending: Set<PendingWatch> = new Set();

  public begin(connection: number, window: number | null, folder: string): PendingWatch {
    const watch = new PendingWatch(connection, window, folder);
    this.pending.add(watch);
    return watch;
  }

  public complete(watch: PendingWatch, top: string): boolean {
    this.pending.delete(watch);
    if (watch.isCancelled)
      return false;
    const clients = this.repositories.get(top) ?? new Map<string, ClientWatch>();
    const isNew = clients.size === 0;
    this.repositories.set(top, clients);
    const key = WatchTable.keyOf(watch.connection, watch.window, watch.folder);
    const counted = clients.get(key);
    if (counted === undefined)
      clients.set(key, new ClientWatch(watch.connection, watch.window, watch.folder));
    else
      counted.count += 1;
    return isNew;
  }

  /** Forgets every window's watches of the repository, as a failed start leaves nothing watched. */
  public drop(top: string): void {
    this.repositories.delete(top);
  }

  public abandon(watch: PendingWatch): void {
    this.pending.delete(watch);
  }

  public remove(connection: number, window: number | null, folder: string): string | null {
    const key = WatchTable.keyOf(connection, window, folder);
    for (const [top, clients] of this.repositories) {
      const counted = clients.get(key);
      if (counted === undefined)
        continue;
      counted.count -= 1;
      if (counted.count === 0)
        clients.delete(key);
      return this.dropIfUnwatched(top, clients) ? top : null;
    }
    const waiting = [...this.pending].find(t => !t.isCancelled && WatchTable.keyOf(t.connection, t.window, t.folder) === key);
    if (waiting !== undefined)
      waiting.isCancelled = true;
    return null;
  }

  public removeClient(connection: number, window: number | null): string[] {
    for (const watch of this.pending)
      if (WatchTable.isOf(watch, connection, window))
        watch.isCancelled = true;
    const dropped: string[] = [];
    for (const [top, clients] of [...this.repositories]) {
      for (const [key, watch] of [...clients])
        if (WatchTable.isOf(watch, connection, window))
          clients.delete(key);
      if (this.dropIfUnwatched(top, clients))
        dropped.push(top);
    }
    return dropped;
  }

  public watchesOf(top: string): ClientWatch[] {
    return [...(this.repositories.get(top)?.values() ?? [])];
  }

  private dropIfUnwatched(top: string, clients: ReadonlyMap<string, ClientWatch>): boolean {
    if (clients.size > 0)
      return false;
    this.repositories.delete(top);
    return true;
  }

  private static isOf(watch: { readonly connection: number; readonly window: number | null }, connection: number, window: number | null): boolean {
    return watch.connection === connection && (window === null || watch.window === window);
  }

  private static keyOf(connection: number, window: number | null, folder: string): string {
    return JSON.stringify([connection, window, folder]);
  }
}

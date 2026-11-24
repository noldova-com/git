/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UnhandledRejections {
  public static nextAsync(): Promise<unknown> {
    return new Promise(resolve => {
      const caught = (event: PromiseRejectionEvent): void => {
        window.removeEventListener("unhandledrejection", caught);
        event.preventDefault();
        resolve(event.reason);
      };
      window.addEventListener("unhandledrejection", caught);
    });
  }
}

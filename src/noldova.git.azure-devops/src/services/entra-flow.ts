/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomBytes } from "node:crypto";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";

import { EntraGrant } from "../models/entra-grant.ts";
import { Resources } from "../resources.ts";
import type { Fetcher } from "../types/fetcher.ts";
import { AzureApi } from "./azure-api.ts";

export class EntraFlow {
  private readonly fetcher: Fetcher;

  public constructor(fetcher: Fetcher) {
    this.fetcher = fetcher;
  }

  public static createSecret(): string {
    return randomBytes(Resources.secretBytes).toString(Resources.base64UrlEncoding);
  }

  public static formatAuthorizeAddress(redirectUri: string, state: string, verifier: string): string {
    const query = new URLSearchParams({
      [Resources.clientIdParameter]: Resources.entraClientId,
      [Resources.responseTypeParameter]: Resources.codeParameter,
      [Resources.redirectUriParameter]: redirectUri,
      [Resources.scopeParameter]: Resources.entraScopes,
      [Resources.stateParameter]: state,
      [Resources.codeChallengeParameter]: createHash(Resources.sha256).update(verifier).digest(Resources.base64UrlEncoding),
      [Resources.codeChallengeMethodParameter]: Resources.s256Method,
      [Resources.promptParameter]: Resources.selectAccountPrompt
    });
    return `${Resources.entraAuthorizeUrl}?${query.toString()}`;
  }

  public async redeemAsync(code: string, redirectUri: string, verifier: string, signal: AbortSignal): Promise<EntraGrant | null> {
    const answer: EntraGrant | string = await this.requestAsync({
      [Resources.grantTypeParameter]: Resources.authorizationCodeGrant,
      [Resources.codeParameter]: code,
      [Resources.redirectUriParameter]: redirectUri,
      [Resources.codeVerifierParameter]: verifier
    }, Resources.entraScopes, signal);
    return answer instanceof EntraGrant ? answer : null;
  }

  public async refreshAsync(refreshToken: string, signal: AbortSignal): Promise<EntraGrant | null> {
    const refresh: Readonly<Record<string, string>> = { [Resources.grantTypeParameter]: Resources.refreshTokenGrant, [Resources.refreshTokenParameter]: refreshToken };
    const answer: EntraGrant | string = await this.requestAsync(refresh, Resources.entraScopes, signal);
    if (answer !== Resources.consentRequiredError)
      return answer instanceof EntraGrant ? answer : null;
    const earlier: EntraGrant | string = await this.requestAsync(refresh, Resources.entraEarlierScopes, signal);
    return earlier instanceof EntraGrant ? new EntraGrant(earlier.accessToken, earlier.refreshToken, earlier.expiresIn, false) : null;
  }

  private async requestAsync(grant: Readonly<Record<string, string>>, scopes: string, signal: AbortSignal): Promise<EntraGrant | string> {
    const body = new URLSearchParams({ [Resources.clientIdParameter]: Resources.entraClientId, [Resources.scopeParameter]: scopes, ...grant });
    let response: Response;
    let text: string | null;
    try {
      response = await this.fetcher(Resources.entraTokenUrl, {
        method: Resources.postMethod,
        headers: { [Resources.acceptHeader]: Resources.jsonType, [Resources.contentTypeHeader]: Resources.formType },
        body: body.toString(),
        redirect: Resources.manualRedirect,
        signal: AbortSignal.any([signal, AbortSignal.timeout(Resources.requestTimeout)])
      });
      text = await AzureApi.readCappedAsync(response, Resources.maximumTokenAnswerBytes);
    }
    catch (error) {
      signal.throwIfAborted();
      if (error instanceof TypeError || (error instanceof DOMException && error.name === Resources.timeoutErrorName))
        throw AzureApi.failure(FailureCode.Unavailable, Resources.microsoftUnreachableMessage);
      throw error;
    }
    signal.throwIfAborted();
    if (Object.isNull(text))
      throw AzureApi.failure(FailureCode.Unavailable, Resources.tokenAnswerTooLargeMessage);
    if (!response.ok) {
      const refusal: string | null = response.status === Resources.badRequestStatus ? EntraFlow.refusalOf(text) : null;
      if (!Object.isNull(refusal))
        return refusal;
      throw AzureApi.failure(FailureCode.Unavailable, Resources.formatMicrosoftRefused(response.status));
    }
    return AzureApi.read(() => {
      const answer = JsonReader.parse(text);
      return new EntraGrant(answer.readNonBlankString(Resources.accessTokenField), answer.readNonBlankString(Resources.refreshTokenField),
        answer.readInteger(Resources.expiresInField) * Resources.millisecondsPerSecond);
    });
  }

  private static refusalOf(text: string): string | null {
    let answer: JsonReader;
    let error: string;
    try {
      answer = JsonReader.parse(text);
      error = answer.readNonBlankString(Resources.errorParameter);
    }
    catch {
      return null;
    }
    if (!Resources.refusedGrantErrors.includes(error))
      return null;
    return answer.readOptionalString(Resources.suberrorParameter) === Resources.consentRequiredError ? Resources.consentRequiredError : error;
  }
}

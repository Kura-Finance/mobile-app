/**
 * Bridge hosted ToS + KYC browser hand-off.
 *
 * Bridge often returns `kycLink` only after the user accepts ToS. Callers must
 * re-request the link after the ToS browser closes — using the initial
 * createKycLink response for the KYC step leaves users stuck on the start screen.
 */

import * as WebBrowser from 'expo-web-browser';
import { createKycLink, type KycLinkRequest } from './client';

export async function openBridgeHostedKycFlow(req: KycLinkRequest): Promise<void> {
  let res = await createKycLink(req);

  if (res.tosLink && res.tosStatus !== 'approved') {
    await WebBrowser.openBrowserAsync(res.tosLink);
    res = await createKycLink(req);
  }

  if (res.kycLink && res.kycStatus !== 'approved') {
    await WebBrowser.openBrowserAsync(res.kycLink);
  }
}

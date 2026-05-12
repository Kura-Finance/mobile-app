/**
 * Bridge endorsement hosted flow (e.g. pix for BRL, cop for COP deposits).
 *
 *   1. POST /api/bridge/endorsement-link { currency }
 *   2. Open kycLink in the system browser
 *   3. User completes ToS (KYC already approved → usually just this step)
 *   4. Poll GET /api/bridge/customer until endorsements[].status === "approved"
 *   5. Caller retries POST /api/bridge/onramp
 */

import * as WebBrowser from 'expo-web-browser';
import {
  createEndorsementLink,
  getBridgeCustomer,
  isEndorsementApproved,
  resolveEndorsementCurrency,
  type BridgeCustomer,
  type EndorsementRequiredDetail,
} from './client';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 45;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Steps 1–2 only — open the hosted endorsement page. */
export async function openBridgeEndorsementHostedFlow(
  detail: Pick<EndorsementRequiredDetail, 'currency' | 'endorsement'>,
): Promise<void> {
  const currency = resolveEndorsementCurrency(detail);
  const res = await createEndorsementLink(currency);
  const link = res.kycLink;
  if (!link) {
    throw new Error('Bridge did not return a verification link for this endorsement.');
  }
  await WebBrowser.openBrowserAsync(link);
}

async function pollEndorsementApproved(endorsement: string): Promise<BridgeCustomer> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const customer = await getBridgeCustomer();
    if (isEndorsementApproved(customer, endorsement)) {
      if (!customer) {
        throw new Error('Customer record missing after endorsement approval.');
      }
      return customer;
    }
    if (attempt < POLL_MAX_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  throw new Error(
    'Still waiting for endorsement approval. Finish the verification page, then tap Enable again.',
  );
}

/**
 * Steps 1–4: poll briefly (user may have just returned from auto-opened flow),
 * open hosted page if still pending, then poll until approved.
 */
export async function completeBridgeEndorsementFlow(
  detail: Pick<EndorsementRequiredDetail, 'currency' | 'endorsement'>,
): Promise<BridgeCustomer> {
  const endorsement = detail.endorsement;
  for (let i = 0; i < 3; i++) {
    const customer = await getBridgeCustomer();
    if (isEndorsementApproved(customer, endorsement)) {
      return customer!;
    }
    if (i < 2) await sleep(1000);
  }

  await openBridgeEndorsementHostedFlow(detail);
  return pollEndorsementApproved(endorsement);
}

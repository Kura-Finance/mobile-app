import { KuraApiError } from '../errors';

export interface EndorsementRequiredDetail {
  code: 'endorsement_required';
  endorsement: string;
  currency?: string;
  message?: string;
}

function endorsementDetailFromFields(
  endorsement: unknown,
  currency: unknown,
  message?: string,
): EndorsementRequiredDetail | null {
  if (typeof endorsement !== 'string' || !endorsement) return null;
  return {
    code: 'endorsement_required',
    endorsement,
    currency: typeof currency === 'string' ? currency : undefined,
    message,
  };
}

export function parseBridgeErrorCandidates(details: unknown): unknown[] {
  const candidates: unknown[] = [];

  const push = (value: unknown) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      try {
        candidates.push(JSON.parse(value));
      } catch {
        // ignore malformed JSON
      }
      return;
    }
    if (typeof value === 'object') {
      candidates.push(value);
      const bridgeBody = (value as Record<string, unknown>).bridgeBody;
      if (typeof bridgeBody === 'string') {
        try {
          candidates.push(JSON.parse(bridgeBody));
        } catch {
          // ignore malformed bridgeBody
        }
      }
    }
  };

  push(details);
  return candidates;
}

export function bridgeBodyHasUnsupportedCurrency(body: unknown): boolean {
  if (body === null || typeof body !== 'object') return false;
  const source = (body as Record<string, unknown>).source as Record<string, unknown> | undefined;
  const fields = source?.key as Record<string, unknown> | undefined;
  const value = fields?.['source.currency'];
  return typeof value === 'string' && /not supported/i.test(value);
}

export function parseEndorsementError(error: unknown): EndorsementRequiredDetail | null {
  if (!(error instanceof KuraApiError)) return null;
  if (error.status !== 409) return null;

  if (error.code === 'ENDORSEMENT_REQUIRED') {
    const d = error.details;
    if (d !== null && typeof d === 'object') {
      const { endorsement, currency } = d as Record<string, unknown>;
      const detail = endorsementDetailFromFields(endorsement, currency, error.message);
      if (detail) return detail;
    }
  }

  if (error.code !== 'BRIDGE_API_ERROR') return null;

  const candidates = parseBridgeErrorCandidates(error.details);
  const msgMatch = error.message.match(/\{[\s\S]*"endorsement_required"[\s\S]*\}/);
  if (msgMatch) {
    try {
      candidates.push(JSON.parse(msgMatch[0]));
    } catch {
      // ignore
    }
  }

  for (const raw of candidates) {
    if (
      raw !== null &&
      typeof raw === 'object' &&
      (raw as Record<string, unknown>).code === 'endorsement_required' &&
      typeof (raw as Record<string, unknown>).endorsement === 'string'
    ) {
      return raw as EndorsementRequiredDetail;
    }
  }
  return null;
}

export function isUnsupportedCurrencyError(error: unknown): boolean {
  if (!(error instanceof KuraApiError)) return false;
  if (error.code !== 'BRIDGE_API_ERROR') return false;
  if (error.status !== 400) return false;

  return parseBridgeErrorCandidates(error.details).some(bridgeBodyHasUnsupportedCurrency);
}

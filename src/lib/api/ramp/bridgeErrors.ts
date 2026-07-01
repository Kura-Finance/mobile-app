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

export function parseBridgeFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof KuraApiError)) return {};

  const merged: Record<string, string> = {};
  for (const candidate of parseBridgeErrorCandidates(error.details)) {
    if (candidate === null || typeof candidate !== 'object') continue;
    const source = (candidate as Record<string, unknown>).source;
    if (source === null || typeof source !== 'object') continue;
    const key = (source as Record<string, unknown>).key;
    if (key === null || typeof key !== 'object') continue;
    Object.assign(merged, flattenBridgeFieldErrors(key as Record<string, unknown>));
  }
  return merged;
}

function flattenBridgeFieldErrors(
  keyObj: Record<string, unknown>,
  prefix = '',
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(keyObj)) {
    const path = prefix ? `${prefix}.${rawKey}` : rawKey;
    if (typeof value === 'string' && value.trim()) {
      out[path] = value.trim();
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenBridgeFieldErrors(value as Record<string, unknown>, path));
    }
  }
  return out;
}

const BRIDGE_FIELD_LABEL_KEYS: Record<string, string> = {
  'account.routing_number': 'card.routingNumber',
  'account.account_number': 'card.accountNumber',
  'account.sort_code': 'card.sortCode',
  'address.street_line_1': 'card.streetLine1',
  'address.street_line_2': 'card.streetLine2Optional',
  'address.city': 'card.city',
  'address.state': 'card.stateProvince',
  'address.postal_code': 'card.postalCode',
  'address.country': 'card.countryPlaceholder',
  'account.clabe': 'card.clabe',
  'account.iban': 'card.iban',
  'account.pix_key': 'card.pixKey',
  first_name: 'card.firstName',
  last_name: 'card.lastName',
};

function bridgeFieldLabel(field: string, t: TranslateFn): string {
  const key = BRIDGE_FIELD_LABEL_KEYS[field];
  if (key) return t(key);
  return field
    .replace(/^address\./, '')
    .replace(/^account\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isGenericFieldDetail(detail: string): boolean {
  return /^(is invalid|invalid|required)$/i.test(detail.trim());
}

function formatBridgeFieldErrorMessage(
  field: string,
  detail: string,
  t: TranslateFn,
): string {
  if (isGenericFieldDetail(detail)) {
    return t('card.bridgeFieldInvalid', { field: bridgeFieldLabel(field, t) });
  }
  if (/^(must be|too long|too short|should be)/i.test(detail.trim())) {
    return `${bridgeFieldLabel(field, t)} ${detail.trim()}`;
  }
  if (/^[a-z]/i.test(detail) && !detail.includes(field)) {
    return `${bridgeFieldLabel(field, t)}: ${detail}`;
  }
  return detail;
}

function mapKnownBridgeFieldError(
  field: string,
  detail: string,
  t: TranslateFn,
): { message: string; hint?: string } | null {
  if (field === 'account.routing_number') {
    return {
      message: t('card.routingNumberInvalid'),
      hint: t('card.routingNumberInvalidHint'),
    };
  }
  if (field === 'account.account_number') {
    return {
      message: t('card.accountNumberInvalid'),
      hint: t('card.accountNumberInvalidHint'),
    };
  }
  if (field === 'account.sort_code') {
    return {
      message: t('card.sortCodeAccountRequired'),
      hint: t('card.sortCodeInvalidHint'),
    };
  }
  if (field === 'account.clabe' || field === 'clabe') {
    return { message: t('card.clabeRequired'), hint: t('card.clabeInvalidHint') };
  }
  if (field === 'account.iban' || field === 'iban') {
    return { message: t('card.ibanRequired'), hint: t('card.ibanInvalidHint') };
  }
  if (field === 'account.pix_key' || field === 'pix_key') {
    return { message: t('card.pixKeyRequired'), hint: t('card.pixKeyInvalidHint') };
  }
  if (field === 'address.street_line_1' || field === 'street_line_1') {
    if (/too long/i.test(detail)) {
      return {
        message: t('card.streetLine1TooLong'),
        hint: t('card.streetLine1TooLongHint'),
      };
    }
    return {
      message: t('card.streetLine1TooShort'),
      hint: t('card.streetLine1Hint'),
    };
  }
  if (field === 'address.street_line_2' || field === 'street_line_2') {
    if (/too long|invalid/i.test(detail)) {
      return {
        message: t('card.streetLine2TooLong'),
        hint: t('card.streetLine2TooLongHint'),
      };
    }
  }
  if (field === 'address.state' || field === 'state') {
    if (isGenericFieldDetail(detail) || /required/i.test(detail)) {
      return {
        message: t('card.stateRequired'),
        hint: t('card.stateRequiredHint'),
      };
    }
    if (/too long/i.test(detail)) {
      return {
        message: t('card.stateTooLong'),
        hint: t('card.stateTooLongHint'),
      };
    }
  }
  if (field.startsWith('address.')) {
    return {
      message: formatBridgeFieldErrorMessage(field, detail, t),
      hint: t('card.bridgeInvalidParametersHint'),
    };
  }
  return null;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Map Bridge invalid_parameters errors to user-facing copy (+ optional tap hint). */
export function formatBridgeRampError(
  error: unknown,
  t: TranslateFn,
): { message: string; hint?: string } {
  if (!(error instanceof KuraApiError)) {
    return {
      message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
    };
  }

  if (
    error.status === 401 ||
    /authorization token not provided/i.test(error.message)
  ) {
    return { message: t('card.bridgeAuthRequired') };
  }

  const fields = parseBridgeFieldErrors(error);

  for (const [field, detail] of Object.entries(fields)) {
    const mapped = mapKnownBridgeFieldError(field, detail, t);
    if (mapped) return mapped;
  }

  if (Object.keys(fields).length === 0 && /street line 1/i.test(error.message)) {
    if (/too long/i.test(error.message)) {
      return {
        message: t('card.streetLine1TooLong'),
        hint: t('card.streetLine1TooLongHint'),
      };
    }
    return {
      message: t('card.streetLine1TooShort'),
      hint: t('card.streetLine1Hint'),
    };
  }

  if (isUnsupportedCurrencyError(error)) {
    return {
      message: t('card.payoutNoOptions'),
      hint: t('card.unsupportedCurrencyHint'),
    };
  }

  const firstField = Object.entries(fields)[0];
  if (firstField) {
    const [field, detail] = firstField;
    return {
      message: formatBridgeFieldErrorMessage(field, detail, t),
      hint: t('card.bridgeInvalidParametersHint'),
    };
  }

  if (/please resubmit the following parameters/i.test(error.message)) {
    return {
      message: t('card.bridgeInvalidParameters'),
      hint: t('card.bridgeInvalidParametersHint'),
    };
  }

  return { message: error.message || 'Something went wrong. Please try again.' };
}

export function isUnsupportedCurrencyError(error: unknown): boolean {
  if (!(error instanceof KuraApiError)) return false;
  if (error.code !== 'BRIDGE_API_ERROR') return false;
  if (error.status !== 400) return false;

  return parseBridgeErrorCandidates(error.details).some(bridgeBodyHasUnsupportedCurrency);
}

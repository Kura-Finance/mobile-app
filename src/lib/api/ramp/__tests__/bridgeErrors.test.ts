import { describe, expect, test } from 'vitest';
import { KuraApiError } from '../../errors';
import { isUnsupportedCurrencyError, parseEndorsementError } from '../bridgeErrors';

describe('bridgeErrors', () => {
  test('detects unsupported currency from details.bridgeBody', () => {
    const error = new KuraApiError({
      message: 'Please resubmit the following parameters that are either missing or invalid',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: {
        bridgeBody: JSON.stringify({
          code: 'invalid_parameters',
          message: 'Please resubmit the following parameters that are either missing or invalid',
          source: {
            location: 'body',
            key: { 'source.currency': 'Not supported' },
          },
        }),
        bridgePath: '/customers/test/virtual_accounts',
      },
    });

    expect(isUnsupportedCurrencyError(error)).toBe(true);
  });

  test('detects unsupported currency from stringified details', () => {
    const error = new KuraApiError({
      message: 'invalid',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: JSON.stringify({
        source: { key: { 'source.currency': 'Not supported' } },
      }),
    });

    expect(isUnsupportedCurrencyError(error)).toBe(true);
  });

  test('ignores non-400 Bridge errors', () => {
    const error = new KuraApiError({
      message: 'conflict',
      code: 'BRIDGE_API_ERROR',
      status: 409,
      details: {
        bridgeBody: JSON.stringify({
          source: { key: { 'source.currency': 'Not supported' } },
        }),
      },
    });

    expect(isUnsupportedCurrencyError(error)).toBe(false);
  });

  test('parseEndorsementError reads endorsement from bridgeBody', () => {
    const error = new KuraApiError({
      message: 'endorsement required',
      code: 'BRIDGE_API_ERROR',
      status: 409,
      details: {
        bridgeBody: JSON.stringify({
          code: 'endorsement_required',
          endorsement: 'pix',
          currency: 'brl',
        }),
      },
    });

    expect(parseEndorsementError(error)).toEqual({
      code: 'endorsement_required',
      endorsement: 'pix',
      currency: 'brl',
    });
  });
});

import { describe, expect, test } from 'vitest';
import { KuraApiError } from '../../errors';
import { isUnsupportedCurrencyError, formatBridgeRampError, parseBridgeFieldErrors, parseEndorsementError } from '../bridgeErrors';

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

  test('parseBridgeFieldErrors reads routing number validation from bridgeBody', () => {
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
            key: { 'account.routing_number': 'must be 9 digits' },
          },
        }),
        bridgePath: '/customers/test/external_accounts',
      },
    });

    expect(parseBridgeFieldErrors(error)).toEqual({
      'account.routing_number': 'must be 9 digits',
    });
  });

  test('formatBridgeRampError maps street line 1 too long', () => {
    const error = new KuraApiError({
      message: 'street line 1 is too long',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: {
        bridgeBody: JSON.stringify({
          source: {
            key: { 'address.street_line_1': 'street line 1 is too long' },
          },
        }),
      },
    });

    const t = (key: string) => key;
    expect(formatBridgeRampError(error, t)).toEqual({
      message: 'card.streetLine1TooLong',
      hint: 'card.streetLine1TooLongHint',
    });
  });

  test('formatBridgeRampError maps routing number errors to friendly copy', () => {
    const error = new KuraApiError({
      message: 'Please resubmit the following parameters that are either missing or invalid',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: {
        bridgeBody: JSON.stringify({
          source: {
            key: { 'account.routing_number': 'must be 9 digits' },
          },
        }),
      },
    });

    const t = (key: string) => key;
    expect(formatBridgeRampError(error, t)).toEqual({
      message: 'card.routingNumberInvalid',
      hint: 'card.routingNumberInvalidHint',
    });
  });

  test('formatBridgeRampError includes field label for generic "is invalid"', () => {
    const error = new KuraApiError({
      message: 'Please resubmit the following parameters that are either missing or invalid',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: {
        bridgeBody: JSON.stringify({
          source: {
            key: { 'address.city': 'is invalid' },
          },
        }),
      },
    });

    const t = (key: string, opts?: { field?: string }) =>
      key === 'card.city' ? 'City' : key === 'card.bridgeFieldInvalid' ? `${opts?.field} is invalid.` : key;

    expect(formatBridgeRampError(error, t).message).toBe('City is invalid.');
  });

  test('formatBridgeRampError maps missing state to required copy', () => {
    const error = new KuraApiError({
      message: 'Please resubmit the following parameters that are either missing or invalid',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: {
        bridgeBody: JSON.stringify({
          source: {
            key: { 'address.state': 'is invalid' },
          },
        }),
      },
    });

    const t = (key: string) => key;
    expect(formatBridgeRampError(error, t)).toEqual({
      message: 'card.stateRequired',
      hint: 'card.stateRequiredHint',
    });
  });

  test('parseBridgeFieldErrors flattens nested source keys', () => {
    const error = new KuraApiError({
      message: 'invalid',
      code: 'BRIDGE_API_ERROR',
      status: 400,
      details: {
        bridgeBody: JSON.stringify({
          source: {
            key: {
              address: {
                street_line_1: 'is invalid',
              },
            },
          },
        }),
      },
    });

    expect(parseBridgeFieldErrors(error)).toEqual({
      'address.street_line_1': 'is invalid',
    });
  });
});

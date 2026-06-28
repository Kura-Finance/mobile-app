import { KuraApiError } from '../errors';
import { userFacingApiError } from '../userFacingError';

jest.mock('../../../shared/locales/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
}));

describe('userFacingApiError', () => {
  test('maps 429 to trackfi.rateLimitError', () => {
    const err = new KuraApiError({
      code: 'RATE_LIMITED',
      message: 'Too many Request',
      status: 429,
    });
    expect(userFacingApiError(err, 'trackfi.statusCheckFailed')).toBe('trackfi.rateLimitError');
  });

  test('does not expose raw server message for other API errors', () => {
    const err = new KuraApiError({
      code: 'INTERNAL_ERROR',
      message: 'Too many Request',
      status: 400,
    });
    expect(userFacingApiError(err, 'trackfi.statusCheckFailed')).toBe('trackfi.statusCheckFailed');
  });
});

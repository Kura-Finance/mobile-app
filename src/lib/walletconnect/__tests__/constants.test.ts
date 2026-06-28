import { BASE_CAIP2, requiredEip155ChainsSatisfied } from '../constants';

describe('requiredEip155ChainsSatisfied', () => {
  it('allows empty required chains', () => {
    expect(requiredEip155ChainsSatisfied([])).toBe(true);
  });

  it('allows Base-only required chains', () => {
    expect(requiredEip155ChainsSatisfied([BASE_CAIP2])).toBe(true);
  });

  it('rejects Ethereum mainnet required chains', () => {
    expect(requiredEip155ChainsSatisfied(['eip155:1'])).toBe(false);
  });

  it('rejects mixed required chains when any are unsupported', () => {
    expect(requiredEip155ChainsSatisfied(['eip155:1', BASE_CAIP2])).toBe(false);
  });
});

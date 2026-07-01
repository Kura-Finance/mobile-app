/** Strip non-digits from a UK sort code (e.g. "12-34-56" → "123456"). */
export function normalizeSortCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

/** Strip non-digits from a US ABA routing number (must be exactly 9 digits for Bridge). */
export function normalizeRoutingNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 9);
}

/** Bridge ExternalAccountAddress field limits (see Bridge API docs). */
export const BRIDGE_ADDRESS_LIMITS = {
  streetLine1Min: 4,
  streetLine1Max: 35,
  streetLine2Max: 35,
  cityMax: 35,
  stateMax: 3,
  postalCodeMax: 16,
  countryLen: 3,
} as const;

export interface BridgeAddressFields {
  street_line_1: string;
  street_line_2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

export function clampBridgeText(value: string, max: number): string {
  return value.slice(0, max);
}

/** Trim and enforce Bridge address length limits before API submit. */
export function normalizeBridgeAddress(address: BridgeAddressFields): BridgeAddressFields {
  const street2 = address.street_line_2?.trim();
  const state = address.state?.trim();
  return {
    street_line_1: address.street_line_1.trim().slice(0, BRIDGE_ADDRESS_LIMITS.streetLine1Max),
    ...(street2 ? { street_line_2: street2.slice(0, BRIDGE_ADDRESS_LIMITS.streetLine2Max) } : {}),
    city: address.city.trim().slice(0, BRIDGE_ADDRESS_LIMITS.cityMax),
    ...(state ? { state: state.slice(0, BRIDGE_ADDRESS_LIMITS.stateMax).toUpperCase() } : {}),
    postal_code: address.postal_code.trim().slice(0, BRIDGE_ADDRESS_LIMITS.postalCodeMax),
    country: address.country.trim().slice(0, BRIDGE_ADDRESS_LIMITS.countryLen).toUpperCase(),
  };
}

export function isBridgeStreetLine1Valid(value: string): boolean {
  const len = value.trim().length;
  return len >= BRIDGE_ADDRESS_LIMITS.streetLine1Min && len <= BRIDGE_ADDRESS_LIMITS.streetLine1Max;
}

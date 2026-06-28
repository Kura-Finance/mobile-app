/** Waitlist product slugs (lowercase a-z, 0-9, hyphen). */
export const WAITLIST_PRODUCTS = {
  METAL_CARD: 'metal-card',
  VIRTUAL_CARD: 'virtual-card',
  DINARI: 'dinari',
  KURA_APP: 'kura-app',
  DEFAULT: 'default',
} as const;

export type WaitlistProduct =
  (typeof WAITLIST_PRODUCTS)[keyof typeof WAITLIST_PRODUCTS];

const PRODUCT_SLUG_PATTERN = /^[a-z0-9-]+$/;

export function normalizeWaitlistProduct(product: string): string {
  const normalized = product.trim().toLowerCase();
  if (!PRODUCT_SLUG_PATTERN.test(normalized)) {
    throw new Error('product must be a lowercase slug (a-z, 0-9, hyphen)');
  }
  return normalized;
}

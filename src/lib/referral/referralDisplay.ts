import { brand } from '../../config/branding';

const PLACEHOLDER_EMAIL_SUFFIX = `@placeholder.${brand.universalLinkHost}.internal`;

/** Mask placeholder emails from cashback history rows. */
export function formatReferredUserLabel(email: string | null | undefined): string | null {
  if (!email) return null;
  if (email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return null;
  const at = email.indexOf('@');
  if (at <= 1) return email;
  return `${email[0]}***${email.slice(at)}`;
}

export function formatReferralUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCashbackDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

import type { User } from '@privy-io/expo';

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.includes('@') ? email : null;
}

/**
 * Privy requires a dedicated `email` linked account for `useUpdateEmail`.
 * OAuth-only users (Google/Apple) must use `useLinkEmail` first.
 */
export function hasPrivyLinkedEmailAccount(user: User | null | undefined): boolean {
  return user?.linked_accounts?.some((account) => account.type === 'email') ?? false;
}

/**
 * Best-effort email from Privy linked accounts.
 * Used as a login fallback when the identity token is not yet available.
 */
export function extractPrivyUserEmail(user: User | null | undefined): string | null {
  const accounts = user?.linked_accounts;
  if (!accounts?.length) return null;

  for (const account of accounts) {
    if (account.type === 'email') {
      const email = normalizeEmail(account.address);
      if (email) return email;
    }
  }

  for (const account of accounts) {
    if ('email' in account) {
      const email = normalizeEmail(account.email);
      if (email) return email;
    }
  }

  return null;
}

import type { Transaction } from '../../../shared/store/finance/types';

const GENERIC_CATEGORY_VALUES = new Set([
  '',
  'other',
  'others',
  'uncategorized',
  'general',
]);

type CategoryFields = Pick<Transaction, 'category' | 'personalFinanceCategory' | 'merchantCategory'>;

export function isGenericCategoryLabel(label: string | undefined | null): boolean {
  const normalized = (label ?? '').trim().toLowerCase();
  return GENERIC_CATEGORY_VALUES.has(normalized);
}

/** Parse backend PFC string — plain code or JSON `{ primary, detailed }`. */
export function parsePersonalFinanceCategory(
  raw: string | undefined,
): { primary?: string; detailed?: string } {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { primary?: string; detailed?: string };
      return {
        primary: parsed.primary?.trim() || undefined,
        detailed: parsed.detailed?.trim() || undefined,
      };
    } catch {
      // fall through — treat as plain code
    }
  }

  if (trimmed.includes('|')) {
    const [primary, detailed] = trimmed.split('|').map((part) => part.trim());
    return {
      primary: primary || undefined,
      detailed: detailed || undefined,
    };
  }

  return { detailed: trimmed };
}

/** Turn Plaid PFC codes like `INCOME_WAGES` into display labels. */
export function formatPfcCode(code: string): string {
  let label = code.trim();
  if (!label) return '';

  const prefixes = ['INCOME_', 'TRANSFER_IN_', 'TRANSFER_OUT_'];
  for (const prefix of prefixes) {
    if (label.startsWith(prefix)) {
      label = label.slice(prefix.length);
      break;
    }
  }

  return label
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Pick the best human-readable category for budget grouping.
 * Prefers Plaid personal finance categories over legacy `category` ("Others").
 */
export function resolveTransactionCategory(
  tx: CategoryFields,
  uncategorizedLabel: string,
  labelForCode?: (code: string) => string | undefined,
): string {
  const format = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return '';
    return labelForCode?.(trimmed) ?? formatPfcCode(trimmed);
  };

  const pfc = parsePersonalFinanceCategory(tx.personalFinanceCategory);
  if (pfc.detailed) {
    const label = format(pfc.detailed);
    if (label && !isGenericCategoryLabel(label)) return label;
  }
  if (pfc.primary) {
    const label = format(pfc.primary);
    if (label && !isGenericCategoryLabel(label)) return label;
  }

  const merchantCategory = (tx.merchantCategory ?? '').trim();
  if (merchantCategory && !isGenericCategoryLabel(merchantCategory)) {
    return merchantCategory;
  }

  const legacyCategory = (tx.category ?? '').trim();
  if (legacyCategory && !isGenericCategoryLabel(legacyCategory)) {
    return legacyCategory;
  }

  return uncategorizedLabel;
}

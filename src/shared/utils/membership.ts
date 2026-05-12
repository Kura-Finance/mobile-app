export type MembershipTier = 'basic' | 'pro' | 'ultimate' | 'vip';

export const BASIC_ASSET_HISTORY_DAYS = 30;
export const FULL_ASSET_HISTORY_DAYS = 365;

export function parseMembershipTier(label: string): MembershipTier {
  const normalized = (label || 'basic').toLowerCase();
  if (normalized.includes('ultimate')) return 'ultimate';
  if (normalized.includes('vip')) return 'vip';
  if (normalized.includes('pro')) return 'pro';
  return 'basic';
}

export function getAssetHistoryDaysLimit(label: string): number {
  return parseMembershipTier(label) === 'basic'
    ? BASIC_ASSET_HISTORY_DAYS
    : FULL_ASSET_HISTORY_DAYS;
}

export function isAssetHistoryRangeLimited(label: string, days: number): boolean {
  return days > getAssetHistoryDaysLimit(label);
}

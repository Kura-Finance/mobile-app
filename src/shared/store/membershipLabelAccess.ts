/**
 * Read membership tier without importing useAppStore (breaks finance ↔ app store cycle).
 * Bound once when the app store module initializes.
 */

let readMembershipLabel: () => string = () => 'basic';

export function bindMembershipLabelReader(getter: () => string): void {
  readMembershipLabel = getter;
}

export function getMembershipLabelForHistory(): string {
  return readMembershipLabel();
}

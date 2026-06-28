/** Approximate row height for Invest asset list rows (logo + padding). */
export const INVEST_LIST_ROW_HEIGHT = 72;

/** Default visible rows before inner list scrolls. */
export const INVEST_LIST_VISIBLE_ROWS = 5;

export function investListScrollHeight(visibleRows: number): number {
  return visibleRows * INVEST_LIST_ROW_HEIGHT;
}

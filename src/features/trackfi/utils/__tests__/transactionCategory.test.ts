import { describe, expect, it } from 'vitest';
import {
  formatPfcCode,
  isGenericCategoryLabel,
  parsePersonalFinanceCategory,
  resolveTransactionCategory,
} from '../transactionCategory';

describe('transactionCategory', () => {
  describe('isGenericCategoryLabel', () => {
    it('treats Others and empty as generic', () => {
      expect(isGenericCategoryLabel('Others')).toBe(true);
      expect(isGenericCategoryLabel('other')).toBe(true);
      expect(isGenericCategoryLabel('')).toBe(true);
      expect(isGenericCategoryLabel('Groceries')).toBe(false);
    });
  });

  describe('parsePersonalFinanceCategory', () => {
    it('parses plain detailed codes', () => {
      expect(parsePersonalFinanceCategory('INCOME_WAGES')).toEqual({
        detailed: 'INCOME_WAGES',
      });
    });

    it('parses JSON payloads', () => {
      expect(
        parsePersonalFinanceCategory('{"primary":"INCOME","detailed":"INCOME_SALARY"}'),
      ).toEqual({
        primary: 'INCOME',
        detailed: 'INCOME_SALARY',
      });
    });

    it('parses pipe-delimited payloads', () => {
      expect(parsePersonalFinanceCategory('INCOME|INCOME_WAGES')).toEqual({
        primary: 'INCOME',
        detailed: 'INCOME_WAGES',
      });
    });
  });

  describe('formatPfcCode', () => {
    it('formats income codes', () => {
      expect(formatPfcCode('INCOME_WAGES')).toBe('Wages');
      expect(formatPfcCode('INCOME_OTHER_INCOME')).toBe('Other Income');
    });
  });

  describe('resolveTransactionCategory', () => {
    it('prefers PFC over legacy Others', () => {
      expect(
        resolveTransactionCategory(
          {
            category: 'Others',
            personalFinanceCategory: 'INCOME_WAGES',
            merchantCategory: undefined,
          },
          'Uncategorized',
        ),
      ).toBe('Wages');
    });

    it('falls back to merchantCategory when legacy category is generic', () => {
      expect(
        resolveTransactionCategory(
          {
            category: 'Others',
            personalFinanceCategory: undefined,
            merchantCategory: 'Payroll',
          },
          'Uncategorized',
        ),
      ).toBe('Payroll');
    });

    it('returns uncategorized when only generic labels exist', () => {
      expect(
        resolveTransactionCategory(
          {
            category: 'Others',
            personalFinanceCategory: undefined,
            merchantCategory: undefined,
          },
          'Uncategorized',
        ),
      ).toBe('Uncategorized');
    });
  });
});

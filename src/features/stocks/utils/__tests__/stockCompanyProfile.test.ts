import { describe, expect, test } from 'vitest';
import {
  parseChartMeta,
  parseHeadquartersFromExtract,
  parseWikipediaSummary,
} from '../stockCompanyProfile';

describe('parseWikipediaSummary', () => {
  test('reads tagline and extract', () => {
    const parsed = parseWikipediaSummary({
      description: 'American multinational technology company',
      extract: 'Apple Inc. is an American multinational technology company headquartered in Cupertino, California.',
    });
    expect(parsed.tagline).toContain('technology company');
    expect(parsed.extract).toContain('Apple Inc.');
  });
});

describe('parseHeadquartersFromExtract', () => {
  test('extracts city and state', () => {
    expect(parseHeadquartersFromExtract(
      'Apple Inc. is headquartered in Cupertino, California, in Silicon Valley and makes iPhones.',
    )).toBe('Cupertino, California');
  });

  test('shortens verbose neighborhood phrasing to city', () => {
    expect(parseHeadquartersFromExtract(
      'Goldman Sachs is headquartered in the Battery Park City neighborhood of Manhattan in New York City, with regional offices in many countries.',
    )).toBe('New York City');
  });
});

describe('parseChartMeta', () => {
  test('reads exchange and long name', () => {
    const meta = parseChartMeta({
      chart: {
        result: [{
          meta: {
            longName: 'Apple Inc.',
            fullExchangeName: 'NasdaqGS',
          },
        }],
      },
    });
    expect(meta.longName).toBe('Apple Inc.');
    expect(meta.exchange).toBe('NasdaqGS');
  });
});

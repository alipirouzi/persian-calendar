export interface Quote {
  d: number;
  en: string;
  fa: string;
  author_en: string;
  author_fa: string;
  source: string;
}

const TEXT_FIELDS = ['en', 'fa', 'author_en', 'author_fa', 'source'] as const;

function isQuote(value: unknown): value is Quote {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['d'] !== 'number' || !Number.isInteger(candidate['d'])) return false;
  return TEXT_FIELDS.every((field) => {
    const text = candidate[field];
    return typeof text === 'string' && text.length > 0;
  });
}

export function quoteForPersianDay(day: number, quotes: readonly Quote[]): Quote | null {
  if (!Number.isInteger(day) || day < 1 || day > 366) return null;
  return quotes.find((q) => q.d === day) ?? null;
}

export async function loadQuotes(): Promise<readonly Quote[] | null> {
  try {
    const response = await fetch('/quotes.json');
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return null;
    // A single malformed entry means the file is untrustworthy — reject the lot
    // rather than rendering "undefined" text to a visitor.
    if (!data.every(isQuote)) return null;
    return data;
  } catch {
    console.warn('quotes.json unavailable; hiding quote block');
    return null;
  }
}

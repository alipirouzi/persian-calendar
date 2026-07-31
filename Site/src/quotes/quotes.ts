export interface Quote {
  d: number;
  en: string;
  fa: string;
  author_en: string;
  author_fa: string;
  source: string;
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
    return data as Quote[];
  } catch {
    console.warn('quotes.json unavailable; hiding quote block');
    return null;
  }
}

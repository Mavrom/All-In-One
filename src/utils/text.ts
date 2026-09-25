const TURKISH_FOLD: Record<string, string> = {
  ı: 'i',
  İ: 'I',
  ş: 's',
  Ş: 'S',
  ğ: 'g',
  Ğ: 'G',
  ü: 'u',
  Ü: 'U',
  ö: 'o',
  Ö: 'O',
  ç: 'c',
  Ç: 'C',
};

/** Türkçe kurallarıyla küçük harfe çevirir ("I" → "ı", "İ" → "i"). */
export function trLower(text: string): string {
  return text.toLocaleLowerCase('tr-TR');
}

/** Türkçe karakterleri ASCII karşılıklarına çevirir ("uyarı" → "uyari"). */
export function foldTurkish(text: string): string {
  return text.replace(/[ıİşŞğĞüÜöÖçÇ]/g, (ch) => TURKISH_FOLD[ch] ?? ch);
}

/** Metni en fazla `max` karaktere keser, kesildiyse sonuna … ekler. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

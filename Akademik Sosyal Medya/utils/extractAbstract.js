function extractAbstract(text) {
  const lower = text.toLowerCase();
  const start = lower.indexOf('abstract');
  if (start === -1) return '⚠️ Abstract bölümü bulunamadı.';

  const sliced = text.slice(start, start + 2000); // ilk 2000 karakteri al
  const endMatch = sliced.match(/(introduction|1\.|keywords|özet|abstract\s*$)/i);
  return endMatch ? sliced.slice(0, endMatch.index) : sliced;
}

module.exports = { extractAbstract };

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'use', 'when', 'if',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'than', 'as', 'also', 'just', 'any', 'all', 'most', 'other', 'more',
]);

export function deriveKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index); // deduplicate
}

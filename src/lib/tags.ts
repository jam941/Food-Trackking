/**
 * Maps an Open Food Facts categories_tags array to clean, human-readable tag strings.
 *
 * Each raw tag looks like `'en:some-category-name'` or `'fr:produits-laitiers'`.
 * Steps applied per entry:
 *   1. Strip the language prefix (everything up to and including the first `:`).
 *   2. Replace hyphens with spaces.
 *   3. Title-case each word.
 *   4. Drop empty strings.
 * After all entries are processed the list is deduplicated (case-insensitive,
 * first occurrence wins).
 *
 * Returns `[]` when the input is `undefined` or empty.
 *
 * @example
 * mapOFFTags(['en:dairies-and-dairy-substitutes', 'en:breads'])
 * // → ['Dairies And Dairy Substitutes', 'Breads']
 */

/** Title-cases each space-separated word in a string. */
function titleCaseWords(s: string): string {
  return s
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

export function mapOFFTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of tags) {
    // Strip language prefix (up to and including the first ':')
    const withoutPrefix = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw

    // Replace hyphens with spaces, then title-case each word
    const label = titleCaseWords(withoutPrefix.replace(/-/g, ' ')).trim()

    if (label === '') continue

    const key = label.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(label)
    }
  }

  return result
}

/**
 * Normalises a freeform tag string entered by the user:
 *   - Trims leading/trailing whitespace.
 *   - Replaces hyphens with spaces.
 *   - Collapses multiple consecutive internal spaces to a single space.
 *   - Title-cases each word.
 *
 * @example
 * normalizeTag('  whole  grain  ') // → 'Whole Grain'
 * normalizeTag('whole-grain')      // → 'Whole Grain'
 */
export function normalizeTag(tag: string): string {
  return titleCaseWords(
    tag
      .trim()
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' '),
  )
}

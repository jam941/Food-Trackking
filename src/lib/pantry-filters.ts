import type { PantryItemWithFood } from '#/server/functions/pantry'

export type LocationKey = 'pantry' | 'fridge' | 'freezer' | 'other'

export type StatusFlag = 'has-exp' | 'expiring-soon' | 'expired' | 'opened'

export type FilterState = {
  query: string
  locations: Set<LocationKey> // empty = show all locations
  statusFlags: Set<StatusFlag> // empty = show all statuses
  tags: Set<string> // empty = show all tags
}

export function emptyFilters(): FilterState {
  return {
    query: '',
    locations: new Set(),
    statusFlags: new Set(),
    tags: new Set(),
  }
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Filters a list of pantry items according to the provided `FilterState`.
 *
 * All filter groups are combined with AND (every non-empty group must pass).
 * Within the `statusFlags` and `tags` groups the condition is OR (any match
 * satisfies the group).
 *
 * @param items - Full list of pantry items to filter.
 * @param f     - Current filter state; empty sets mean "show all" for that group.
 * @param now   - Current timestamp in ms (defaults to `Date.now()`), exposed for
 *                deterministic testing once a test framework is added.
 */
export function applyFilters(
  items: PantryItemWithFood[],
  f: FilterState,
  now = Date.now(),
): PantryItemWithFood[] {
  return items.filter((item) => {
    // --- query filter ---
    if (f.query !== '') {
      const q = f.query.toLowerCase()
      const foodTags: string[] = item.foodTags ?? []
      const matchesQuery =
        item.foodName.toLowerCase().includes(q) ||
        (item.foodBrand?.toLowerCase().includes(q) ?? false) ||
        foodTags.some((t) => t.toLowerCase().includes(q))
      if (!matchesQuery) return false
    }

    // --- location filter ---
    if (f.locations.size > 0) {
      const loc = (item.location ?? 'pantry') as LocationKey
      if (!f.locations.has(loc)) return false
    }

    // --- status flags filter (OR within group) ---
    if (f.statusFlags.size > 0) {
      const expiresAtMs = item.expiresAt ? item.expiresAt.getTime() : null
      const msUntilExpiry = expiresAtMs !== null ? expiresAtMs - now : null

      const matchesAnyFlag = [...f.statusFlags].some((flag) => {
        switch (flag) {
          case 'has-exp':
            return item.expiresAt != null

          case 'expiring-soon':
            return (
              msUntilExpiry !== null &&
              msUntilExpiry >= 0 &&
              msUntilExpiry <= THREE_DAYS_MS
            )

          case 'expired':
            return expiresAtMs !== null && expiresAtMs < now

          case 'opened':
            return item.openedAt != null

          default:
            return false
        }
      })
      if (!matchesAnyFlag) return false
    }

    // --- tags filter (OR within group) ---
    if (f.tags.size > 0) {
      const foodTags: string[] = item.foodTags ?? []
      // Both foodTags and f.tags must contain title-cased strings produced by
      // mapOFFTags / normalizeTag (see src/lib/tags.ts).
      const matchesAnyTag = foodTags.some((t) => f.tags.has(t))
      if (!matchesAnyTag) return false
    }

    return true
  })
}

export const userSearchMinTokenLength = 2
export const userSearchMaxQueryLength = 64
export const defaultUserSearchResultLimit = 12

export type UserSearchRouteQuery =
  | {
      readonly kind: 'idle'
      readonly inputValue: string
      readonly reason: 'empty' | 'too-short'
    }
  | {
      readonly kind: 'searchable'
      readonly inputValue: string
      readonly searchText: string
    }

export function resolveUserSearchRouteQuery(
  input: Record<string, string | readonly string[] | undefined>,
): UserSearchRouteQuery {
  const inputValue = normalizeUserSearchInput(getFirstQueryValue(input.q))

  if (inputValue.length === 0) {
    return {
      kind: 'idle',
      inputValue: '',
      reason: 'empty',
    }
  }

  const searchableTokens = inputValue
    .split(' ')
    .filter((token) => token.length >= userSearchMinTokenLength)

  if (searchableTokens.length === 0) {
    return {
      kind: 'idle',
      inputValue,
      reason: 'too-short',
    }
  }

  return {
    kind: 'searchable',
    inputValue,
    searchText: searchableTokens.join(' '),
  }
}

function getFirstQueryValue(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined
  }

  return typeof value === 'string' ? value : undefined
}

function normalizeUserSearchInput(value: string | undefined): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, userSearchMaxQueryLength)
    .trim()
}

import type { WorkFlag } from '../types'

export type Prefill = {
  name?: string
  area?: string
  address?: string
  tags: string[]
  work: WorkFlag[]
  petFriendly: boolean
  /** @handles other than the poster, shown as hints. */
  mentions: string[]
}

// Keywords that point at one of the built-in tags. Matched as whole words, case-insensitive.
const TAG_WORDS: Record<string, string[]> = {
  matcha: ['matcha', 'hojicha', 'usucha', 'koicha', 'uji'],
  coffee: ['coffee', 'kape', 'latte', 'espresso', 'cortado', 'flat white', 'americano', 'cold brew', 'pour over', 'coffeeshop'],
  pastries: ['pastry', 'pastries', 'croissant', 'croissants', 'bakery', 'bakeshop', 'cake', 'cakes', 'bread', 'donut', 'donuts', 'doughnut', 'cookie', 'cookies', 'ensaymada', 'tart', 'tarts', 'sourdough', 'cinnamon roll', 'danish', 'pandesal'],
  restaurant: ['restaurant', 'resto', 'brunch', 'lunch', 'dinner', 'ramen', 'sushi', 'pasta', 'steak', 'izakaya', 'omakase'],
}

const WORK_WORDS: Record<WorkFlag, string[]> = {
  wifi: ['wifi', 'wi-fi'],
  outlets: ['outlet', 'outlets', 'sockets'],
  laptop: [
    'laptop friendly', 'laptop-friendly', 'work friendly', 'work-friendly', 'study spot', 'workspace', 'wfh', 'wfc',
    'productive', 'study', 'studying', 'stay long', 'stay for a long time', 'staying for a long time', 'work from',
    'working from', 'remote work',
  ],
}

const PET_WORDS = ['pet friendly', 'pet-friendly', 'petfriendly', 'dog friendly', 'dog-friendly', 'dogfriendly', 'pets allowed', 'fur babies', 'furbabies']

// Makati areas with the ways captions tend to spell them.
const MAKATI_AREAS: [string, string[]][] = [
  ['Legazpi Village', ['legazpi village', 'legaspi village', 'legazpi', 'legaspi']],
  ['Salcedo Village', ['salcedo village', 'salcedo']],
  ['Poblacion', ['poblacion', 'pobla']],
  ['Rockwell', ['rockwell', 'power plant mall', 'power plant']],
  ['Greenbelt', ['greenbelt']],
  ['Glorietta', ['glorietta']],
  ['Ayala Triangle', ['ayala triangle']],
  ['Circuit Makati', ['circuit makati', 'circuit']],
  ['Century City', ['century city', 'century city mall']],
  ['San Antonio Village', ['san antonio village', 'san antonio']],
  ['Bel-Air', ['bel-air', 'bel air', 'belair']],
  ['Urdaneta Village', ['urdaneta village', 'urdaneta']],
  ['Magallanes', ['magallanes']],
  ['Dasmariñas Village', ['dasmariñas village', 'dasmarinas village', 'dasmariñas', 'dasmarinas', 'dasma']],
  ['San Lorenzo Village', ['san lorenzo village', 'san lorenzo']],
  ['Guadalupe', ['guadalupe']],
  // Pio del Pilar is the barangay along the Chino Roces (Pasong Tamo) strip; people call it by the road.
  ['Chino Roces', ['chino roces', 'pasong tamo', 'pio del pilar']],
]

// Areas named after a road. A village in the same text wins: "2129 Chino Roces Ave, Legaspi Village" is Legazpi Village.
const CORRIDORS = new Set(['chino roces', 'pasong tamo'])

const PIN = /(?:📍|📌|🏠|\b(?:location|where|place|address)\s*[:：])\s*([^\n#|📍📌]+)/iu
// The pin line ends at a double space or the end of a sentence, so the caption's next sentence isn't read as the name.
// Abbreviations like "St." and "Bldg." don't end it.
const PIN_END = /\s{2,}|[!?](?:\s|$)|(?<!\b(?:st|ave|rd|bldg|blvd|cor|no|brgy|flr|ft|mt|sta|sen|gen|pres|dr|jr|sr|blk|sto))\.(?:\s|$)/i
const PIN_HANDLE = /^@([a-z0-9._]{2,30})/i
// Handles that read like a business rather than a friend.
const SHOP_WORDS = /cafe|coffee|kape|matcha|tea|bakery|bakeshop|bake|pastry|patisserie|kitchen|bar|bistro|brew|roast|eatery|resto|\.co\b|_co\b/i
const STREET = /\d|\b(st|st\.|street|ave|ave\.|avenue|road|rd|blvd|bldg|building|tower|center|centre|ground floor|g\/f|floor|corner|cor\.)\b/i
const MENTION = /(^|[^\w.])@([a-z0-9._]{2,30})/gi

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word (or whole-phrase) match, also matching the hashtag form without spaces. */
function has(text: string, phrase: string): boolean {
  const words = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(phrase)}($|[^\\p{L}\\p{N}])`, 'iu')
  if (words.test(text)) return true
  const tag = phrase.replace(/[\s-]/g, '')
  return tag !== phrase && new RegExp(`#${escape(tag)}($|[^\\p{L}\\p{N}])`, 'iu').test(text)
}

/** Hashtags like #icedmatcha or #croissantlover: the keyword anywhere inside one. */
function inHashtag(text: string, word: string): boolean {
  if (word.length < 4 || /\s/.test(word)) return false
  const needle = word.toLowerCase()
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).some((h) => h.toLowerCase().includes(needle))
}

/** The Makati area a piece of text mentions, spelled the way the list already spells it. */
export function findArea(text: string, known: string[]): string | undefined {
  for (const corridor of [false, true]) {
    const fits = (area: string) => CORRIDORS.has(area.toLowerCase()) === corridor
    // Areas already on file win, so the caption maps onto the spelling the list uses.
    for (const a of known) if (fits(a) && has(text, a)) return a
    for (const [canonical, aliases] of MAKATI_AREAS) {
      if (fits(canonical) && aliases.some((alias) => has(text, alias))) {
        return known.find((k) => k.toLowerCase() === canonical.toLowerCase()) ?? canonical
      }
    }
  }
  return undefined
}

function tidy(s: string): string {
  return s
    .replace(/\p{Extended_Pictographic}|️/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,–—:-]+|[\s,–—:.-]+$/g, '')
    .trim()
}

/** A profile's display name as a cafe name: "Kumo Coffee PH ☕️ | Makati" becomes "Kumo Coffee". */
export function profileName(raw: string): string | undefined {
  const name = tidy(raw.split(/\s+[|•·]\s+|\s+[-–—]\s+/)[0] ?? '')
    .replace(/\s*\((?:official|ph|mnl|makati)\)$/i, '')
    .replace(/\s+(?:official|ph|philippines|mnl|manila|makati( city)?)$/i, '')
    .trim()
  return name || undefined
}

/** A best guess from a handle when the profile itself can't be read: kumo.coffee becomes "Kumo Coffee". */
export function nameFromHandle(handle: string): string | undefined {
  const words = handle.replace(/[._-]+/g, ' ').trim()
  return profileName(words.replace(/\b\p{L}/gu, (c) => c.toUpperCase()))
}

/** Reads a TikTok/IG/FB caption and guesses what it can about the cafe. */
export function parseCaption(text: string, opts: { tags: string[]; areas: string[]; author?: string }): Prefill {
  const caption = text.normalize('NFC')
  const result: Prefill = { tags: [], work: [], petFriendly: false, mentions: [] }

  const tags = new Set<string>()
  // A matcha or ube latte isn't coffee.
  const forTags = caption.replace(/(matcha|hojicha|ube|chai|strawberry|taro)(\s*)latte/gi, '$1')
  for (const [tag, words] of Object.entries(TAG_WORDS)) {
    if (opts.tags.includes(tag) && words.some((w) => has(forTags, w) || inHashtag(forTags, w))) tags.add(tag)
  }
  for (const tag of opts.tags) if (has(caption, tag)) tags.add(tag)
  result.tags = [...tags]

  result.work = (Object.keys(WORK_WORDS) as WorkFlag[]).filter((w) => WORK_WORDS[w].some((p) => has(caption, p)))
  result.petFriendly = PET_WORDS.some((p) => has(caption, p))
  result.area = findArea(caption, opts.areas)

  const author = opts.author?.replace(/^@/, '').toLowerCase()
  let pinned: string | undefined
  const pin = PIN.exec(caption)?.[1]?.split(PIN_END)[0]
  if (pin) {
    // "📍@ujisan.matcha" names the place by its account.
    const handle = PIN_HANDLE.exec(pin.trim())?.[1]?.replace(/\.$/, '')
    if (handle) {
      pinned = handle.toLowerCase()
      result.name = nameFromHandle(handle)
    }
    const rest = handle ? pin.trim().slice(handle.length + 1) : pin
    const parts = rest.split(/,|\s[-–—]\s|\s\|\s/).map(tidy).filter(Boolean)
    const isPlace = (p: string) => /^makati( city)?$/i.test(p) || findArea(p, opts.areas)?.toLowerCase() === p.toLowerCase()
    // A long run of words with no comma is a sentence, not a name.
    const first = !handle && parts[0] && parts[0].length <= 60 && !isPlace(parts[0]) ? parts[0] : undefined
    if (first) result.name = first
    const address = parts.slice(first ? 1 : 0).filter((p) => STREET.test(p) && p.length <= 80)
    if (address.length) result.address = address.join(', ')
  }

  const mentions = new Set<string>()
  for (const m of caption.matchAll(MENTION)) {
    const handle = m[2].replace(/\.$/, '')
    const lower = handle.toLowerCase()
    if (lower !== author && lower !== pinned) mentions.add(handle)
  }
  result.mentions = [...mentions].slice(0, 5)

  // With no pin, a single shop-like account tagged in the caption is most likely the place.
  if (!result.name && result.mentions.length === 1 && SHOP_WORDS.test(result.mentions[0])) {
    result.name = nameFromHandle(result.mentions[0])
    result.mentions = []
  }

  return result
}

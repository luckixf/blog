import { type CollectionEntry, getCollection, render } from 'astro:content'
import { formatMD, formatThoughtDate, formatYMD, getWeekday, timeAgo, wordCount } from '@lib/utils'

export const THOUGHTS_PAGE_SIZE = 6

export const thoughtColors = [
  {
    bg: 'bg-rose-300',
    light: 'border-rose-300',
    dark: 'dark:border-rose-500/40',
    text: 'text-rose-500',
  },
  {
    bg: 'bg-orange-300',
    light: 'border-orange-300',
    dark: 'dark:border-orange-500/40',
    text: 'text-orange-500',
  },
  {
    bg: 'bg-amber-300',
    light: 'border-amber-300',
    dark: 'dark:border-amber-500/40',
    text: 'text-amber-500',
  },
  {
    bg: 'bg-sky-300',
    light: 'border-sky-300',
    dark: 'dark:border-sky-500/40',
    text: 'text-sky-500',
  },
  {
    bg: 'bg-indigo-300',
    light: 'border-indigo-300',
    dark: 'dark:border-indigo-500/40',
    text: 'text-indigo-500',
  },
  {
    bg: 'bg-purple-300',
    light: 'border-purple-300',
    dark: 'dark:border-purple-500/40',
    text: 'text-purple-500',
  },
  {
    bg: 'bg-fuchsia-300',
    light: 'border-fuchsia-300',
    dark: 'dark:border-fuchsia-500/40',
    text: 'text-fuchsia-500',
  },
  {
    bg: 'bg-pink-300',
    light: 'border-pink-300',
    dark: 'dark:border-pink-500/40',
    text: 'text-pink-500',
  },
]

export type ThoughtColor = (typeof thoughtColors)[number]
export type ThoughtCollectionEntry = CollectionEntry<'thoughts'>

export type ThoughtCatalogItem = {
  id: number
  chunk: number
  date: Date
  timestamp: number
  dateStr: string
  shortDate: string
  displayDate: string
  weekday: string
  tags: string[]
  label: string
  color: ThoughtColor
}

export type RenderedThought = ThoughtCollectionEntry & {
  Content: Awaited<ReturnType<typeof render>>['Content']
  thoughtId: number
  dateStr: string
  color: ThoughtColor
}

export async function getSortedThoughts() {
  return (await getCollection('thoughts'))
    .filter((thought: ThoughtCollectionEntry) => !thought.data.draft)
    .sort(
      (a: ThoughtCollectionEntry, b: ThoughtCollectionEntry) =>
        new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf(),
    )
}

export function getThoughtColorMap(collection: ThoughtCollectionEntry[]) {
  const dateColorMap = new Map<string, number>()
  let colorIndex = 0

  collection.forEach((thought) => {
    const dateStr = formatYMD(thought.data.date)

    if (!dateColorMap.has(dateStr)) {
      dateColorMap.set(dateStr, colorIndex % thoughtColors.length)
      colorIndex++
    }
  })

  return dateColorMap
}

export function getThoughtColor(
  entry: ThoughtCollectionEntry,
  dateColorMap: Map<string, number>,
) {
  const dateStr = formatYMD(entry.data.date)
  const colorIdx = dateColorMap.get(dateStr) || 0
  return thoughtColors[colorIdx]
}

export function getThoughtCatalog(collection: ThoughtCollectionEntry[]) {
  const dateColorMap = getThoughtColorMap(collection)

  return collection.map((item, index) => {
    const thoughtId = collection.length - index
    const rawContent = item.body ?? ''
    const firstText = rawContent
      .replace(/^---[\s\S]*?---/, '')
      .replace(/<[^>]*>/g, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[[^\]]+\]\([^)]+\)/g, '')
      .replace(/[#>*_`~-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const label = firstText.length > 28 ? `${firstText.slice(0, 28)}...` : firstText

    return {
      id: thoughtId,
      chunk: Math.floor(index / THOUGHTS_PAGE_SIZE) + 1,
      date: item.data.date,
      timestamp: item.data.date.getTime(),
      dateStr: formatYMD(item.data.date),
      shortDate: formatMD(item.data.date),
      displayDate: formatThoughtDate(item.data.date),
      weekday: getWeekday(item.data.date),
      tags: item.data.tags ?? [],
      label: label || '一条新的碎碎念',
      color: getThoughtColor(item, dateColorMap),
    } satisfies ThoughtCatalogItem
  })
}

export async function renderThoughtEntries(
  entries: ThoughtCollectionEntry[],
  allEntries: ThoughtCollectionEntry[],
) {
  const dateColorMap = getThoughtColorMap(allEntries)

  return Promise.all(
    entries.map(async (item) => {
      const { Content } = await render(item)
      const index = allEntries.findIndex((entry) => entry.id === item.id)
      const thoughtId = allEntries.length - index
      const dateStr = formatYMD(item.data.date)

      return {
        ...item,
        Content,
        thoughtId,
        dateStr,
        color: getThoughtColor(item, dateColorMap),
      } satisfies RenderedThought
    }),
  )
}

export function getThoughtStats(collection: ThoughtCollectionEntry[]) {
  const totalWords = collection.reduce((sum, item) => sum + wordCount(item.body ?? ''), 0)

  if (collection.length === 0) {
    return {
      total: 0,
      monthlyAverage: 0,
      totalWords,
    }
  }

  const dates = collection.map((item) => item.data.date.getTime())
  const newest = Math.max(...dates)
  const oldest = Math.min(...dates)
  const monthSpan = Math.max(
    1,
    (new Date(newest).getFullYear() - new Date(oldest).getFullYear()) * 12 +
      new Date(newest).getMonth() -
      new Date(oldest).getMonth() +
      1,
  )

  return {
    total: collection.length,
    monthlyAverage: Math.round(collection.length / monthSpan),
    totalWords,
  }
}

export function getThoughtChunks(collection: ThoughtCollectionEntry[]) {
  const chunks: ThoughtCollectionEntry[][] = []

  for (let index = 0; index < collection.length; index += THOUGHTS_PAGE_SIZE) {
    chunks.push(collection.slice(index, index + THOUGHTS_PAGE_SIZE))
  }

  return chunks
}

export { formatThoughtDate, getWeekday, timeAgo }

// The working calendar: weekends and US federal holidays are not working days. Dates are calendar days (YYYY-MM-DD) counted
// as UTC day numbers, so a daylight-saving change never moves one; a timed value keeps its local wall time in the zone.
export const workspaceZone = 'America/New_York'
const DAY = 86400000
export const dayNumber = (date: string) => Math.floor(Date.parse(date.slice(0, 10) + 'T00:00:00Z') / DAY)
export const dayString = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
const weekday = (n: number) => new Date(n * DAY).getUTCDay()

const nthWeekday = (year: number, month: number, day: number, nth: number) => {
  const first = dayNumber(`${year}-${String(month).padStart(2, '0')}-01`)
  return first + ((day - weekday(first) + 7) % 7) + (nth - 1) * 7
}
const lastWeekday = (year: number, month: number, day: number) => {
  const n = dayNumber(month === 12 ? `${year}-12-31` : `${year}-${String(month + 1).padStart(2, '0')}-01`) - (month === 12 ? 0 : 1)
  return n - ((weekday(n) - day + 7) % 7)
}
const fixed = (year: number, month: number, date: number) => {
  const n = dayNumber(`${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`)
  // A holiday on Saturday is observed the Friday before and one on Sunday the Monday after.
  return weekday(n) === 6 ? n - 1 : weekday(n) === 0 ? n + 1 : n
}
const cache = new Map<number, Set<number>>()
/** The observed US federal holidays that fall in a year (day numbers), including a neighbouring year's observed day. */
export function federalHolidays(year: number): Set<number> {
  const known = cache.get(year)
  if (known) return known
  const days = new Set<number>()
  for (const y of [year - 1, year, year + 1]) {
    for (const n of [fixed(y, 1, 1), nthWeekday(y, 1, 1, 3), nthWeekday(y, 2, 1, 3), lastWeekday(y, 5, 1), fixed(y, 6, 19), fixed(y, 7, 4), nthWeekday(y, 9, 1, 1), nthWeekday(y, 10, 1, 2), fixed(y, 11, 11), nthWeekday(y, 11, 4, 4), fixed(y, 12, 25)])
      if (new Date(n * DAY).getUTCFullYear() === year) days.add(n)
  }
  cache.set(year, days)
  return days
}
export const holidayName = (date: string): string | null => {
  const n = dayNumber(date), year = new Date(n * DAY).getUTCFullYear()
  if (!federalHolidays(year).has(n)) return null
  const names: [number, string][] = [[fixed(year, 1, 1), 'New Year’s Day'], [nthWeekday(year, 1, 1, 3), 'Martin Luther King Jr. Day'], [nthWeekday(year, 2, 1, 3), 'Washington’s Birthday'], [lastWeekday(year, 5, 1), 'Memorial Day'], [fixed(year, 6, 19), 'Juneteenth'], [fixed(year, 7, 4), 'Independence Day'], [nthWeekday(year, 9, 1, 1), 'Labor Day'], [nthWeekday(year, 10, 1, 2), 'Columbus Day'], [fixed(year, 11, 11), 'Veterans Day'], [nthWeekday(year, 11, 4, 4), 'Thanksgiving Day'], [fixed(year, 12, 25), 'Christmas Day']]
  return names.find(([day]) => day === n)?.[1] ?? 'Federal holiday (observed)'
}
export const isWorkingDay = (n: number) => { const w = weekday(n); return w !== 0 && w !== 6 && !federalHolidays(new Date(n * DAY).getUTCFullYear()).has(n) }
/** The first working day on or after a day. */
export const onOrAfter = (n: number) => { while (!isWorkingDay(n)) n++; return n }
/** The first working day on or before a day. */
export const onOrBefore = (n: number) => { while (!isWorkingDay(n)) n--; return n }
/** A working day moved by whole working days (negative moves earlier); a non-working start counts from the next working day. */
export function addWorking(n: number, count: number): number {
  let day = count >= 0 ? onOrAfter(n) : onOrBefore(n), left = Math.abs(count)
  const step = count >= 0 ? 1 : -1
  while (left > 0) { day += step; if (isWorkingDay(day)) left-- }
  return day
}
/** Signed working days from one day to another: how many working days after `from` is `to`. */
export function workingBetween(from: number, to: number): number {
  if (from === to) return 0
  const sign = to > from ? 1 : -1
  let count = 0
  for (let day = from; day !== to;) { day += sign; if (isWorkingDay(day)) count += sign }
  return count
}

const parts = (at: number, zone: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at)).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, ms: ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 }
}
/** The instant at which a local day and wall-clock offset occur in a zone (a skipped hour moves to the next valid time). */
export function instantOf(date: string, wallMs: number, zone: string): number {
  const guess = dayNumber(date) * DAY + wallMs
  let at = guess - parts(guess, zone).ms + wallMs - ((dayNumber(parts(guess, zone).date) - dayNumber(date)) * DAY)
  for (let i = 0; i < 3; i++) {
    const seen = parts(at, zone), drift = (dayNumber(seen.date) - dayNumber(date)) * DAY + seen.ms - wallMs
    if (drift === 0) break
    at -= drift
  }
  return at
}
/** A task date: a bare day, or an instant with its local day and wall time in the workspace zone. */
export interface Stamp { day: number; wallMs: number | null }
export function readStamp(value: string, zone = workspaceZone): Stamp {
  if (value.length === 10) return { day: dayNumber(value), wallMs: null }
  const seen = parts(Date.parse(value), zone)
  return { day: dayNumber(seen.date), wallMs: seen.ms }
}
export function writeStamp(stamp: Stamp, zone = workspaceZone): string {
  if (stamp.wallMs === null) return dayString(stamp.day)
  return new Date(instantOf(dayString(stamp.day), stamp.wallMs, zone)).toISOString().replace('.000Z', 'Z')
}
/** The federal holidays that fall on days a shift crossed, between two day numbers (exclusive of the start). */
export function holidaysBetween(from: number, to: number): { date: string; name: string }[] {
  const out: { date: string; name: string }[] = []
  for (let day = Math.min(from, to) + 1; day <= Math.max(from, to); day++) { const name = holidayName(dayString(day)); if (name) out.push({ date: dayString(day), name }) }
  return out
}
/** Whether the zone's UTC offset differs between two timed stamps: the shift crossed a daylight-saving change. */
export function dstChange(a: Stamp, b: Stamp, zone = workspaceZone): boolean {
  if (a.wallMs === null || b.wallMs === null) return false
  const offset = (s: Stamp) => instantOf(dayString(s.day), s.wallMs!, zone) - (s.day * DAY + s.wallMs!)
  return offset(a) !== offset(b)
}

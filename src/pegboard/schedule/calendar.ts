// The working calendar: weekends and US federal holidays are not working days. Dates are calendar days (YYYY-MM-DD) counted
// as UTC day numbers, so a daylight-saving change never moves one; a timed value keeps its local wall time in the zone.
export const workspaceZone = 'America/New_York'
const DAY = 86400000
export const dayNumber = (date: string) => Math.floor(Date.parse(date.slice(0, 10) + 'T00:00:00Z') / DAY)
export const dayString = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
export const weekday = (n: number) => new Date(n * DAY).getUTCDay()

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
export const isWorkingDay = (n: number, calendar?: WorkingCalendar) => calendar ? availableIntervals(n, calendar).length > 0 : weekday(n) !== 0 && weekday(n) !== 6 && !federalHolidays(new Date(n * DAY).getUTCFullYear()).has(n)
/** The first working day on or after a day. */
export const onOrAfter = (n: number, calendar?: WorkingCalendar) => { while (!isWorkingDay(n, calendar)) n++; return n }
/** The first working day on or before a day. */
export const onOrBefore = (n: number, calendar?: WorkingCalendar) => { while (!isWorkingDay(n, calendar)) n--; return n }
/** A working day moved by whole working days (negative moves earlier); a non-working start counts from the next working day. */
export function addWorking(n: number, count: number, calendar?: WorkingCalendar): number {
  let day = count >= 0 ? onOrAfter(n, calendar) : onOrBefore(n, calendar), left = Math.abs(count)
  const step = count >= 0 ? 1 : -1
  while (left > 0) { day += step; if (isWorkingDay(day, calendar)) left-- }
  return day
}
/** Signed working days from one day to another: how many working days after `from` is `to`. */
export function workingBetween(from: number, to: number, calendar?: WorkingCalendar): number {
  if (from === to) return 0
  const sign = to > from ? 1 : -1
  let count = 0
  for (let day = from; day !== to;) { day += sign; if (isWorkingDay(day, calendar)) count += sign }
  return count
}

const parts = (at: number, zone: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at)).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, ms: ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 }
}
/** The instant at which a local day and wall-clock offset occur in a zone (a skipped hour moves to the next valid time). */
export function instantOf(date: string, wallMs: number, zone: string): number {
  const target = dayNumber(date) * DAY + wallMs
  // Both offsets around a transition are candidates. A repeated hour chooses its first occurrence;
  // a skipped hour advances by the gap rather than oscillating back into the preceding hour.
  const candidates = [...new Set([-DAY, 0, DAY].map(delta => {
    const at = target + delta, seen = parts(at, zone)
    return target - (dayNumber(seen.date) * DAY + seen.ms - at)
  }))].map(at => { const seen = parts(at, zone); return { at, local: dayNumber(seen.date) * DAY + seen.ms } })
  const exact = candidates.filter(candidate => candidate.local === target)
  if (exact.length) return Math.min(...exact.map(candidate => candidate.at))
  return candidates.filter(candidate => candidate.local > target).sort((a, b) => a.local - b.local || a.at - b.at)[0].at
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


/** Each weekday has one local interval in minutes, or is closed. Time off has no private reason. */
export interface WorkingHours { start: number; end: number }
export interface TimeOff { start: string; end: string }
export interface WorkingCalendar { zone: string; week: (WorkingHours | null)[]; timeOff: TimeOff[] }
export const defaultWeek: (WorkingHours | null)[] = [null, ...Array.from({ length: 5 }, () => ({ start: 540, end: 1020 })), null]
export const defaultCalendar = (): WorkingCalendar => ({ zone: workspaceZone, week: defaultWeek.map(day => day ? { ...day } : null), timeOff: [] })
export const withoutTimeOff = (calendar: WorkingCalendar): WorkingCalendar => ({ ...calendar, timeOff: [] })

/** Local millisecond intervals available that day, after subtracting personal time off. */
export function availableIntervals(day: number, calendar: WorkingCalendar): [number, number][] {
  const hours = calendar.week[weekday(day)]
  if (!hours || federalHolidays(new Date(day * DAY).getUTCFullYear()).has(day)) return []
  let slots: [number, number][] = [[hours.start * 60000, hours.end * 60000]]
  for (const leave of calendar.timeOff) {
    const start = readStamp(leave.start, calendar.zone), end = readStamp(leave.end, calendar.zone)
    const a = (start.day - day) * DAY + (start.wallMs ?? 0)
    const b = (end.day - day) * DAY + (end.wallMs ?? DAY)
    if (a >= DAY || b <= 0) continue
    slots = slots.flatMap(([lo, hi]): [number, number][] => b <= lo || a >= hi ? [[lo, hi]] : [...(a > lo ? [[lo, a] as [number, number]] : []), ...(b < hi ? [[b, hi] as [number, number]] : [])])
  }
  return slots
}

/** First available local instant at or after a request. A finish may lie at an interval's closing boundary. */
export function availableStamp(stamp: Stamp, calendar: WorkingCalendar, finish = false): Stamp {
  if (stamp.wallMs === null) return { day: onOrAfter(stamp.day, calendar), wallMs: null }
  for (let day = stamp.day; ; day++) {
    const wall = day === stamp.day ? stamp.wallMs : 0
    for (const [start, end] of availableIntervals(day, calendar)) {
      if (wall < end || (finish && wall === end)) return { day, wallMs: Math.max(start, wall) }
    }
  }
}

/** Signed productive wall time between timed endpoints; DST never adds or removes scheduled working hours. */
export function workingTimeBetween(start: Stamp, end: Stamp, calendar: WorkingCalendar): number {
  if (start.wallMs === null || end.wallMs === null) return 0
  if (compareStamp(start, end) > 0) return -workingTimeBetween(end, start, calendar)
  let count = 0
  for (let day = start.day; day <= end.day; day++) {
    const lo = day === start.day ? start.wallMs : 0, hi = day === end.day ? end.wallMs : DAY
    for (const [a, b] of availableIntervals(day, calendar)) count += Math.max(0, Math.min(hi, b) - Math.max(lo, a))
  }
  return count
}

/** Move through productive local time, preserving the duration through closed hours, leave and DST. */
export function addWorkingTime(stamp: Stamp, milliseconds: number, calendar: WorkingCalendar): Stamp {
  if (stamp.wallMs === null) return { ...stamp }
  if (milliseconds >= 0) {
    const from = availableStamp(stamp, calendar, milliseconds === 0)
    if (milliseconds === 0) return from
    let left = milliseconds
    for (let day = from.day; ; day++) {
      for (const [a, b] of availableIntervals(day, calendar)) {
        const lo = day === from.day ? Math.max(a, from.wallMs!) : a
        if (lo >= b) continue
        if (left <= b - lo) return { day, wallMs: lo + left }
        left -= b - lo
      }
    }
  }
  let left = -milliseconds
  for (let day = stamp.day; ; day--) {
    for (const [a, b] of availableIntervals(day, calendar).reverse()) {
      const hi = day === stamp.day ? Math.min(b, stamp.wallMs) : b
      if (hi <= a) continue
      if (left <= hi - a) return { day, wallMs: hi - left }
      left -= hi - a
    }
  }
}
export const compareStamp = (a: Stamp, b: Stamp): number => a.day - b.day || (a.wallMs === null || b.wallMs === null ? 0 : a.wallMs - b.wallMs)

/** Reserve elapsed effort inside local working intervals, subtracting every opaque provider meeting. */
export function freeTimeSlots(date: string, calendar: WorkingCalendar, busy: { start: string; end: string }[], minutes: number) {
  const slots: { start: string; end: string }[] = [], duration = minutes * 60000
  for (const [lo, hi] of availableIntervals(dayNumber(date), calendar)) {
    const close = instantOf(date, hi, calendar.zone)
    for (let at = instantOf(date, lo, calendar.zone); at + duration <= close; at += 15 * 60000) {
      if (busy.some(b => Date.parse(b.start) < at + duration && Date.parse(b.end) > at)) continue
      slots.push({ start: new Date(at).toISOString(), end: new Date(at + duration).toISOString() })
    }
  }
  return slots
}

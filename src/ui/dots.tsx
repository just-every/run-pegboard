// A line of short phrases joined by "·" (parts.css): each phrase wraps whole and the separator never starts or ends
// a wrapped line.
export const Dots = ({ phrases }: { phrases: string[] }) => <span className="dl">{phrases.map((phrase, i) => <span key={i}>{tidy(phrase)}</span>)}</span>

const NB = ' '
/** Keeps a date ("Tue Feb 16, 2027"), a time ("4:10 pm") and a range's dash with the words they belong to, so no
 *  line ends inside them; a range may break only after its dash. */
export const tidy = (text: string) => text
  .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(, \d{4})?/g, (_, d, m, n, y = '') => `${d}${NB}${m}${NB}${n}${y.replace(' ', NB)}`)
  .replace(/(\d) (am|pm)\b/g, `$1${NB}$2`)
  .replace(/ – /g, `${NB}– `)

/** Running text with " · " between clauses: each "·" keeps to the words either side, so it never ends or starts a line. */
export const glue = (text: string) => tidy(text).replaceAll(' · ', `${NB}·${NB}`)

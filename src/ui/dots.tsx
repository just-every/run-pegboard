import type { ReactNode } from 'react'

// A line of short phrases joined by "·" (parts.css): each phrase wraps whole and the separator never starts or ends
// a wrapped line.
export const Dots = ({ phrases }: { phrases: ReactNode[] }) => <span className="dl">{phrases.map((phrase, i) => <span key={i}>{phrase}</span>)}</span>

/** Running text with " · " between clauses: each "·" keeps to the words either side, so it never ends or starts a line. */
export const glue = (text: string) => text.replaceAll(' · ', ' · ')

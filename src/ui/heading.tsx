import type { ReactNode } from 'react'
import { Dots } from './dots'

// The board's heading band: the title in the heavy grotesk, its one split-flap chip, and its facts on one "·" line.
export function Heading({ title, chip, facts }: { title: string; chip?: ReactNode; facts: ReactNode[] }) {
  return <header className="head">
    <div className="head-title"><h1>{title}</h1>{chip}</div>
    <p className="facts"><Dots phrases={facts} /></p>
  </header>
}

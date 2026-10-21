// The one split-flap chip on a screen (parts.css draws the tiles): "moved" tomato, "landed" green, "quiet" white.
export function Flap({ text, tone }: { text: string; tone: 'moved' | 'landed' | 'quiet' }) {
  return <span className={`flap chip ${tone}`} role="img" aria-label={text}>{[...text].map((letter, i) => letter === ' ' ? <i key={i} className="sp" /> : <i key={i} aria-hidden="true">{letter}</i>)}</span>
}

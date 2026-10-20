// The page's painted art: each plate ships as AVIF and WebP at the widths listed (public/landing/plates/<name>-<w>.*).
// Full-width scenes go to 3072 px for 1920 and 2560 screens (the hero plate is 12ui's 2x redraw; the interlude and
// closing 2304/3072 are Lanczos upscales of the desk's 1536 px scenes); the phone hero's two walker panels at 1x and 2x.
import { escape } from '../../base/run-site'

type Plate = { w: number; h: number; widths: number[] }
export const plates: Record<string, Plate> = {
  hero: { w: 1536, h: 848, widths: [768, 1152, 1536, 2304, 3072] },
  'hero-left': { w: 222, h: 348, widths: [222, 444] },
  'hero-right': { w: 316, h: 348, widths: [316, 632] },
  interlude: { w: 1536, h: 914, widths: [768, 1152, 1536, 2304, 3072] },
  closing: { w: 1536, h: 984, widths: [768, 1152, 1536, 2304, 3072] },
}

export function plate(name: string, alt: string, sizes: string, cls = '', eager = false): string {
  const p = plates[name]
  const set = (ext: string) => p.widths.map(w => `/landing/plates/${name}-${w}.${ext} ${w}w`).join(', ')
  const fallback = p.widths.find(w => w >= 1536) ?? p.widths[p.widths.length - 1]
  return `<picture class="plate${cls ? ' ' + cls : ''}"><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<img src="/landing/plates/${name}-${fallback}.webp" srcset="${set('webp')}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${escape(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></picture>`
}

// 10 · Interlude (page-10): the Switchback Customer Summit's registration in Austin, Wed Oct 28, 8:40 am, a drawn scene
// with one set-type tag. The plate carries no painted text.
import { plate } from '../plates'
import { dots, t } from '../parts'

export const interludeSection = (): string => `<section class="sec il" id="interlude" aria-label="Switchback Customer Summit registration"><div class="wrap">
  <figure class="il-fig">${plate('interlude', 'Summit registration at 8:40 am: staff at a pink table hand lanyards to attendees with coffee, a badge wall two-thirds empty, and three badged attendees walking toward the open ballroom doors.', '(min-width: 1440px) 1344px, calc(100vw - 2 * clamp(16px, 6.25vw, 96px))', 'il-plate')}
  <figcaption class="card il-tag">${dots(['Wed Oct 28, 8:40 am', 'Austin', 'Switchback Customer Summit', 'registration', '486 checked in by 9:00 ✓'].map(t))}</figcaption></figure>
</div></section>`

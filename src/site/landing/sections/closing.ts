// 13 · Closing (page-13): the I-35 billboard in Kansas City on Fri Oct 30 (a drawn scene, no painted text), then the split
// close: the call to action on the left, six result cards on the right, future items worded as scheduled, no check.
import { docsHref } from '../../frame'
import { plate } from '../plates'
import { glyph, heading, line, type Team } from '../parts'
import { runButton } from './hero'

const results: [Team, string, string, string, boolean?][] = [
  ['marketing', 'Marketing · Kettle & Crumb', 'I-35 billboard up Tue Oct 27 ✓', 'holiday menu live Mon Nov 2'],
  ['events', 'Events · Switchback', 'Austin summit · 14 of 14 sessions', '486 checked in ✓'],
  ['operations', 'Operations · High Desert', '1,440 pallet positions', 'Reno B2 inspection passed ✓'],
  ['agency', 'Agency · Oxbow', 'Cedar Valley CU lobby sign', 'installed Wed Oct 28 ✓'],
  ['people', 'People · Bellwood', '11 hires · 33 of 33 ✓', 'first day Mon Nov 2'],
  ['product', 'Product · Wildwood', 'Packaging locks Mon Nov 2', 'launch Tue Feb 16 held', true],
]

export const closingSection = (): string => `<section class="closing" id="closing" aria-label="Run Pegboard">
  ${plate('closing', 'A flat late-afternoon scene on I-35 in Kansas City: a pink billboard with a braided loaf and a gift box over the highway, four cars driving one way, the skyline behind, and a woman in a pink coat walking past with coffee.', '100vw', 'cl-plate')}
  <div class="sec cl-split"><div class="wrap cl-grid">
    <div class="cl-cta">${heading('Bring the next brief.', 'Run it to done.')}<p class="free">100% free and open source.</p>
      <p class="btns">${runButton()}<a class="txt-link" href="${docsHref}">Read the docs</a></p></div>
    <ul class="cl-res">${results.map(([g, head, a, b, mv]) => `<li class="card r">${glyph(g, 44)}<div><p class="tt">${line(head)}</p><p class="d${mv ? ' mv' : ''}">${line(a)}</p><p class="d">${line(b)}</p></div></li>`).join('')}</ul>
  </div></div>
</section>`

// The homepage (evidence/desk-pegboard/page-s1): six US businesses through October 2026, one stage of work per section.
import { siteDocument } from './frame'
import { heroSection } from './landing/sections/hero'
import { octoberSection } from './landing/sections/october'
import { intakeSection } from './landing/sections/intake'
import { briefSection } from './landing/sections/brief'
import { workloadSection } from './landing/sections/workload'
import { proofsSection } from './landing/sections/proofs'
import { statusSection } from './landing/sections/status'
import { onboardingSection } from './landing/sections/onboarding'
import { replanSection } from './landing/sections/replan'
import { interludeSection } from './landing/sections/interlude'
import { nextweekSection } from './landing/sections/nextweek'
import { switchingSection } from './landing/sections/switching'
import { closingSection } from './landing/sections/closing'

const sections = [heroSection, octoberSection, intakeSection, briefSection, workloadSection, proofsSection, statusSection, onboardingSection, replanSection, interludeSection, nextweekSection, switchingSection, closingSection]
const styles = ['base', 'hero', 'october', 'intake', 'brief', 'workload', 'proofs', 'status', 'onboarding', 'replan', 'interlude', 'nextweek', 'switching', 'closing']
const description = 'Pegboard turns briefs and requests into plans that fit everyone\'s week, gets client sign-off on proofs, and writes the weekly status from real work. 100% free and open source.'

export function landingHtml(): string {
  const content = `<main id="main" class="landing">${sections.map(s => s()).join('\n')}</main>`
  const head = '<link rel="preload" href="/fonts/inter/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>' + styles.map(s => `<link rel="stylesheet" href="/landing/${s}.css">`).join('')
  return siteDocument('Pegboard — every project, from brief to done', description, head, content, '<script src="/landing/cords.js" defer></script>')
}

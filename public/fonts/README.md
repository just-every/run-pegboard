# Fonts

Inter (variable, Latin) is self-hosted under the SIL Open Font License 1.1 in
`inter/OFL.txt`. It is Pegboard's one face: the heavy weights for every heading,
the wordmark and card titles, the regular weights for data, in the app, Base's
sign-in and setup documents, the installer, the homepage and the docs. Nothing
makes a third-party request.

`/rer-theme.css` declares the face (`@font-face`, weights 100 to 900), as Base's
theme grammar asks, so the installer and Base's documents load it with the
theme. The app's documents and Base's frames preload the file through
`src/base/font-head.ts`; the homepage and the docs preload it in their heads.
The Latin file has no ✓ or → glyphs: the app draws its tick and arrow as inline
SVG (`src/ui/icons.tsx`).

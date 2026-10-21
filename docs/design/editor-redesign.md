# Editorial workspace

Figma: https://www.figma.com/design/SVm9HT69e5zMYMV9MiR1d4?node-id=5-179

Editable native frames:

- Desktop / Editor: 5:179, 1440px
- Mobile / Edit: 5:268, 390px
- Mobile / Preview: 5:352, 390px

Uses imported Simple Design System button/input instances, semantic color variables and Noto Sans KR typography. Sample article is illustrative design content, not an actual conversion.

Claude reviewed the three exported frames. Initial clipping findings were fixed by allowing text to size to content; the second visual review concluded DESIGN_APPROVED.

Implementation uses existing application controls and retains revision-checked autosave, conflict recovery and sanitized server-rendered Markdown. Mobile buttons switch edit/preview/source in place. Desktop keeps preview beside edit/source. Preview title and HTML are one saved snapshot. Publication status represents the last confirmed save; pending checkbox requests do not expose a share URL until saved.

Font files are self-hosted through Fontsource. External font CSS was incompatible with the existing CSP and CSS import ordering. The Tailwind Turbopack rule excludes CSS Modules so their scoped class exports remain intact.

Browser verification used an ephemeral development-only fixture, removed before the production build. No production job, AI call or database mutation was used. Checked mobile navigation, source text, 390px overflow, local font, and revision-checked autosave with an intercepted API response.

Final checks: production build, ESLint and git diff whitespace checks passed. Claude's implementation re-review concluded SHIP_READY after fixing the client/server 50,000-character limit mismatch and making manual retry status explicit. Existing unrelated landing/header changes remain in the working tree. No deployment was performed as part of this design change.

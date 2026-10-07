# Translation sources

Game content is written in Hebrew in the code. English and Arabic are produced at run time from the files here.

- `s00..s18.{en,ar}.txt` – one line per Hebrew string, aligned with `../keys-static.json` (200 lines per chunk). `-` = not a real string.
- `extra.tsv`, `extra2.tsv` – `hebrew<TAB>english<TAB>arabic`: fragments and labels that the code assembles from pieces. They win over the chunks.
- `tpl.txt` – sentence patterns with values: `hebrew ||| english ||| arabic`, `{}` = a value, `{0}`, `{1}` on the translation side.

After editing: `npm run i18n:build` regenerates `src/shared/i18n/content.{en,ar}.ts` and `patterns.extra.ts`.
`npm test` checks that the English and Arabic dictionaries match and contain no Hebrew.

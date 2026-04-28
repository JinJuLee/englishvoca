# englishvoca

A newspaper-style English vocabulary tool, built for focused TOEFL study and grown by hand.

The interface borrows from print: classic serifs, double rules, a blackletter masthead, columns. The aim is to make a vocabulary list feel like a newspaper edition — something to sit with, not click through.

## What it does

- **Index** — Today's words laid out as a newspaper index. Per-row TTS, status check.
- **Study** — One word at a time. Auto-advance, paced by content. English read aloud while the Korean meaning waits a beat.
- **Add** — A "Letter to the Editor" form for pulling words out of reading, listening, or writing practice.
- **Editions** — Day 01 through Day 30 (and a Custom bucket), selectable individually or in groups.

## Design choices

- **No paid API.** Pronunciation uses the browser's built-in Web Speech API; audio is free. Word entries are written by the user (or with help from a local LLM session — see *Adding words* below).
- **English-only audio.** Korean meaning is shown, never read. The point is to drill the English sound; reading the Korean adds noise.
- **Variable auto-advance.** Wait time scales with Korean meaning length so you don't get rushed on long definitions or stalled on short ones.
- **Sections → Days → Words.** The same hierarchy works for the core word list, for words you scrape from a Reading passage, and for any other section. Build only what you need.

## Architecture

```
data/
  sections.json              # which sections exist + day counts
  vocabulary/day-01.json     # one Day file per Day
  vocabulary/day-02.json
  reading/day-01.json        # words you pulled from a Reading passage
  writing/day-01.json
  ...
  example/                   # committed schema reference
```

Each Day file:

```json
{
  "section": "vocabulary",
  "day": 1,
  "title": "Day 01",
  "topic": "Foundation Words for Reading",
  "words": [
    {
      "id": "ubiquitous",
      "word": "ubiquitous",
      "pos": "adj.",
      "ipa": "/juːˈbɪk.wɪ.təs/",
      "synonyms": ["omnipresent", "pervasive", "prevalent", "widespread"],
      "korean": "도처에 있는, 어디에나 존재하는",
      "americanUsage": "...",
      "toeflContext": "...",
      "examples": [{ "en": "...", "ko": "..." }]
    }
  ]
}
```

See [`data/example/day-01.json`](data/example/day-01.json) for a working sample.

## Adding words

Two paths:

**1. Through Claude Code (recommended for now).** Open this repo in a Claude Code session and ask:

> Add "serendipity" to vocabulary Day 30.

Claude fills IPA, Korean, American usage, TOEFL context, and an example sentence, and writes the entry into the right Day file. Costs nothing beyond your existing Claude subscription — no API key, no per-word charges.

**2. Through the Add page (manual).** Open `add.html`, fill in the fields by hand, and save the JSON. Useful when you want full control over wording.

Future: when you have an Anthropic API key, the Add page's *▶ Look up* button can be wired directly to the Claude API for one-click drafts.

## Copyright

This repo is the **shell** — UI, styles, schema. The vocabulary data itself stays local: `data/*/` is gitignored except for the example folder. If you build your word list from a published source (e.g., Hackers Vocabulary, Barron's, ETS materials), keep it private. Don't redistribute. The schema and a generic example day are the only data committed here.

## Running it

No build step. Just open `index.html` in a browser. Works as a static site — host on GitHub Pages, your own server, or just `file://`.

```bash
open index.html
```

For local development with live reload, any static server works:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Stack

- HTML / CSS / vanilla JavaScript (no framework, no build)
- LocalStorage for progress (memorized state, last-seen, custom additions)
- Web Speech API for TTS
- EB Garamond, Playfair Display, Chomsky (NYT-style masthead)

## License

MIT for the code. Vocabulary data you add to your local copy belongs to you (and to the original publishers, where applicable).

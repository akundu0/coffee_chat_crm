# Coffee Chat CRM

[![CI](https://github.com/akundu0/coffee_chat_crm/actions/workflows/ci.yml/badge.svg)](https://github.com/akundu0/coffee_chat_crm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Chrome extension that turns scattered LinkedIn coffee chats and networking
emails into a lightweight, local-first CRM — one click on LinkedIn to log a
contact, automatic Gmail thread matching, and a follow-up queue that tells
you who to reach out to next.

## The problem

Networking through LinkedIn DMs and cold emails generates a lot of loosely
connected state: who you talked to, what you talked about, and when to
follow up. The default tool for tracking that is a spreadsheet, but a
spreadsheet only stays useful if you remember to update it — and the moment
you have a real conversation, updating a spreadsheet is the last thing on
your mind. The result is usually a list that's accurate for a week and stale
for a semester.

LinkedIn doesn't offer a public API for reading a personal account's
messages, so a "fully automatic" contact sync isn't realistic without
scraping (which risks the account) or enterprise Sales Navigator access
(which isn't available to an individual). That constraint shaped the whole
design, described in [Design decisions](#design-decisions) below.

## The solution

Coffee Chat CRM meets the problem where it happens instead of asking you to
context-switch to a separate app:

- **On LinkedIn:** a small **"Log this contact"** button appears next to any
  open conversation. One click reads the name, headline, and profile URL
  already visible on the page and saves a contact — no copy-pasting, no
  separate tab.
- **In Gmail:** once connected, the background service worker periodically
  checks for new messages to/from people already in your contact list and
  auto-attaches them as notes — so an email thread about a role opening
  shows up next to the LinkedIn chat that led to it.
- **Everywhere:** the popup shows a **due-for-follow-up queue** first, not a
  flat contact list, because "who do I need to follow up with today" is the
  question that actually matters day-to-day.

All data lives in `chrome.storage.local` on your machine. There's no backend
server — the extension talks directly to Gmail's API with a read-only,
user-authorized OAuth token.

## Features

- One-click contact capture from an open LinkedIn conversation
- Freeform, timestamped meeting notes per contact
- Follow-up reminders with quick presets (3 days / 1 week / 2 weeks / 1
  month / 1 quarter) and native `chrome.notifications` alerts when one is due
- Gmail auto-matching by exact email address, with a conservative fallback
  to a unique-name match — ambiguous matches are skipped rather than guessed
- Manual "add contact" for people you met somewhere other than LinkedIn
- JSON export and one-click data wipe from the Settings page
- Zero external servers: your data never leaves `chrome.storage.local` and
  your own Gmail account

## Screenshots

| Popup — follow-up queue | LinkedIn — inline capture button |
| --- | --- |
| ![Popup icon](icons/icon128.png) | Injected next to the open thread header |

*(Swap this section for real screenshots once you've loaded the extension —
see [Manual verification](#manual-verification-in-chrome) below.)*

## Architecture

```
┌─────────────────────┐        chrome.runtime.sendMessage        ┌──────────────────────────┐
│  content script      │ ────────────────────────────────────▶  │  background service worker │
│  (linkedin-content.js)│                                        │  (background.js)           │
│  - injects button     │ ◀────────────────────────────────────  │  - routes messages         │
│  - reads visible DOM  │              response                  │  - runs Gmail sync alarm    │
└─────────────────────┘                                          │  - fires due-followup alarm │
                                                                   └────────────┬─────────────┘
┌─────────────────────┐        chrome.runtime.sendMessage                      │
│  popup (popup.js)     │ ────────────────────────────────────────────────────▶│
│  - list / search       │                                                     │
│  - contact detail       │                                                    ▼
│  - notes & follow-ups   │                                       ┌──────────────────────────┐
└─────────────────────┘                                          │  src/lib/*.js (pure logic) │
                                                                   │  - contactService          │
┌─────────────────────┐                                          │  - followupScheduler       │
│  options page          │  chrome.identity OAuth ───────────────▶│  - emailMatcher            │
│  (options.js)          │                                        │  - gmailQuery              │
│  - connect/disconnect   │                                        │  - linkedinParser          │
│  - export / clear data  │                                        │  - storageService          │
└─────────────────────┘                                          └────────────┬─────────────┘
                                                                                 ▼
                                                                     chrome.storage.local
```

The guiding rule: **anything that can be expressed as a pure function lives
in `src/lib/` and is unit tested there.** The content script, background
worker, popup, and options page are thin glue that wire those pure functions
to `chrome.*` APIs and the DOM — which is also why the test suite can cover
94%+ of the logic layer without ever launching a browser.

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Extension platform | Chrome Manifest V3 | Current standard; service worker background model |
| Language | Vanilla JS (ES modules) | No framework overhead for a ~10-screen extension; keeps the bundle inspectable by Chrome's reviewers |
| Storage | `chrome.storage.local` | Local-first, no server to run or pay for |
| Email integration | Gmail REST API via `chrome.identity` OAuth | Read-only, user-consented, no stored credentials |
| Testing | Jest + jsdom + Babel | ES modules in tests without a bundler |
| Linting | ESLint (flat config) | Catches unused vars, `var` usage, loose equality |
| CI | GitHub Actions | Lint + test + manifest validation on every push/PR, matrix-tested on Node 18 and 20 |

## Getting started

### Prerequisites

- Node.js 18+ and npm
- Google Chrome (or another Chromium-based browser)
- A Google Cloud project with OAuth consent screen configured, **only if**
  you want to test the Gmail integration (see below) — everything else
  works without it

### Install and verify

```bash
git clone https://github.com/akundu0/coffee_chat_crm.git
cd coffee_chat_crm
npm install
npm run lint      # ESLint over src/ and tests/
npm test          # Jest, with a coverage report printed to the terminal
npm run build:icons   # (re)generates icons/*.png — already committed, but reproducible
```

### Manual verification in Chrome

The unit tests cover the logic layer, but loading the extension is the only
way to see the injected button and popup UI, since those depend on
`chrome.*` APIs and LinkedIn's live DOM that Jest doesn't simulate:

1. Run `npm run build:icons` if `icons/` isn't already populated.
2. Open `chrome://extensions`, enable **Developer mode** (top right).
3. Click **Load unpacked** and select the repository root (the folder
   containing `manifest.json`).
4. Pin the extension and click its icon — the popup should open with an
   empty state ("No contacts yet…").
5. Click **+ Add contact manually** to confirm storage read/write works
   end-to-end without needing LinkedIn or Gmail.
6. Open `https://www.linkedin.com/messaging/` and open any conversation — a
   **Log this contact** button should appear next to the thread header
   within a second or two (a `MutationObserver` waits for LinkedIn's
   single-page-app to render the thread).

### Connecting Gmail (optional)

The Gmail integration needs its own OAuth client, since it reads from *your*
inbox under *your* Google Cloud project — the repo intentionally does not
ship a working client ID:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create
   a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (Internal or External, Testing mode is
   fine for personal use).
3. Create an **OAuth client ID** of type **Chrome Extension**, using the
   extension ID Chrome assigned after you loaded it unpacked
   (`chrome://extensions` shows it under the extension's card).
4. Copy that client ID into `manifest.json`'s `oauth2.client_id` field,
   replacing the placeholder.
5. Reload the extension, open the popup's Settings (gear icon), and click
   **Connect Gmail**.

### Testing

```bash
npm test          # run once with coverage
npm run test:watch    # watch mode while developing
```

Tests live in `tests/`, one file per `src/lib/` module, and run against
plain Node + jsdom — no Chrome required. `chrome.*`-dependent files
(`background.js`, `gmailClient.js`, `linkedin-content.js`, `popup.js`,
`options.js`) are kept intentionally thin and are exercised manually per the
steps above; the coverage report focuses on `src/lib/`, where the actual
business logic (follow-up math, email matching, DOM parsing, contact CRUD)
lives.

```bash
npm run lint       # check
npm run lint:fix   # auto-fix what's fixable
```

### CI

Every push and pull request runs `npm ci`, `npm run lint`, and `npm test` on
Node 18.x and 20.x via [`.github/workflows/ci.yml`](.github/workflows/ci.yml),
plus a manifest JSON validation and a syntax check of every source file. The
badge at the top of this README reflects the latest run on `main`.

## Project structure

```
coffee_chat_crm/
├── manifest.json              # MV3 extension manifest
├── src/
│   ├── lib/                   # Pure logic - unit tested, no chrome.* calls
│   │   ├── contactService.js  # Contact CRUD, notes, follow-ups
│   │   ├── followupScheduler.js  # Due-date math for the reminder queue
│   │   ├── emailMatcher.js    # Gmail-message-to-contact matching
│   │   ├── gmailQuery.js      # Gmail search-query building + response parsing
│   │   ├── linkedinParser.js  # LinkedIn DOM reading, dynamically imported
│   │   └── storageService.js  # chrome.storage.local adapter + in-memory test double
│   ├── background/
│   │   ├── background.js      # Service worker: message routing, alarms
│   │   └── gmailClient.js     # Gmail REST API + chrome.identity OAuth
│   ├── content/
│   │   ├── linkedin-content.js  # Injects the "Log this contact" button
│   │   └── linkedin-content.css
│   ├── popup/                 # Toolbar popup UI
│   └── options/                # Settings page (Gmail connect, export, clear)
├── tests/                     # One *.test.js per src/lib/ module
├── scripts/
│   ├── build-icons.js         # Generates icons/*.png (no binary assets committed as source)
│   └── package-extension.js   # Zips the extension for distribution
└── .github/workflows/ci.yml
```

## Design decisions

**Why a "Log this contact" button instead of full automation?** LinkedIn's
User Agreement prohibits automated data collection from the platform, and
enforcement targets exactly the kind of silent, page-load-triggered scraping
an "automatic" version of this feature would require. Gating capture behind
an explicit click keeps this a note-taking tool the user drives, rather than
a scraper running in the background — a meaningfully different risk profile,
even though both technically read the DOM.

**Why not automate sending messages or connection requests?** Automating
LinkedIn *actions* (not just reading the page) is the behavior LinkedIn
actively detects and enforces against, and it wasn't a goal of this project
in the first place — the point is remembering conversations, not generating
more of them.

**Why local storage instead of a hosted backend?** Coffee chat notes are
personal and often informal ("seemed skeptical about the team's roadmap");
there's no reason for that to leave the user's machine, and it avoids
needing to run, secure, and pay for a server for what is fundamentally a
single-user tool.

**Why dependency-inject the storage adapter?** `contactService.js` never
imports `chrome.storage` directly — it takes a small `{ get, set, remove }`
adapter. That's what lets 84 tests run against an in-memory adapter in
plain Node, with the exact same code path that runs against real
`chrome.storage.local` in the browser.

## Known limitations

- LinkedIn's markup changes without notice; if the "Log this contact"
  button stops appearing, the CSS selectors in
  `src/lib/linkedinParser.js#SELECTORS` are the first place to check.
- Gmail auto-matching only auto-links on an **exact** email match by
  design — a single ambiguous name match is surfaced nowhere yet (see
  `emailMatcher.js#resolveContactForMessage`'s `'name'` confidence level,
  which the background worker currently ignores rather than auto-linking).
- No sync across devices — `chrome.storage.local` is local to one Chrome
  profile. `chrome.storage.sync` was deliberately avoided due to its much
  smaller quota, but is a reasonable follow-up.

## License

[MIT](LICENSE)

# ENIGMA Student Planner

A study planner and progress-reporting app for Iranian university-entrance-exam
(*konkur*) students, delivered as **one self-contained HTML file that runs
completely offline**.

Concept, design, development and project direction by
**Amirhossein Bazdar (امیرحسین بازدار)**.

Persian-language user guide: [`docs/README.fa.md`](docs/README.fa.md)

## Overview

Study consultants in Iran typically hand their students a weekly plan on paper
or in a messaging app, and get progress back the same way. Nothing is
aggregated, so neither side can see whether the plan was realistic or whether
the student actually followed it.

ENIGMA closes that loop without asking anyone to install software, create an
account, or have a reliable internet connection:

1. The consultant writes next week's plan — either inside the app's consultant
   mode or as a small JSON file — and sends it to the student.
2. The student opens a single HTML file in any browser, sees today's tasks,
   and logs what they actually did: minutes spent, questions answered, correct
   and wrong counts, or a reason for skipping.
3. The app derives every statistic and chart from those logs and produces a
   printable daily or weekly report the consultant can review.

The whole app — markup, styles, scripts, logo, the consultant's plan and the
student's data — is inlined into one ~440 KB file that works from `file://`,
with no server, no build step on the user's side, and no network access at any
point.

## Features

- **Two roles, one file.** The consultant's plan and the student's performance
  are separate state trees; the student can never overwrite the plan, and the
  consultant can merge a student's results back in without losing history.
- **Weekly plan import.** Consultants author a week as a readable JSON file
  (see [`examples/ENIGMA-Week-03.json`](examples/ENIGMA-Week-03.json)).
  Unknown subjects are created automatically and new weeks are appended rather
  than replacing earlier ones.
- **Self-export.** The app can re-emit itself as a new HTML file carrying the
  updated payload, which is how a student hands work back on a phone with no
  cloud storage.
- **Derived statistics.** No figure is ever stored. Achievement rates,
  accuracy, per-subject breakdowns and trends are all computed in one engine
  and memoised against a store version counter, so no two screens can disagree.
- **Planned vs. actual time is never conflated.** If a student completes a task
  without recording a duration, the planned time is used as a fallback but is
  labelled *estimated* everywhere it appears.
- **Charts without a charting library.** Trend lines, planned-vs-actual bars,
  subject radar and exam trends are hand-drawn SVG, themed from the same CSS
  custom properties as the rest of the UI and sized to the viewport so labels
  stay legible on a 320 px phone.
- **Jalali calendar.** Dates are stored as ISO Gregorian strings and converted
  to the Persian calendar purely for display.
- **Printable reports.** Daily and weekly reports render to a dedicated print
  stylesheet for PDF export.
- **Mobile-first RTL layout.** Bottom navigation, bottom-sheet dialogs, 44 px
  touch targets, 16 px inputs to stop iOS Safari zooming, and no horizontal
  scroll at any width.
- **Degrades safely.** A `<noscript>` message, real static markup inside the
  app root, and an ES5 error boundary registered before anything else mean a
  failure shows an explanation rather than a blank page.

## Tech Stack

- **Vanilla JavaScript (ES5, classic scripts)** — no framework, no bundler, no
  runtime dependencies. ES5 is a hard constraint so the delivered file parses
  on older mobile browsers.
- **CSS custom properties** for the design token layer, with the palette
  sampled from the project logo.
- **Inline SVG** for all charts and icons.
- **`localStorage`**, keyed per student so two student files on the same
  machine never collide (all `file://` pages share one origin).
- **Node.js** for tooling only — the build script, the test runner and a local
  static server. Nothing from npm.

## Project Structure

```
src/
  index.html              entry point; opens directly in a browser, no server
  assets/logo.js          brand logo as a data URI
  css/
    tokens.css            design tokens (colours sampled from the logo)
    base.css layout.css components.css views.css
    report.css            print stylesheet
    simple.css            simplified student-facing layer
  js/
    core.js               constants, formatting, Persian numerals
    date.js               Jalali <-> Gregorian conversion and display
    store.js              single source of truth (plan / performance)
    stats.js              calculation engine — every figure comes from here
    charts.js             dependency-free SVG charts
    ui.js                 DOM builder, modals, toasts
    transfer.js           HTML and JSON import/export
    week-import.js        weekly-plan JSON parser and validator
    demo.js               sample dataset
    app.js                shell, navigation, bootstrap
    views/                today, week, progress, exams, reports,
                          consultant, settings, dashboard

build.js                  inlines everything into the single deliverable
tools/serve.js            local static server, for development only
tools/audit-selfcontained.js  fails the build on any external reference
tests/engine.test.js      260 assertions against the engine
examples/                 sample weekly-plan JSON
reference/                original interface/report design (PDF) and ENIGMA logo
dist/                     the built single-file app (checked in as the release)
docs/README.fa.md         Persian user guide for students and consultants
```

## Running Locally

Node.js is required for the build and tests only; the app itself needs nothing.

Open `src/index.html` directly in a browser — it works straight from the
filesystem because the scripts are classic, not modules.

Build the single deliverable file:

```bash
node build.js
```

That writes `dist/ENIGMA-Student-Planner.html` and then runs the
self-containment audit, which fails the build if the artifact references
anything outside itself — a remote URL, a `fetch` call, a font file, or syntax
newer than ES5.

Run the test suite:

```bash
node tests/engine.test.js
```

Serve the project over HTTP if you prefer (useful for testing on a phone on
the same network). It listens on port 4173 and serves the built file at `/`:

```bash
node tools/serve.js
```

## Demo

The app ships with a realistic sample dataset — two planned weeks, recorded
performance and several exam results. Open the app, then go to
**منو → تنظیمات → بارگذاری داده‌ی نمونه** to populate every screen. The state
is tagged as demo data and can be cleared from the same screen.

`reference/weekly_report.pdf` is the original interface and report design the
implementation was built from, and `reference/logo.png` is the source ENIGMA
logo the colour tokens are sampled from.

## Engineering Notes

A few decisions that shaped the codebase:

- **One file is the product, not a convenience.** The target users share files
  over messaging apps on phones with unreliable connectivity. That constraint
  ruled out a framework, a bundler, web fonts and any CDN, and it is enforced
  mechanically: the build runs a 42-check audit that rejects the artifact if it
  can reference anything external, including a syntax gate that rejects arrow
  functions, template literals, `let`/`const` and other post-ES5 syntax.
- **Derived, never stored.** Storing computed statistics is the usual source of
  screens disagreeing with each other. Everything flows from raw task logs
  through a single memoised engine.
- **The distinction between measured and estimated time is preserved
  end-to-end**, because a consultant acting on an estimate as if it were a
  measurement makes worse plans.
- **The engine is tested without a browser.** The suite loads the real source
  files into a Node VM with a minimal `localStorage` stub, so persistence, boot
  recovery, the validators and the full acceptance scenario are exercised
  against production code rather than mocks.

## Author & Credits

**Product Concept, Design, Development & Project Direction —
Amirhossein Bazdar (امیرحسین بازدار)**

ENIGMA was conceived, designed, directed, built and finalised end to end by
Amirhossein Bazdar, its sole creator. That work spans the full lifecycle of the
project:

- **Concept and product vision** — identifying the consultant/student feedback
  gap and defining what an offline, single-file answer to it should be.
- **Feature ideation and definition** — scoping every capability, from the
  weekly plan hand-off to the exam tracker and the reporting model.
- **Product architecture and workflow design** — the two-role model, the
  plan-versus-performance separation, and the export/import lifecycle that
  carries a week from consultant to student and back.
- **System and application structure** — the module layout, the derived-state
  approach, and the offline-first constraints that shaped every technical
  decision.
- **UI/UX design and user-experience decisions** — screen structure and
  navigation, the mobile-first RTL layout, the task-completion flow, and the
  wording and tone of the interface.
- **Visual design and visual direction** — the ENIGMA identity, logo, colour
  system and design-token palette, and the interface direction the
  implementation follows.
- **Planning and reporting system design** — the task and week model, the
  statistics engine, the achievement and accuracy metrics, and the printable
  daily and weekly report formats.
- **Feature prioritisation and project direction** — deciding what shipped,
  what stayed out, and in what order.
- **Implementation and development** — the complete codebase: state store,
  statistics engine, Jalali date layer, SVG charts, views, transfer layer and
  build tooling.
- **Testing, refinement, integration and finalisation** — the engine test
  suite, the self-containment audit, and the release of the single-file build.

## License

No license file is currently included; all rights are reserved by the author,
Amirhossein Bazdar.

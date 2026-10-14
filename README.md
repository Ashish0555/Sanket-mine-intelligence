# SANKET — Mine Intelligence

A working mining knowledge assistant for questions, case inquiries and an incoming officer's fire briefing. The source collection is the two supplied DGMS SANKET books. This is an educational decision-support prototype, not an operational safety clearance system.

## Use the application

1. Open the local app and choose **Your mine context**. Enter sector, working method and known conditions; leave unknown facts unspecified.
2. Use **Ask SANKET** for a question, or **Officer briefing** to build a first-week fire review.
3. Open the citation buttons to inspect the original extracted inquiry and the matching PDF page.
4. **Case library** searches all 622 structured cases. Its default fire filter contains 14 confirmed fire-related cases; explosions and uncertain cases are excluded from that subset.
5. The website needs no key entry or connection steps. Configure the server once in `.env`, then use the assistant normally. Credentials and model selection are never sent by the browser.
6. Answers and briefings can be copied or downloaded with their citations.

Book mode works immediately without an API key. It retrieves cases and inquiry extracts. A Gemini key is required for conversational synthesis, Hindi/Hinglish generation and more flexible follow-up reasoning. Limited Hindi/Hinglish search synonyms are available in book mode, but source extracts remain English.

## What was trained

The language model was **not fine-tuned**. A 64-dimensional latent semantic retrieval model (TF-IDF + truncated SVD/LSA) was fitted to the SANKET corpus. Its scores are combined with BM25 keyword matching, exact mine-name signals and sector filtering. Retrieved passages are supplied to Gemini, which is instructed to answer only from that evidence and attach source IDs. The server validates citation IDs. Citation validity does not prove that every generated sentence is entailed; human review remains necessary.

- Two source PDFs: 316 + 355 = 671 pages.
- 631 pages have at least 80 extracted characters after header cleanup. Short, blank, cover and image-only pages are excluded from text retrieval but retained in the PDFs.
- 622 structured 2016–2022 accident accounts include the inquiry narratives.
- 1,704 indexed case/page passages, with overlap for longer pages.
- Fourteen confirmed fire cases support the fire briefing subset. Site-specific causal effect, risk probability and current legal compliance are not inferred from these counts.
- Source table layout and image charts may not survive extraction. Consult the original PDF for numerical tables and dimensions.

The ingestion manifest and source SHA-256 hashes are in `data/manifest.json`.

## Run locally

Requires Node.js 22.13+.

1. Extract the ZIP. It includes a blank `.env` beside `package.json`; if missing, copy `.env.example` to `.env`.
2. Open `.env` in a text editor and set `GEMINI_API_KEY=your_actual_key`. Leave `GEMINI_MODEL` at its default or choose a text model available to your account.
3. Save the file and start the application:

```sh
npm ci
npm run dev
```

You can also use the included Mac or Windows launcher. Restart the app after editing `.env`. On Mac, press Command + Shift + . in Finder to show the `.env` file.

The project uses the Sites Vinext starter and Cloudflare Workers-compatible server routes. The normal local URL is printed by the development server.

The local server loads `.env` through the Cloudflare development runtime. `npm run build` followed by `npm start` also reads the root `.env`. For a hosted deployment, configure `GEMINI_API_KEY` and `GEMINI_MODEL` as server secrets. Never prefix the key with `VITE_` or `NEXT_PUBLIC_`, put it in a public folder, or add it to Git. The browser cannot supply or override a key or model through the chat endpoint.

Gemini is the server-side answer-generation provider. It receives the question, recent conversation, mine context and retrieved passages. Model availability and free quota depend on your account; Google's applicable data terms apply. The frontend uses SANKET branding without provider connection controls. When the key is blank or the service fails, the app returns book evidence.

The release packager always inserts an empty `.env` template and excludes real environment files, local runtime state and compiled build output. Do not manually share a working folder containing your key.

## Rebuild the search model

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements-knowledge.txt
python scripts/build_knowledge.py
```

The builder uses the included PDFs, `inputs/accident-cases.json` and `inputs/fire-register.json`, and regenerates the index/model. The structured case extraction and fire coding were prepared in the preceding SANKET evidence project. The original case text and source page references remain available.

## Verification

With the development server running:

```sh
node scripts/evaluate.mjs
npm test
npm run lint
npm run typecheck
npm run build
```

`evaluate.mjs` checks 18 development retrieval queries, input validation, sector filtering, citations, current-rule abstention, emergency guidance and out-of-scope handling. These are known-case development checks, not an independent benchmark of real-world mining advice. `npm test` runs mocked provider checks, retrieval/API regressions and server-environment checks. It covers malformed responses, citation validation, request limits, follow-up grounding, named-mine relevance, rejection of browser credential overrides and absence of provider configuration in public metadata. The automated suite makes no real API calls. A controlled live generation check still requires a valid user key.

## Demonstration for the professor

- Problem: an incoming officer has to learn from prior accidents and decide what to inspect first.
- Input: mine sector, working method, conditions, and a question.
- Process: hybrid document retrieval → relevant inquiry evidence → Gemini synthesis → citation validation.
- Output: similar cases, underlying failures, proposed control checks, suggested owners, missing information, and exact source pages.
- Demonstrate: Khadia fuel-system repair → burning-ground case → first-week officer briefing → citation/PDF verification.
- State the limits: historical reports; incomplete site context; current rules need a current authoritative source; no live sensing or automatic mine control.

## Primary documentation

- [DGMS Coal SANKET](https://dgms.gov.in/writereaddata/UploadFile/sanket0404_2024.pdf)
- [DGMS Non-coal SANKET](https://dgms.gov.in/writereaddata/UploadFile/SANKETNonCoal_17042025.pdf)
- [Gemini API](https://ai.google.dev/api/generate-content)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Model availability](https://ai.google.dev/gemini-api/docs/models)
- [Gemini pricing and free-tier data terms](https://ai.google.dev/gemini-api/docs/pricing)

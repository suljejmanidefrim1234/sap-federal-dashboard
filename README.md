# Canadian federal SAP account planning

An interactive dashboard across SAP finance/ERP, HR, procurement, travel/expense, supply chain, data/analytics, business technology/integration, customer/constituent experience, sustainability and business transformation. It includes SAP, relevant software vendors, and systems integrators/consultants including Deloitte, IBM, Accenture, CGI, KPMG, PwC and EY.

## Public website and automatic weekly updates

[Open the hosted dashboard](https://suljejmanidefrim1234.github.io/sap-federal-dashboard/). No HTML download or GitHub login is needed.

GitHub Actions downloads the complete specified government resource and republishes the dashboard **every Monday at 14:00 UTC** (9 a.m. Toronto time in winter, 10 a.m. in summer). Pushes to main and manual workflow runs also refresh it. Reload the website to see the latest deployed snapshot.

The snapshot and refresh status are committed after successful validation so later runs compare against the latest data. **Newly observed disclosures** match department + disclosure reference against the previous successful snapshot. They may be delayed publications or amendments, not newly signed contracts. Changes to existing references are counted separately and may represent corrections. Use **Accounts with new disclosures**, then **New in latest refresh** within an account, to see supporting records.

The Accounts, Renewal signals and Market overview pages retain the SAP/competitor/integrator supplier subset. The weekly job reads the full government file but the dashboard is not a complete all-supplier federal procurement feed. Department-specific government lookups include all suppliers in their retrieved sample.

If source collection fails, the site keeps the last good data and shows the failed refresh attempt and last successful refresh. Government disclosure timing may lag signing. The weekly schedule has been configured; it depends on GitHub Actions and government source availability.

## What works

- **Accounts (default):** department/name/code search; SAP, competitor, upcoming-date and solution-keyword filters; account profiles; supplier expansion with five contract groups per page; original disclosure details and source links; separately paginated amendments; all solution areas with supporting evidence filters.
- **Renewal signals:** department, supplier, supplier group, solution area (including Unknown), end-date window, and past/upcoming filters; reported totals, dates, descriptions, vehicles and indicators. Month windows are explicit day approximations.
- **Market overview:** tracked supplier subset only; award-year and supplier-group filters; interactive year chart; top departments/suppliers and group breakdown.
- **Government lookup:** the supported `datastore_search` API with exact department `owner_org` filters; retrieves up to 500 recent raw department disclosures sorted by reported contract date and applies date/value scope before displaying at most 100 eligible records. Shows raw retrieved count, eligible sample count and separately labelled all-history department total, with sample/complete-scope labels and five-record pages. API errors, HTML rejection pages and wrong-department responses are rejected. Live results do not modify the snapshot.
- **Snapshot import:** import a generated government snapshot JSON without rebuilding the app. The import is session-only and identifies the resource and coverage; it does not independently establish provenance of a supplied file.

## Government data and present limitations

Source: [Government of Canada — Proactive Publication, Contracts over $10,000](https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/fac950c0-00d5-4ec1-a4d3-9cbebf98a305). Resource ID: `fac950c0-00d5-4ec1-a4d3-9cbebf98a305`.

Scope: January 1 of the current Toronto calendar year minus five through the current Toronto date. On November 24, 2026 this is **January 1, 2021 – November 24, 2026**, with reported total contract value **strictly greater than CAD $10,000**. Invalid dates, out-of-range dates and values at or below the threshold are excluded.

During local verification on November 24, 2026, the government resource, metadata, API and search endpoints returned **Request Rejected** HTML pages, including HTTP 200 responses. However, **GitHub's runner successfully downloaded the full resource**. The bundled real snapshot scanned **1,336,149 CSV rows**, found **481,211 date/value-eligible disclosures**, retained **8,607 tracked-supplier disclosures**, and contains **94 departments/agencies**. It was refreshed on **November 24, 2026 at 9:25 p.m. Eastern**. Source file SHA-256: `ea600874e45e7d642a6330c12364740ee7a73ae5556376d830767227503e7719`. Complete means complete against the downloaded resource and the specified tracked matching rules, not complete department procurement or supplier coverage. No example contracts are shipped. Check `government-snapshot.json` for exact coverage and `government-verification.json` for actual API/source-link probes. Local browser access remains unverified.

The public GitHub Pages workflow refreshes the complete source weekly, compares disclosures against the last committed snapshot, validates the result, persists the latest snapshot and deploys it. A failed source download preserves the last good data and publishes an explicit stale-data warning. A source download alone does not guarantee the government has published every recently signed contract.

API requests run in the browser. The government exposes `datastore_search` but does not expose `datastore_search_sql`. Department filtering occurs in the API; date/value filtering occurs after retrieval and never converts a sample into a full history. Browser requests use JSON with a public CKAN JSONP fallback when CORS headers are absent. Government availability, network restrictions and browser policy can still prevent live lookups. No deployed API proxy or authenticated hosted site is provided. A complete scoped response is not the department procurement history. Missing data never establishes confirmed whitespace.

**Actual live verification:** the GitHub runner successfully queried Health Canada on November 24, 2026 at 9:25 p.m. Eastern: 500 raw department disclosures retrieved, 496 eligible within scope, and an API total of 14,835 department disclosures across all dates/values. The JSONP callback and one matching government disclosure link were verified. API CORS headers were absent, so browser fallback is implemented and tested. Local corporate-network access continued to return rejection pages. See `government-verification.json` for the exact probe.

## Data interpretation

Supplier aliases match whole words after case/punctuation/accent normalization. Solution keywords are drawn from disclosed descriptions and comments, **never inferred from supplier identity**. All area evidence needs verification. The supplier taxonomy is a research list, not a claim of partnership, product usage, ownership history or market share; IBM may provide both software and services, and Qualtrics is a separate tracked software vendor.

Group records by exact department + normalized tracked supplier + exact procurement ID. If that ID is absent/NA, use the disclosure reference; without either identifier keep records separate. Do not group by vehicle number. Reused identifiers, aliases, consortia, resellers, missing disclosures and changed identifiers can cause false or missed grouping.

Use the total in the most recent in-scope disclosure per group; do **not** add repeated amendment totals. Dates order the records, with reporting period and reference-number tie breaks; same-date ambiguity is flagged. The chart uses the earliest observed in-scope reported contract date, which may represent an amendment instead of the original award. The latest disclosure's end date is retained without filling gaps from earlier disclosures.

The official end field is **Contract Period End Date or Delivery Date**. End dates, amendments, options and extension mentions are research signals, not confirmed renewals/re-competes or buying opportunities. Reported total values are **not confirmed spending**.

Official schema: [contracts.yaml](https://github.com/open-data/ckanext-canada/blob/master/ckanext/canada/tables/contracts.yaml). Official search routes: [urls.py](https://github.com/open-data/oc_search/blob/master/oc_search/urls.py). Source links use `/contracts/record/{owner_org},{reference_number}`; one real Health Canada disclosure reference was verified with HTTP 200 and matching reference text. Other destinations have not been exhaustively checked.

## Refresh or import the actual government dataset

Use **Actions → Weekly government contracts and Pages deployment → Run workflow** for an immediate source refresh and deployment. The same workflow runs every Monday at 14:00 UTC. Alternatively:

```sh
npm ci
python3 scripts/snapshot.py --download
npm run build
```

For a government CSV already downloaded from the specified resource:

```sh
python3 scripts/snapshot.py --csv /path/to/contracts.csv
npm run build
```

A local CSV is labelled partial by default. Add `--complete` only when it is the full unfiltered resource. The tool verifies required headers, applies scope and supplier filters, records full-file SHA-256, scanned/eligible/tracked row counts and refresh time, and refuses HTML/empty data. Import the generated `src/data/snapshot.json` with the dashboard's **Import snapshot** control, or open the rebuilt `dist/dashboard.html`.

## Development and verification

```sh
npm ci
npm run dev
npm run test:data
npm test
npm run build
npm run test:build
```

Browser tests use Google Chrome and synthetic fixtures confined to `tests/`. They exercise account search, supplier expansion/pagination, grouping/value boundaries, evidence links, renewal and market filters, successful department-specific API responses, rejected/misdirected API responses, import validation and desktop layout. Data tests cover CSV scope/values, supplier boundaries and rejected downloads. Successful simulated API tests do not verify the real government's live service.

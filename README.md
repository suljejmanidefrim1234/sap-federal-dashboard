# SAP Federal Account Planning Dashboard

An interactive dashboard for SAP industry account executives responsible for Canadian federal public-sector accounts. Built to support account planning across all SAP lines of business.

## Features

### 1. Accounts View (Default)
- Searchable list of government departments and agencies
- Filter by SAP records, competitor records, upcoming end dates, or solution-area keywords
- Click any account to view detailed supplier activity
- Solution area research showing SAP vs competitor presence

### 2. Renewal Signals
- Focused view of tracked supplier contracts with recorded end dates
- Filter by department, supplier group, solution area, and time window (90 days to 18 months)
- Toggle between upcoming and past end dates
- Amendment and option indicators

### 3. Market Overview
- Tracked contract value by award year
- Top departments by reported tracked contract value
- Top tracked suppliers
- Supplier group breakdown (SAP, Competitors, Systems Integrators)

## Data Source

Uses the Government of Canada's **Proactive Publication — Contracts over $10,000** dataset via their open data API.

**Important disclaimers:**
- Covers tracked suppliers only (SAP, competitors, systems integrators)
- Contract values are reported disclosures, not confirmed spending
- End dates are research signals, not confirmed renewals
- Solution area identification is based on keyword matching

## Tracked Suppliers

### SAP & Related
SAP Canada, Concur, Ariba, SuccessFactors, Fieldglass, Qualtrics, Signavio

### Competitors
Oracle, Microsoft, Workday, Infor, Ceridian, Coupa, Salesforce, ServiceNow, Snowflake, and more

### Systems Integrators
Deloitte, IBM, Accenture, CGI, KPMG, PwC, EY, Capgemini, and more

## Development

```bash
npm install
npm run dev
```

## Deployment

The dashboard is automatically deployed to GitHub Pages when changes are pushed to main.

## License

For internal SAP use only.

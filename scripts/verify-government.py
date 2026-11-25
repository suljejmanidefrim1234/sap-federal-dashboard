#!/usr/bin/env python3
"""Probe the real supported department API, JSONP transport and disclosure link."""
from datetime import datetime, timezone, date
import json
from pathlib import Path
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from zoneinfo import ZoneInfo
from snapshot import reported_value

ROOT = Path(__file__).resolve().parents[1]
snapshot = json.loads((ROOT / 'src/data/snapshot.json').read_text())
resource_id = snapshot['resourceId']
report = {'verifiedAt': datetime.now(timezone.utc).isoformat(), 'apiVerified': False, 'apiMethod': 'datastore_search', 'sourceLinkVerified': False, 'browserCORS': 'Unknown', 'browserJSONP': False, 'errors': []}
source = next((r for r in snapshot['records'] if r['owner_org'] == 'hc-sc'), snapshot['records'][0] if snapshot['records'] else None)
if source:
    org = source['owner_org']
    report['department'] = org
    params = {'resource_id': resource_id, 'filters': json.dumps({'owner_org': org}), 'limit': 500, 'sort': 'contract_date desc, _id desc', 'offset': 0, 'include_total': 'true'}
    url = 'https://open.canada.ca/data/api/3/action/datastore_search?' + urlencode(params)
    try:
        with urlopen(Request(url, headers={'Accept': 'application/json'}), timeout=45) as response:
            data = json.load(response)
            report['browserCORS'] = response.headers.get('Access-Control-Allow-Origin', 'Not provided')
        records = data.get('result', {}).get('records', [])
        if not data.get('success') or not records or any(r.get('owner_org') != org for r in records):
            raise ValueError('Government API did not return records exclusively for the selected department.')
        today = datetime.now(ZoneInfo('America/Toronto')).date()
        start = date(today.year - 5, 1, 1)
        eligible = []
        for record in records:
            try:
                recorded_date = date.fromisoformat(str(record.get('contract_date', ''))[:10])
                if start <= recorded_date <= today and reported_value(record.get('contract_value')) > 10000:
                    eligible.append(record)
            except ValueError:
                pass
        report.update({'apiVerified': True, 'retrievedRawDepartmentRecords': len(records), 'eligibleInRetrievedSample': len(eligible), 'totalDepartmentRecordsAllDatesAndValues': data['result']['total'], 'returnedReference': records[0].get('reference_number'), 'scope': {'start': start.isoformat(), 'end': today.isoformat()}, 'sqlActionSupported': False})
        with urlopen(Request(url + '&callback=federalVerification'), timeout=45) as response:
            callback_body = response.read().decode('utf-8')
        report['browserJSONP'] = callback_body.lstrip().startswith('federalVerification(')
        if not report['browserJSONP']:
            report['errors'].append('API did not return the requested JSONP callback; browser CORS restrictions may apply.')
    except Exception as error:
        report['errors'].append('Live API: ' + str(error))
        if isinstance(error, HTTPError):
            report['apiErrorBody'] = error.read(4000).decode('utf-8', errors='replace')
    try:
        disclosure_url = 'https://search.open.canada.ca/contracts/record/' + quote(org, safe='') + ',' + quote(source['reference_number'], safe='')
        with urlopen(Request(disclosure_url, headers={'User-Agent': 'FederalAccountResearch/1.0'}), timeout=45) as response:
            page = response.read().decode('utf-8')
            report['sourceHTTPStatus'] = response.status
        if 'Request Rejected' in page or source['reference_number'] not in page:
            raise ValueError('Disclosure page did not contain the matching reference.')
        report['sourceLinkVerified'] = True
        report['sourceURL'] = disclosure_url
    except Exception as error:
        report['errors'].append('Disclosure link: ' + str(error))
else:
    report['errors'].append('No real snapshot record available to verify.')
(ROOT / 'government-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))

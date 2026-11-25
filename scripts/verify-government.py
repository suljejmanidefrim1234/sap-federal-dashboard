#!/usr/bin/env python3
"""Record an actual department API/source-link probe; never substitute test rows."""
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
snapshot = json.loads((ROOT / 'src/data/snapshot.json').read_text())
resource_id = snapshot['resourceId']
report = {'verifiedAt': datetime.now(timezone.utc).isoformat(), 'apiVerified': False, 'sourceLinkVerified': False, 'browserCORS': 'Unknown', 'errors': []}
try:
    source = next(r for r in snapshot['records'] if r['owner_org'] == 'hc-sc')
except StopIteration:
    source = snapshot['records'][0] if snapshot['records'] else None
if source:
    org = source['owner_org']
    report['department'] = org
    conditions = '"owner_org" = \'' + org.replace("'", "''") + '\' AND "contract_date" >= \'' + snapshot['startDate'] + '\' AND "contract_date" <= \'' + snapshot['asOf'] + '\' AND "contract_value" > 10000'
    base = 'https://open.canada.ca/data/api/3/action/datastore_search_sql?'
    try:
        query = 'SELECT * FROM "' + resource_id + '" WHERE ' + conditions + ' ORDER BY "contract_date" DESC, "_id" DESC LIMIT 1 OFFSET 0'
        with urlopen(Request(base + urlencode({'sql': query}), headers={'Accept': 'application/json'}), timeout=45) as response:
            raw = response.read()
            report['browserCORS'] = response.headers.get('Access-Control-Allow-Origin', 'Not provided')
        data = json.loads(raw)
        if not data.get('success') or not data.get('result', {}).get('records'):
            raise ValueError('Department query did not return an eligible record: ' + str(data.get('error', 'unknown')))
        records = data['result']['records']
        if records[0].get('owner_org') != org:
            raise ValueError('API returned a record for a different department.')
        count_query = 'SELECT COUNT(*) AS matching_count FROM "' + resource_id + '" WHERE ' + conditions
        with urlopen(Request(base + urlencode({'sql': count_query}), headers={'Accept': 'application/json'}), timeout=45) as response:
            count = json.load(response)
        if not count.get('success'):
            raise ValueError('Department count query failed.')
        report['matchingCount'] = int(count['result']['records'][0]['matching_count'])
        report['returnedReference'] = records[0].get('reference_number')
        report['apiVerified'] = True
    except Exception as error:
        report['errors'].append('Live API: ' + str(error))
    try:
        url = 'https://search.open.canada.ca/contracts/record/' + quote(org, safe='') + ',' + quote(source['reference_number'], safe='')
        with urlopen(Request(url, headers={'User-Agent': 'FederalAccountResearch/1.0'}), timeout=45) as response:
            page = response.read().decode('utf-8')
            report['sourceHTTPStatus'] = response.status
        if 'Request Rejected' in page or source['reference_number'] not in page:
            raise ValueError('Disclosure page did not contain the matching reference.')
        report['sourceLinkVerified'] = True
        report['sourceURL'] = url
    except Exception as error:
        report['errors'].append('Disclosure link: ' + str(error))
else:
    report['errors'].append('No real snapshot record available to verify.')
(ROOT / 'government-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))

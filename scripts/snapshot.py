#!/usr/bin/env python3
"""Build a scoped tracked-supplier snapshot from the actual government CSV."""
import argparse
import csv
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
RESOURCE_ID = 'fac950c0-00d5-4ec1-a4d3-9cbebf98a305'
SOURCE_URL = 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/' + RESOURCE_ID
CATALOGUE = json.loads((ROOT / 'src/data/catalogue.json').read_text())
FIELDS = ['reference_number', 'procurement_id', 'vendor_name', 'contract_date', 'description_en', 'description_fr', 'contract_period_start', 'delivery_date', 'contract_value', 'original_value', 'amendment_value', 'comments_en', 'comments_fr', 'additional_comments_en', 'additional_comments_fr', 'standing_offer_number', 'instrument_type', 'reporting_period', 'owner_org', 'owner_org_title']

def normalized(value):
    return re.sub('[^A-Z0-9]+', ' ', ''.join(c for c in unicodedata.normalize('NFKD', str(value or '')) if not unicodedata.combining(c)).upper()).strip()

ALIASES = [' ' + normalized(a) + ' ' for s in CATALOGUE['suppliers'] for a in s['aliases']]

def tracked(name):
    text = ' ' + normalized(name) + ' '
    return any(alias in text for alias in ALIASES)

def reported_value(value):
    try:
        amount = Decimal(re.sub(r'[$,\s]', '', str(value or '')))
        return amount if amount.is_finite() else Decimal(0)
    except InvalidOperation:
        return Decimal(0)

def build_snapshot(path, as_of, complete=False):
    end = date.fromisoformat(as_of)
    start = date(end.year - 5, 1, 1)
    records, departments = [], {}
    scanned = eligible = invalid_dates = 0
    with open(path, encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        required = {'reference_number', 'owner_org', 'vendor_name', 'contract_date', 'contract_value'}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError('Download is not the specified government contracts CSV (required headers missing; an HTML rejection page is not data).')
        for row in reader:
            scanned += 1
            try:
                contract_date = date.fromisoformat((row.get('contract_date') or '')[:10])
            except ValueError:
                invalid_dates += 1
                continue
            if not start <= contract_date <= end or reported_value(row.get('contract_value')) <= 10000:
                continue
            eligible += 1
            code = row.get('owner_org', '').strip()
            if not code:
                raise ValueError('An eligible record is missing its department; cannot establish department coverage.')
            departments[code] = {'code': code, 'name': (row.get('owner_org_title') or code).split(' | ')[0]}
            if tracked(row.get('vendor_name')):
                records.append({field: row.get(field, '') or '' for field in FIELDS})
    if scanned == 0:
        raise ValueError('Government CSV was empty. Refusing to report a complete snapshot.')
    with open(path, 'rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    return {'resourceId': RESOURCE_ID, 'sourceUrl': SOURCE_URL, 'status': 'ready', 'asOf': as_of,
            'startDate': start.isoformat(), 'refreshedAt': datetime.now(timezone.utc).isoformat(),
            'complete': complete, 'directoryComplete': complete, 'scannedRows': scanned,
            'eligibleRows': eligible, 'invalidDateRows': invalid_dates,
            'trackedDisclosureRows': len(records), 'sourceSHA256': digest,
            'departments': sorted(departments.values(), key=lambda d: d['name']), 'records': records,
            'message': 'Snapshot of the tracked supplier subset. Not confirmed spending or product usage.'}

def government_download(destination):
    # Read the resource URL from government metadata rather than inventing a download path.
    metadata_url = 'https://open.canada.ca/data/api/3/action/package_show?id=d8f85d91-7dec-4fd1-8055-483b77225d8b'
    request = Request(metadata_url, headers={'Accept': 'application/json', 'User-Agent': 'FederalAccountResearch/1.0'})
    with urlopen(request, timeout=45) as response:
        raw = response.read()
    if not raw.lstrip().startswith(b'{'):
        raise ValueError('Government metadata endpoint returned Request Rejected or other non-JSON content.')
    metadata = json.loads(raw)
    if not metadata.get('success'):
        raise ValueError('Government metadata lookup failed.')
    resource = next((r for r in metadata['result']['resources'] if r['id'] == RESOURCE_ID), None)
    if not resource or not resource.get('url'):
        raise ValueError('Specified government resource not found.')
    url = resource['url']
    if not url.startswith('https://'):
        raise ValueError('Government resource did not provide an HTTPS download URL.')
    with urlopen(Request(url, headers={'User-Agent': 'FederalAccountResearch/1.0'}), timeout=180) as response, open(destination, 'wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    return url

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--download', action='store_true', help='Download the full specified government resource')
    source.add_argument('--csv', type=Path, help='Import an existing government resource CSV')
    parser.add_argument('--complete', action='store_true', help='Declare a local CSV to be the full resource; omit for extracts')
    parser.add_argument('--as-of', default=datetime.now(ZoneInfo('America/Toronto')).date().isoformat())
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/snapshot.json')
    args = parser.parse_args()
    try:
        download_url = None
        with tempfile.TemporaryDirectory(prefix='federal-contracts-') as temp:
            path = args.csv or Path(temp) / 'contracts.csv'
            if args.download:
                download_url = government_download(path)
            snapshot = build_snapshot(path, args.as_of, args.download or args.complete)
        if download_url:
            snapshot['downloadUrl'] = download_url
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
        print('Snapshot ready: ' + str(len(snapshot['records'])) + ' tracked disclosures from ' + str(snapshot['scannedRows']) + ' CSV rows.')
    except Exception as error:
        # Preserve real earlier data if refresh fails; never substitute example contracts.
        existing = json.loads(args.output.read_text()) if args.output.exists() else {'resourceId': RESOURCE_ID, 'status': 'unavailable', 'asOf': args.as_of, 'refreshedAt': None, 'complete': False, 'directoryComplete': False, 'departments': [], 'records': []}
        existing['lastAttemptAt'] = datetime.now(timezone.utc).isoformat()
        existing['lastRefreshError'] = str(error)
        if existing['status'] != 'ready':
            existing['message'] = 'Government data collection failed: ' + str(error) + ' No real contract records are included.'
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(existing, ensure_ascii=False, indent=2))
        print('Snapshot collection failed: ' + str(error))
        raise SystemExit(1)

if __name__ == '__main__':
    main()

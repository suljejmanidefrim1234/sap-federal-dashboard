#!/usr/bin/env python3
"""Cross-reference disclosures with CanadaBuys awards/history/tenders."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from datetime import date, datetime, timedelta, timezone
import gzip
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import tempfile
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen

from snapshot import ROOT, reported_value, normalized
from rfp_evidence import extract_evidence, purchase_types

SOURCES = [
    ('awards-current', 'https://canadabuys.canada.ca/opendata/pub/awardNoticeComplete-avisAttributionComplet.csv', 'Award'),
    ('awards-legacy', 'https://canadabuys.canada.ca/opendata/pub/2012-2022-awardNoticeHistorical-avisAttributionHistorique.csv', 'Award'),
    ('contracts-current', 'https://canadabuys.canada.ca/opendata/pub/contractHistoryComplete-contratsOctroyesComplet.csv', 'Contract history'),
    ('contracts-legacy', 'https://canadabuys.canada.ca/opendata/pub/2009-2023-contractHistoryHistorical-contratsOctroyesHistorique.csv', 'Contract history'),
    ('tenders-current', 'https://canadabuys.canada.ca/opendata/pub/tenderNoticeComplete-avisAppelOffresComplet.csv', 'Tender'),
    ('tenders-legacy', 'https://canadabuys.canada.ca/opendata/pub/2009-2022-tenderNoticeHistorical-AvisAppelOffresHistorique.csv', 'Tender'),
]
CATALOGUE = json.loads((ROOT / 'src/data/catalogue.json').read_text())
ALIAS_MAP = {normalized(a): s['name'] for s in CATALOGUE['suppliers'] for a in s['aliases']}
ALIAS_PATTERN = re.compile(r'\b(' + '|'.join(re.escape(a) for a in sorted(ALIAS_MAP, key=len, reverse=True)) + r')\b')
GROUPS = {s['name']: s['group'] for s in CATALOGUE['suppliers']}
DEPARTMENT_ALIASES = {
    'pwgsc-tpsgc': ['Public Works and Government Services', 'Public Services and Procurement Canada', 'PSPC'],
    'ssc-spc': ['Shared Services Canada', 'SSC'], 'dnd-mdn': ['National Defence', 'DND'],
    'ised-isde': ['Department of Industry', 'Industry Canada', 'ISED'],
    'infc': ['Infrastructure Canada', 'Office of Infrastructure of Canada', 'Housing Infrastructure and Communities', 'HICC'],
    'esdc-edsc': ['Employment and Social Development Canada', 'ESDC', 'Human Resources and Skills Development'],
    'hc-sc': ['Health Canada'], 'cra-arc': ['Canada Revenue Agency', 'CRA'],
    'ec': ['Environment and Climate Change', 'Environment Canada', 'ECCC'],
    'cic': ['Immigration Refugees and Citizenship', 'Citizenship and Immigration', 'IRCC'],
    'dfatd-maecd': ['Global Affairs Canada', 'Foreign Affairs Trade and Development'],
    'tbs-sct': ['Treasury Board of Canada', 'Treasury Board Secretariat'],
}
FINGERPRINT_FIELDS = ['owner_org', 'vendor_name', 'procurement_id', 'contract_date', 'contract_value', 'original_value']

def identifier(value):
    return re.sub('[^A-Z0-9]', '', str(value or '').upper())

def usable(value):
    value = identifier(value)
    return len(value) >= 6 and value not in {'UNKNOWN', 'NOTAPPLICABLE'}

def supplier_family(name):
    names = {ALIAS_MAP[m.group()] for m in ALIAS_PATTERN.finditer(normalized(name))}
    return next(iter(names)) if len(names) == 1 else None

def read_date(value):
    try:
        return date.fromisoformat(str(value or '')[:10])
    except ValueError:
        return None

def field(row, name, language='eng'):
    return row.get(name + '-' + language, '') or row.get(name + '-fra', '') or row.get(name, '') or ''

def safe_url(value):
    p = urlparse(str(value or ''))
    if p.scheme != 'https' or not p.hostname or p.username:
        return None
    return value.replace('/pw-__', '/pw-') if p.hostname == 'canadabuys.canada.ca' else value

def notice_url(reference, kind='tender-notice'):
    if not reference:
        return None
    return 'https://canadabuys.canada.ca/en/tender-opportunities/' + kind + '/' + quote(reference.lower().replace('pw-__', 'pw-'), safe='-')

def canonical_award(row, source):
    reference = row.get('referenceNumber-numeroReference', '')
    supplier = field(row, 'supplierLegalName-nomLegalFournisseur')
    title = field(row, 'title-titre')
    # A supplier appended to the title is not a product mention.
    for separator in [' - ', ' – ']:
        if separator in title and normalized(title.rsplit(separator, 1)[-1]) == normalized(supplier):
            title = title.rsplit(separator, 1)[0]
            break
    return {'reference': reference, 'contractNumber': row.get('contractNumber-numeroContrat', ''),
            'solicitationNumber': row.get('solicitationNumber-numeroSollicitation', ''),
            'procurementNumber': row.get('procurementNumber-numeroApprovisionnement', ''),
            'supplier': supplier, 'family': supplier_family(supplier), 'title': title,
            'awardDate': row.get('contractAwardDate-dateAttributionContrat', '')[:10],
            'publishedDate': row.get('publicationDate-datePublication', '')[:10],
            'value': str(reported_value(row.get('totalContractValue-valeurTotaleContrat') or row.get('contractAmount-montantContrat'))),
            'currency': row.get('contractCurrency-contratMonnaie', ''),
            'buyer': field(row, 'contractingEntityName-nomEntitContractante'),
            'endUser': field(row, 'endUserEntitiesName-nomEntitesUtilisateurFinal'),
            'instrument': field(row, 'instrumentType-typeInstrument'),
            'description': field(row, 'awardDescription-descriptionAttribution') or field(row, 'tenderDescription-descriptionAppelOffres'),
            'sourceKind': source[2], 'sourceFile': source[1],
            'sourceUrl': (notice_url(reference, 'award-notice') or 'https://open.canada.ca/data/en/dataset/a1acb126-9ce8-40a9-b889-5da2b1dd20cb') if source[2] == 'Award' else 'https://open.canada.ca/data/en/dataset/4fe645a1-ffcd-40c1-9385-2c771be956a4'}

def department_match(disclosure, award):
    names = disclosure.get('owner_org_title', '').split(' | ') + DEPARTMENT_ALIASES.get(disclosure['owner_org'], [])
    entities = ' ' + normalized(award.get('buyer', '') + ' ' + award.get('endUser', '')) + ' '
    return any(n and ' ' + normalized(n) + ' ' in entities for n in names)

def central_buyer(award):
    buyer = normalized(award.get('buyer'))
    return any(x in buyer for x in ['PUBLIC WORKS AND GOVERNMENT SERVICES', 'PUBLIC SERVICES AND PROCUREMENT CANADA', 'SHARED SERVICES CANADA'])

def matching_edge(disclosure, award, relation):
    family = supplier_family(disclosure.get('vendor_name'))
    if not family or family != award['family']:
        return None
    dept = department_match(disclosure, award)
    if not dept and not (relation != 'Possible' and central_buyer(award)):
        return None
    flags = []
    if not dept:
        flags.append('End-user department not aligned or not reported; verify the beneficiary.')
    d, a = read_date(disclosure.get('contract_date')), read_date(award['awardDate'])
    gap = abs((d-a).days) if d and a else None
    if gap is not None and gap > 30:
        flags.append('Award and disclosure dates differ; an original award, amendment or reused identifier may be involved.')
    vehicle = relation == 'Vehicle' or disclosure.get('instrument_type') == 'SOSA' or bool(re.match(r'Standing offer|Supply arrangement', award['instrument'], re.I))
    if relation == 'Possible':
        if award.get('currency') and award['currency'] != 'CAD':
            return None
        if not dept or gap is None or gap > 14:
            return None
        values = [reported_value(disclosure.get(k)) for k in ['contract_value', 'original_value']]
        value = reported_value(award['value'])
        if not value or not any(v > 0 and abs(v-value) <= max(v * reported_value('0.01'), reported_value('50')) for v in values):
            return None
        label, rank = 'Possible match: supplier + department + date + value', 1
        flags.append('No exact contract/solicitation identifier match. Only explicit product names in award/history titles can supply tentative solution signals; verify the relation.')
    elif vehicle:
        label, rank = 'Shared vehicle / arrangement only', 0
        flags.append('Vehicle coverage does not identify products purchased on a call-off or task authorization.')
    elif relation == 'Contract' and dept:
        label, rank = 'Contract ID + supplier + department', 4
    elif relation == 'Contract':
        label, rank = 'Contract ID + supplier; department needs verification', 3
    else:
        label, rank = 'Solicitation ID + supplier; verify individual award', 2
    title_evidence = extract_evidence(award['title'], 'Award title' if award['sourceKind'] == 'Award' else 'Contract history title', award['sourceUrl']) if relation == 'Possible' else []
    return {'confidence': label, 'rank': rank, 'relation': relation, 'allowAreas': (rank >= 2 or any(e['product'] and e['area'] for e in title_evidence)) and not vehicle,
            'flags': flags, 'dateDifferenceDays': gap, 'vehicleOnly': vehicle}

def download(source, directory):
    destination = directory / (source[0] + '.csv')
    request = Request(source[1], headers={'User-Agent': 'FederalAccountResearch/1.1', 'Accept-Encoding': 'identity'})
    with urlopen(request, timeout=180) as response, destination.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    with destination.open('rb') as stream:
        magic = stream.read(2)
    if magic == b'\x1f\x8b':
        raw = destination.with_suffix('.gz')
        destination.rename(raw)
        with gzip.open(raw, 'rb') as input_stream, destination.open('wb') as output:
            while chunk := input_stream.read(1024 * 1024):
                output.write(chunk)
        raw.unlink()
    return destination

def rows(path):
    csv.field_size_limit(16 * 1024 * 1024)
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or 'referenceNumber-numeroReference' not in reader.fieldnames:
            raise ValueError('Not a CanadaBuys CSV: ' + path.name)
        yield from reader

class PageLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.href, self.text = [], None, []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href, self.text = dict(attrs).get('href'), []
    def handle_data(self, data):
        if self.href:
            self.text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.href:
            self.links.append((self.href, ' '.join(self.text).strip()))
            self.href = None

def government_host(url):
    host = urlparse(url).hostname or ''
    return host.endswith('.canada.ca') or host.endswith('.gc.ca') or host == 'canadabuys.canada.ca'

def inspect_tender(tender):
    url = tender['url']
    portal_url = None
    evidence, documents = [], []
    if not government_host(url):
        portal_url = url
        url = notice_url(tender['reference'])
        if not url:
            return {'linkStatus': 'External notice; availability not checked', 'documents': [], 'extraEvidence': []}
    try:
        with urlopen(Request(url, headers={'User-Agent': 'FederalAccountResearch/1.1'}), timeout=20) as response:
            if not government_host(response.url):
                raise ValueError('Notice redirected outside government hosts.')
            raw = response.read(3 * 1024 * 1024)
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        text = raw.decode('utf-8', errors='replace')
        expected = identifier(tender['reference'] or tender['number'])
        if 'Request Rejected' in text or not expected or expected not in identifier(text):
            raise ValueError('Page does not contain the expected notice reference.')
        parser = PageLinks()
        parser.feed(text)
        pdfs = [(urljoin(url, href), name) for href, name in parser.links if '.pdf' in href.lower() and government_host(urljoin(url, href))]
        for pdf_url, name in list(dict.fromkeys(pdfs))[:2]:
            item = {'url': pdf_url, 'name': name or 'RFP attachment', 'status': 'Not extracted'}
            try:
                from pypdf import PdfReader
                with urlopen(Request(pdf_url), timeout=20) as response:
                    if not government_host(response.url):
                        raise ValueError('Attachment redirected outside government hosts.')
                    content = response.read(20 * 1024 * 1024 + 1)
                if len(content) > 20 * 1024 * 1024 or not content.startswith(b'%PDF'):
                    raise ValueError('Attachment is not a public PDF within the size limit.')
                reader = PdfReader(io.BytesIO(content))
                extracted = False
                for number, page in enumerate(reader.pages[:40], 1):
                    page_text = page.extract_text() or ''
                    extracted = extracted or bool(page_text.strip())
                    evidence.extend(extract_evidence(page_text, 'RFP attachment', pdf_url + '#page=' + str(number), number))
                item['status'] = 'Text extracted (first 40 pages maximum)' if extracted else 'No extractable text; needs manual review'
            except Exception as error:
                item['status'] = 'Needs manual review: ' + str(error)[:140]
            documents.append(item)
        return {'url': url, 'portalUrl': portal_url, 'linkStatus': 'Verified notice reference', 'documents': documents, 'extraEvidence': evidence}
    except Exception as error:
        return {'linkStatus': 'Availability needs verification: ' + str(error)[:140], 'documents': [], 'extraEvidence': []}

def tender_fingerprint(tender):
    fields = ['reference','number','title','noticeType','publishedDate','closingDate','amendmentDate','description']
    return hashlib.sha256(json.dumps({k: tender.get(k, '') for k in fields}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def build(snapshot, directory, documents=False, page_limit=150, previous=None):
    disclosures = snapshot['records']
    by_contract, by_vehicle, by_day = {}, {}, {}
    for i, d in enumerate(disclosures):
        if usable(d.get('procurement_id')):
            by_contract.setdefault(identifier(d['procurement_id']), set()).add(i)
        if usable(d.get('standing_offer_number')):
            by_vehicle.setdefault(identifier(d['standing_offer_number']), set()).add(i)
        day = read_date(d.get('contract_date'))
        family = supplier_family(d.get('vendor_name'))
        if day and GROUPS.get(family) in {'SAP', 'COMPETITORS'}:
            for delta in range(-14, 15):
                by_day.setdefault((family, day + timedelta(days=delta)), set()).add(i)
    candidates, edges, stats = {}, {}, []
    for source in SOURCES[:4]:
        path = directory / (source[0] + '.csv')
        count = 0
        for row in rows(path):
            count += 1
            ids = {'Contract': identifier(row.get('contractNumber-numeroContrat')), 'Solicitation': identifier(row.get('solicitationNumber-numeroSollicitation'))}
            prospective = []
            for relation, value in ids.items():
                prospective.extend((i, relation) for i in by_contract.get(value, []))
                prospective.extend((i, 'Vehicle') for i in by_vehicle.get(value, []))
            day = read_date(row.get('contractAwardDate-dateAttributionContrat'))
            family = None
            if not prospective and day:
                family = supplier_family(field(row, 'supplierLegalName-nomLegalFournisseur'))
                prospective.extend((i, 'Possible') for i in by_day.get((family, day), []))
            if not prospective:
                continue
            award = canonical_award(row, source)
            if not award['family'] or (day and day.isoformat() > snapshot['asOf']):
                continue
            key = identifier(award['contractNumber']) + '|' + identifier(award['solicitationNumber']) + '|' + award['family']
            key = key if identifier(award['contractNumber']) else key + '|' + identifier(award['reference'])
            link_id = hashlib.sha256(key.encode()).hexdigest()[:20]
            old_candidate = candidates.get(link_id)
            if not old_candidate or (award['sourceKind'] == 'Award' and old_candidate['sourceKind'] != 'Award') or (award['sourceKind'] == old_candidate['sourceKind'] and award['publishedDate'] > old_candidate['publishedDate']):
                candidates[link_id] = award
            for i, relation in prospective:
                edge = matching_edge(disclosures[i], award, relation)
                if edge:
                    record_id = disclosures[i]['owner_org'] + ':' + disclosures[i]['reference_number']
                    existing = edges.setdefault(record_id, {}).get(link_id)
                    if not existing or edge['rank'] > existing['rank']:
                        edges[record_id][link_id] = {**edge, 'linkId': link_id}
        stats.append({'name': source[0], 'url': source[1], 'rowsScanned': count})
    # Limit ambiguous candidates per disclosure, not the number of RFP sources scanned.
    edges = {rid: sorted(values.values(), key=lambda e: (-e['rank'], e['dateDifferenceDays'] or 0))[:5] for rid, values in edges.items()}
    used = {e['linkId'] for values in edges.values() for e in values}
    links = {key: {**candidates[key], 'tenders': [], 'evidence': []} for key in used}
    solicitation_links = {}
    for key, link in links.items():
        value = identifier(link['solicitationNumber'] or link['procurementNumber'])
        if value:
            solicitation_links.setdefault(value, []).append(key)
        title_kind = 'Award title' if link['sourceKind'] == 'Award' else 'Contract history title'
        link['evidence'] = extract_evidence(link['title'], title_kind, link['sourceUrl']) + extract_evidence(link['description'], 'Award description' if link['sourceKind'] == 'Award' else 'Contract history description', link['sourceUrl'])
        link['purchaseTypes'] = purchase_types(link['title'] + ' ' + link['description'])
    tender_maps = {key: {} for key in links}
    for source in SOURCES[4:]:
        count = 0
        for row in rows(directory / (source[0] + '.csv')):
            count += 1
            published = read_date(row.get('publicationDate-datePublication'))
            if published and published.isoformat() > snapshot['asOf']:
                continue
            number = row.get('solicitationNumber-numeroSollicitation', '')
            normalized_number = identifier(number)
            target = list(solicitation_links.get(normalized_number, []))
            # A disclosure may itself carry the solicitation ID even when no separate award notice is published.
            tender_buyer = {'buyer': field(row, 'contractingEntityName-nomEntitContractante'), 'endUser': field(row, 'endUserEntitiesName-nomEntitesUtilisateurFinal')}
            for i in by_contract.get(normalized_number, []):
                d = disclosures[i]
                rid = d['owner_org'] + ':' + d['reference_number']
                if not department_match(d, tender_buyer) or any(identifier(links[e['linkId']]['solicitationNumber']) == normalized_number for e in edges.get(rid, [])):
                    continue
                key = hashlib.sha256(('disclosure|' + d['owner_org'] + '|' + normalized_number + '|' + d['vendor_name']).encode()).hexdigest()[:20]
                if key not in links:
                    source_url = 'https://search.open.canada.ca/contracts/record/' + quote(d['owner_org'], safe='') + ',' + quote(d['reference_number'], safe='')
                    links[key] = {'reference': d['reference_number'], 'contractNumber': d['procurement_id'], 'solicitationNumber': number, 'procurementNumber': number, 'supplier': d['vendor_name'], 'family': supplier_family(d['vendor_name']), 'title': d.get('description_en') or 'Reported contract', 'awardDate': d['contract_date'], 'publishedDate': d['contract_date'], 'value': d['contract_value'], 'buyer': tender_buyer['buyer'], 'endUser': tender_buyer['endUser'], 'instrument': d.get('instrument_type', ''), 'sourceKind': 'Contract disclosure', 'sourceUrl': source_url, 'description': '', 'purchaseTypes': purchase_types(d.get('description_en', '')), 'tenders': [], 'evidence': []}
                    tender_maps[key] = {}
                    solicitation_links.setdefault(normalized_number, []).append(key)
                vehicle = d.get('instrument_type') == 'SOSA'
                edges.setdefault(rid, []).append({'linkId': key, 'confidence': 'Disclosure solicitation ID + tender department; award notice not linked', 'rank': 2, 'relation': 'Solicitation', 'allowAreas': not vehicle, 'vehicleOnly': vehicle, 'dateDifferenceDays': None, 'flags': ['Winning-product line items are not verified from a separate award record.']})
                target.append(key)
            if not target:
                continue
            reference = row.get('referenceNumber-numeroReference', '')
            url = safe_url(row.get('noticeURL-URLavis-eng')) or notice_url(reference)
            if not url:
                continue
            tender = {'reference': reference, 'number': number, 'title': field(row, 'title-titre'), 'url': url,
                      'noticeType': field(row, 'noticeType-avisType'), 'publishedDate': row.get('publicationDate-datePublication', '')[:10],
                      'closingDate': row.get('tenderClosingDate-appelOffresDateCloture', '')[:10],
                      'amendmentDate': row.get('amendmentDate-dateModification', '')[:10],
                      'linkStatus': 'URL from government notice data; availability not checked', 'documents': [],
                      'description': field(row, 'tenderDescription-descriptionAppelOffres')}
            tender['sourceFingerprint'] = tender_fingerprint(tender)
            for key in target:
                old = tender_maps[key].get(url)
                if not old or tender['publishedDate'] > old['publishedDate']:
                    tender_maps[key][url] = tender
        stats.append({'name': source[0], 'url': source[1], 'rowsScanned': count})
    unique_tenders = {}
    for key, link in links.items():
        tenders = list(tender_maps[key].values())
        original = [t for t in tenders if not link['awardDate'] or not t['publishedDate'] or t['publishedDate'] <= link['awardDate']]
        selected = sorted(original or tenders, key=lambda t: t['publishedDate'], reverse=True)[:5]
        for tender in selected:
            unique_tenders[tender['url']] = tender
        link['tenders'] = [dict(t) for t in selected]
    inspected = {}
    prior_tenders, prior_pdf_evidence = {}, {}
    for link in (previous or {}).get('links', {}).values():
        for tender in link.get('tenders', []):
            prior_tenders[tender['url']] = tender
            urls = {d['url'] for d in tender.get('documents', [])}
            for evidence in link.get('evidence', []):
                if evidence['kind'] == 'RFP attachment' and evidence['url'].split('#')[0] in urls:
                    prior_pdf_evidence.setdefault(tender['url'], []).append(evidence)
    if documents and unique_tenders:
        selected = sorted(unique_tenders.values(), key=lambda t: (bool(extract_evidence(t['title'] + ' ' + t['description'], 'RFP title', t['url'])), t['publishedDate']), reverse=True)[:page_limit]
        with ThreadPoolExecutor(max_workers=4) as pool:
            tasks = {pool.submit(inspect_tender, t): t['url'] for t in selected}
            for future in as_completed(tasks):
                inspected[tasks[future]] = future.result()
    for link in links.values():
        for tender in link['tenders']:
            check = inspected.get(tender['url'], {})
            prior = prior_tenders.get(tender['url'])
            cached = []
            if prior and prior.get('sourceFingerprint') == tender['sourceFingerprint']:
                if check.get('linkStatus') != 'Verified notice reference':
                    cached_at = prior.get('verifiedAt') or (previous or {}).get('refreshedAt')
                    check = {**check, 'linkStatus': 'Previously verified notice; latest check unavailable', 'documents': prior.get('documents', []), 'verifiedAt': cached_at, 'cached': True}
                    cached = [{**e, 'cached': True, 'verifiedAt': cached_at} for e in prior_pdf_evidence.get(tender['url'], [])]
                else:
                    failed_urls = {d['url'] for d in check.get('documents', []) if not d['status'].startswith('Text extracted')}
                    cached = [{**e, 'cached': True, 'verifiedAt': prior.get('verifiedAt') or (previous or {}).get('refreshedAt')} for e in prior_pdf_evidence.get(tender['url'], []) if e['url'].split('#')[0] in failed_urls]
            if check.get('linkStatus') == 'Verified notice reference':
                check['verifiedAt'] = datetime.now(timezone.utc).isoformat()
            tender.update({k: v for k, v in check.items() if k != 'extraEvidence'})
            tender_evidence = extract_evidence(tender['title'], 'RFP title', tender['url']) + extract_evidence(tender.pop('description'), 'RFP description', tender['url']) + check.get('extraEvidence', []) + cached
            if re.search(r'Supply Arrangement|Standing Offer', tender['noticeType'], re.I):
                tender_evidence = [{**e, 'vehicleScope': True, 'basis': 'Vehicle scope; individual purchase not identified'} for e in tender_evidence]
            link['evidence'].extend(tender_evidence)
        link.pop('description', None)
        # Quotes are bounded; never embed entire RFPs in the application bundle.
        unique = {}
        for evidence in link['evidence']:
            unique.setdefault((evidence['area'], evidence['product'], evidence['basis'], evidence['url']), evidence)
        link['evidence'] = list(unique.values())[:24]
    by_id = {d['owner_org'] + ':' + d['reference_number']: d for d in disclosures}
    fingerprints = {rid: {k: by_id[rid].get(k, '') for k in FINGERPRINT_FIELDS} for rid in edges}
    linked = sum(bool(links[e['linkId']]['tenders']) for values in edges.values() for e in values)
    final_tenders = {t['url']: t for link in links.values() for t in link['tenders']}
    cached_notices = sum(bool(t.get('cached')) for t in final_tenders.values())
    return {'status': 'ready', 'refreshedAt': datetime.now(timezone.utc).isoformat(), 'snapshotRefreshedAt': snapshot['refreshedAt'],
            'sources': stats, 'links': links, 'disclosures': edges, 'inputFields': fingerprints,
            'summary': {'matchedDisclosures': len(edges), 'awardHistoryMatches': sum(l['sourceKind'] in {'Award', 'Contract history'} for l in links.values()), 'directDisclosureTenderLinks': sum(l['sourceKind'] == 'Contract disclosure' for l in links.values()), 'matchesWithTenderLinks': linked,
                        'uniqueTenderLinks': len(unique_tenders), 'noticePagesInspected': len(inspected),
                        'verifiedNoticeLinks': sum(t.get('linkStatus') in {'Verified notice reference','Previously verified notice; latest check unavailable'} for t in final_tenders.values()),
                        'cachedNoticeLinks': cached_notices,
                        'publicPDFsExtracted': sum(d['status'].startswith('Text extracted') for v in inspected.values() for d in v['documents'])},
            'warning': 'Some notice checks were unavailable. Earlier verified PDF evidence is retained only when notice metadata is unchanged, and is labelled as cached.' if cached_notices else None,
            'limitations': 'Exact identifiers plus supplier and department are preferred. Shared vehicles never populate solution areas. Date/value-only candidates contribute only explicit product names from award/history titles as tentative signals. RFP requirements, alternatives, skills and existing-environment references are not proof of a product purchase. CSV archives are scanned in full; notice/PDF inspection is bounded and no OCR is performed.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--source-dir', type=Path)
    parser.add_argument('--documents', action='store_true')
    parser.add_argument('--page-limit', type=int, default=150)
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'src/data/snapshot.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'src/data/rfp-links.json')
    args = parser.parse_args()
    try:
        snapshot = json.loads(args.snapshot.read_text())
        with tempfile.TemporaryDirectory(prefix='federal-rfp-') as temp:
            directory = args.source_dir or Path(temp)
            if args.download:
                directory.mkdir(parents=True, exist_ok=True)
                with ThreadPoolExecutor(max_workers=3) as pool:
                    tasks = [pool.submit(download, source, directory) for source in SOURCES]
                    for task in tasks:
                        task.result()
            if not args.source_dir and not args.download:
                raise ValueError('Specify --download or --source-dir.')
            previous = json.loads(args.output.read_text()) if args.output.exists() else None
            result = build(snapshot, directory, args.documents, max(0, args.page_limit), previous)
            if any(source['rowsScanned'] == 0 for source in result['sources']):
                raise ValueError('A CanadaBuys archive was empty; refusing to replace the earlier enrichment.')
        args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
        print('RFP enrichment ready: ' + json.dumps(result['summary']))
    except Exception as error:
        previous = json.loads(args.output.read_text()) if args.output.exists() else {'status': 'unavailable', 'refreshedAt': None, 'sources': [], 'links': {}, 'disclosures': {}, 'inputFields': {}}
        previous['lastRefreshError'] = str(error)
        previous['lastAttemptAt'] = datetime.now(timezone.utc).isoformat()
        args.output.write_text(json.dumps(previous, ensure_ascii=False, separators=(',', ':')))
        print('RFP enrichment failed; preserving earlier data: ' + str(error))
        raise SystemExit(1)

if __name__ == '__main__':
    main()

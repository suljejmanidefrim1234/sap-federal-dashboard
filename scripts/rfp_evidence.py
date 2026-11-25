"""Extract cited research evidence, never infer installed products or purchases."""
import html
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
SOLUTIONS = json.loads((ROOT / 'src/data/solutions.json').read_text())

def words(value):
    return re.sub('[^A-Z0-9]+', ' ', ''.join(c for c in unicodedata.normalize('NFKD', str(value or '')) if not unicodedata.combining(c)).upper()).strip()

def contains(text, phrase):
    return ' ' + words(phrase) + ' ' in ' ' + words(text) + ' '

def phrase_regex(phrase):
    return re.compile(r'(?<![A-Za-z0-9])' + r'[^A-Za-z0-9]*'.join(re.escape(w) for w in words(phrase).split()) + r'(?![A-Za-z0-9])', re.I)

PRODUCTS = [(p, [phrase_regex(a) for a in p['aliases']]) for p in SOLUTIONS['products']]

def purchase_types(text):
    upper = words(text)
    kinds = []
    if re.search(r'\b(LICENSES?|LICENCES?|LICENSING|SUBSCRIPTIONS?|PERPETUAL)\b', upper):
        kinds.append('Licences / subscriptions')
    if re.search(r'\b(MAINTENANCE|TECHNICAL SUPPORT|SOFTWARE SUPPORT|RENEWAL)\b', upper):
        kinds.append('Maintenance / support')
    if re.search(r'\b(CONSULTING|CONSULTANTS?|PROFESSIONAL SERVICES|IMPLEMENTATION|BUSINESS ANALYST|ADVISORY SERVICES|PROGRAMMER|DEVELOPMENT SERVICES)\b', upper):
        kinds.append('Professional services')
    return kinds or ['Unknown']

def is_submission_boilerplate(text):
    upper = words(text)
    if 'ARIBA' not in upper:
        return False
    bidding = re.search(r'\b(SUBMIT BIDS|SUBMIT PROPOSALS|BID SUBMISSION|BUSINESS ACCOUNT|REGISTER|REGISTRATION|ACTIVATION|ARIBA DISCOVERY|INSCRIPTION|SOUMETTRE|SOUMISSIONNER|SOUMISSIONS|COMPTE)\b', upper)
    purchasing = re.search(r'\b(LICENSES?|LICENCES?|SUBSCRIPTIONS?|IMPLEMENTATION|ARIBA SUPPORT SERVICES|PROCUREMENT PLATFORM|ABONNEMENT|SOUSCRIPTION|MISE EN OEUVRE)\b', upper)
    return bool(bidding and not purchasing)

def basis(text, kind):
    upper = words(text)
    if re.search(r'\b(NOT REQUIRED|NO REQUIREMENT FOR|DOES NOT REQUIRE)\b', upper):
        return 'Excluded / negated reference'
    if re.search(r'\b(OR EQUIVALENT|OR AN EQUIVALENT|OU EQUIVALENT)\b', upper):
        return 'Acceptable alternative in requirements'
    if re.search(r'\b(EXISTING|EXISTANT|EXISTANTE|ACTUEL|DEJA UTILISE|CURRENTLY USING|CURRENTLY USES|CURRENT ENVIRONMENT|MIGRATION FROM|COMPATIBLE WITH|INTEGRATE WITH|INCUMBENT)\b', upper):
        return 'Existing environment reference'
    if re.search(r'\b(EXPERIENCE|CERTIFICATION|CERTIFIED|YEARS OF|HAVE WORKED)\b', upper) and not re.search(r'\b(LICEN[CS]E|SUBSCRIPTION)\b', upper):
        return 'Skills / qualification requirement'
    if re.search(r'\b(OPTIONAL|OPTION TO|MAY PURCHASE|POSSIBLE OPTION)\b', upper):
        return 'Optional scope reference'
    if kind == 'Award title':
        return 'Named in award title'
    if kind == 'Award description':
        return 'Scope described in award notice'
    if kind == 'Contract history title':
        return 'Named in contract history'
    return 'Requested / specified in RFP'

def extract_evidence(text, kind, url, page=None):
    # Public tender descriptions contain HTML and repeated portal instructions.
    cleaned = html.unescape(re.sub(r'<[^>]+>', ' ', str(text or '')))
    segments = [re.sub(r'\s+', ' ', s).strip() for s in re.split(r'\n\s*\n|(?<=[.!?])\s+(?=[A-Z])', cleaned)]
    result = []
    seen = set()
    for segment in segments:
        if not segment or re.search(r'following (suppliers|firms).{0,40}(invited|eligible)|suppliers invited to|bidders list|invited suppliers include|eligible suppliers are|qualified suppliers are', segment, re.I):
            continue
        context = basis(segment, kind)
        if context == 'Excluded / negated reference':
            continue
        ignore_ariba = is_submission_boilerplate(segment)
        areas_with_products = set()
        for product, patterns in PRODUCTS:
            if ignore_ariba and product['name'] == 'SAP Ariba':
                continue
            match = next((m for p in patterns if (m := p.search(segment))), None)
            if not match:
                continue
            key = (product['name'], context, kind)
            if key in seen:
                continue
            seen.add(key)
            quote = segment[max(0, match.start() - 130):match.end() + 230]
            result.append({'area': product['area'], 'product': product['name'], 'productGroup': product['group'],
                           'kind': kind, 'basis': context, 'quote': quote, 'url': url, 'page': page,
                           'purchaseTypes': purchase_types(segment), 'confidence': 'Needs verification'})
            areas_with_products.add(product['area'])
        for area, config in SOLUTIONS['areas'].items():
            if area in areas_with_products or (ignore_ariba and area == 'PROCUREMENT'):
                continue
            keyword = next((k for k in config['keywords'] if contains(segment, k)), None)
            if not keyword or (area, context, kind) in seen:
                continue
            seen.add((area, context, kind))
            location = phrase_regex(keyword).search(segment)
            quote = segment[max(0, location.start() - 130):location.end() + 230] if location else segment[:360]
            result.append({'area': area, 'product': None, 'productGroup': None, 'keyword': keyword,
                           'kind': kind, 'basis': context, 'quote': quote, 'url': url, 'page': page,
                           'purchaseTypes': purchase_types(segment), 'confidence': 'Needs verification'})
    return result

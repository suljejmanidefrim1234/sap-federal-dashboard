import csv
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import rfp
from rfp_evidence import extract_evidence

class RfpTests(unittest.TestCase):
    def disclosure(self, **overrides):
        return {'owner_org':'hc-sc','owner_org_title':'Health Canada','reference_number':'TEST-REF','procurement_id':'CONTRACT-123456','vendor_name':'SAP Canada Inc.','contract_date':'2025-01-15','contract_value':'25000','description_en':'Software licences',**overrides}

    def award(self, **overrides):
        return {'family':'SAP','supplier':'SAP Canada Inc.','title':'SAP Analytics Cloud licences','sourceKind':'Award','sourceUrl':'https://canadabuys.canada.ca/en/tender-opportunities/award-notice/test','buyer':'Health Canada','endUser':'','awardDate':'2025-01-15','value':'25000','instrument':'Contract',**overrides}

    def test_identifier_matches_require_supplier_and_beneficiary_alignment(self):
        match = rfp.matching_edge(self.disclosure(), self.award(), 'Contract')
        self.assertEqual(match['rank'], 4)
        self.assertTrue(match['allowAreas'])
        self.assertIsNone(rfp.matching_edge(self.disclosure(), self.award(family='Microsoft'), 'Contract'))
        self.assertIsNone(rfp.matching_edge(self.disclosure(), self.award(buyer='Department of National Defence'), 'Contract'))

    def test_vehicles_never_populate_solution_fields(self):
        match = rfp.matching_edge(self.disclosure(), self.award(), 'Vehicle')
        self.assertTrue(match['vehicleOnly'])
        self.assertFalse(match['allowAreas'])

    def test_possible_matches_only_allow_explicit_title_products(self):
        match = rfp.matching_edge(self.disclosure(), self.award(), 'Possible')
        self.assertEqual(match['rank'], 1)
        self.assertTrue(match['allowAreas'])
        generic = rfp.matching_edge(self.disclosure(), self.award(title='Software licences'), 'Possible')
        self.assertFalse(generic['allowAreas'])
        self.assertIsNone(rfp.matching_edge(self.disclosure(), self.award(value='30000'), 'Possible'))
        self.assertIsNone(rfp.matching_edge(self.disclosure(), self.award(currency='USD'), 'Possible'))

    def test_ariba_bid_registration_boilerplate_is_not_a_purchase(self):
        text = 'You will need an SAP Ariba business account to view tender opportunities and submit bids electronically on SAP Ariba Discovery.'
        self.assertEqual(extract_evidence(text, 'RFP description', 'https://canadabuys.canada.ca/'), [])
        french = 'Vous devez avoir un compte SAP Ariba pour soumissionner aux appels d’offres.'
        self.assertEqual(extract_evidence(french, 'RFP description', 'https://canadabuys.canada.ca/'), [])
        actual = extract_evidence('Provide SAP Ariba subscription licences and implementation services.', 'RFP description', 'https://canadabuys.canada.ca/')
        self.assertTrue(any(e['product'] == 'SAP Ariba' for e in actual))

    def test_existing_environment_skills_and_alternatives_are_labelled(self):
        existing = extract_evidence('Maintain the existing SAP SuccessFactors environment.', 'RFP description', 'https://canadabuys.canada.ca/')[0]
        self.assertEqual(existing['basis'], 'Existing environment reference')
        skills = extract_evidence('Five years of experience with SAP SuccessFactors is required.', 'RFP description', 'https://canadabuys.canada.ca/')[0]
        self.assertEqual(skills['basis'], 'Skills / qualification requirement')
        equivalent = extract_evidence('SAP Analytics Cloud or equivalent is acceptable.', 'RFP description', 'https://canadabuys.canada.ca/')[0]
        self.assertEqual(equivalent['basis'], 'Acceptable alternative in requirements')
        self.assertTrue(all(e['confidence'] == 'Needs verification' for e in [existing, skills, equivalent]))

    def test_direct_disclosure_solicitation_links_produce_cited_rfp_evidence(self):
        row = self.disclosure(procurement_id='RFP-2024-123456')
        snapshot = {'records':[row],'asOf':'2026-11-24','refreshedAt':'2026-11-24T12:00:00Z'}
        columns = ['referenceNumber-numeroReference','solicitationNumber-numeroSollicitation','publicationDate-datePublication','title-titre-eng','contractingEntityName-nomEntitContractante-eng','tenderDescription-descriptionAppelOffres-eng','noticeURL-URLavis-eng']
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            for source in rfp.SOURCES:
                with (path / (source[0] + '.csv')).open('w', newline='') as file:
                    writer = csv.DictWriter(file, fieldnames=columns)
                    writer.writeheader()
                    if source[0] == 'tenders-current':
                        writer.writerow({'referenceNumber-numeroReference':'cb-test-rfp','solicitationNumber-numeroSollicitation':'RFP-2024-123456','publicationDate-datePublication':'2024-12-01','title-titre-eng':'Payroll implementation','contractingEntityName-nomEntitContractante-eng':'Health Canada','tenderDescription-descriptionAppelOffres-eng':'Implement SAP SuccessFactors payroll.','noticeURL-URLavis-eng':'https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/cb-test-rfp'})
            output = rfp.build(snapshot, path)
        edge = output['disclosures']['hc-sc:TEST-REF'][0]
        self.assertIn('award notice not linked', edge['confidence'])
        linked = output['links'][edge['linkId']]
        self.assertEqual(linked['tenders'][0]['number'], 'RFP-2024-123456')
        self.assertTrue(any(e['area'] == 'HCM' and e['product'] == 'SAP SuccessFactors' for e in linked['evidence']))

if __name__ == '__main__':
    unittest.main()

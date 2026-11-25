import csv
import importlib.util
from pathlib import Path
import tempfile
import unittest
import subprocess
import sys

spec = importlib.util.spec_from_file_location('snapshot', Path(__file__).resolve().parents[1] / 'scripts/snapshot.py')
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)

class SnapshotTests(unittest.TestCase):
    def test_strict_dates_total_values_and_untracked_department_directory(self):
        rows = [
            {'reference_number':'VALID','owner_org':'hc-sc','owner_org_title':'Health Canada','vendor_name':'SAP Canada','contract_date':'2021-01-01','contract_value':'10001'},
            {'reference_number':'END','owner_org':'tbs-sct','vendor_name':'Ernst & Young LLP','contract_date':'2026-11-24','contract_value':'$30,000.50'},
            {'reference_number':'FOOD','owner_org':'vac-acc','vendor_name':'Saputo Dairy','contract_date':'2025-01-01','contract_value':'30000'},
            {'reference_number':'LOW','owner_org':'hc-sc','vendor_name':'SAP','contract_date':'2025-01-01','contract_value':'10000'},
            {'reference_number':'OLD','owner_org':'hc-sc','vendor_name':'SAP','contract_date':'2020-12-31','contract_value':'30000'},
            {'reference_number':'FUTURE','owner_org':'hc-sc','vendor_name':'SAP','contract_date':'2026-11-25','contract_value':'30000'},
            {'reference_number':'BAD','owner_org':'hc-sc','vendor_name':'SAP','contract_date':'2026-02-30','contract_value':'30000'},
        ]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'government.csv'
            with path.open('w', newline='') as out:
                writer = csv.DictWriter(out, fieldnames=list({key for row in rows for key in row}))
                writer.writeheader()
                writer.writerows(rows)
            result = snapshot.build_snapshot(path, '2026-11-24')
        self.assertEqual([r['reference_number'] for r in result['records']], ['VALID','END'])
        self.assertEqual(result['eligibleRows'], 3)
        self.assertEqual(result['invalidDateRows'], 1)
        self.assertEqual(len(result['departments']), 3)
        self.assertFalse(result['complete'])
        self.assertEqual(result['startDate'], '2021-01-01')
        self.assertEqual(len(result['sourceSHA256']), 64)

    def test_html_rejection_cannot_be_reported_as_real_data(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'contracts.csv'
            path.write_text('<html>Request Rejected</html>')
            with self.assertRaisesRegex(ValueError, 'required headers missing'):
                snapshot.build_snapshot(path, '2026-11-24', complete=True)

    def test_supplier_word_boundaries_and_integrator_aliases(self):
        self.assertFalse(snapshot.tracked('Saputo Dairy'))
        self.assertFalse(snapshot.tracked('Information Hardware Inc'))
        self.assertTrue(snapshot.tracked('SAP Canada Inc.'))
        self.assertTrue(snapshot.tracked('Ernst & Young LLP'))
        self.assertTrue(snapshot.tracked('IBM Canada'))

    def test_new_and_changed_disclosures_compare_the_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'government.csv'
            def write(rows):
                with path.open('w', newline='') as output:
                    writer = csv.DictWriter(output, fieldnames=snapshot.FIELDS)
                    writer.writeheader()
                    writer.writerows(rows)
            original = {'reference_number':'EXISTING', 'owner_org':'hc-sc', 'vendor_name':'SAP Canada', 'contract_date':'2021-02-01', 'contract_value':'20000'}
            write([original])
            previous = snapshot.build_snapshot(path, '2026-11-24', complete=True)
            self.assertFalse(previous['changes']['comparisonAvailable'])
            historical_new = {**original, 'reference_number':'NEW-DISCLOSURE', 'procurement_id':'P2'}
            changed = {**original, 'contract_value':'25000', 'instrument_type':'A'}
            write([changed, historical_new])
            current = snapshot.build_snapshot(path, '2026-11-24', complete=True, previous=previous)
            self.assertEqual(current['changes']['newReferences'], ['hc-sc:NEW-DISCLOSURE'])
            self.assertEqual(current['changes']['newDisclosureCount'], 1)
            self.assertEqual(current['changes']['changedDisclosureCount'], 1)
            self.assertEqual(current['changes']['previousRefreshedAt'], previous['refreshedAt'])
            unchanged = snapshot.build_snapshot(path, '2026-11-24', complete=True, previous=current)
            self.assertEqual(unchanged['changes']['newDisclosureCount'], 0)
            self.assertEqual(unchanged['changes']['changedDisclosureCount'], 0)

    def test_failed_refresh_preserves_the_last_successful_data_and_date(self):
        import json
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / 'rejected.csv'
            source.write_text('<html>Request Rejected</html>')
            output = Path(folder) / 'snapshot.json'
            previous = {'resourceId':snapshot.RESOURCE_ID, 'status':'ready', 'refreshedAt':'2026-11-23T12:00:00Z', 'records':[{'reference_number':'PRESERVED'}], 'departments':[]}
            output.write_text(json.dumps(previous))
            result = subprocess.run([sys.executable, str(snapshot.ROOT / 'scripts/snapshot.py'), '--csv', str(source), '--output', str(output), '--as-of', '2026-11-24'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            preserved = json.loads(output.read_text())
            self.assertEqual(preserved['records'], previous['records'])
            self.assertEqual(preserved['refreshedAt'], previous['refreshedAt'])
            self.assertIn('lastAttemptAt', preserved)
            self.assertIn('lastRefreshError', preserved)

if __name__ == '__main__':
    unittest.main()

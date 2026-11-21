import csv
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from import_awin import HEADERS, confirm_target, validate_file


def fixture(**changes):
    row = {key: "" for key in HEADERS}
    row.update({
        "aw_deep_link": "https://www.awin1.com/cread.php?p=123&a=456&m=78586",
        "product_name": "Example dress | Size: 10",
        "aw_product_id": "123",
        "merchant_product_id": "789",
        "merchant_image_url": "https://cdn.shopify.com/example.jpg",
        "description": "Example",
        "merchant_category": "Dresses",
        "search_price": "24.99",
        "merchant_name": "Example merchant",
        "merchant_id": "78586",
        "category_name": "Dresses",
        "category_id": "1",
        "aw_image_url": "https://images2.productserve.com/example.jpg",
        "currency": "GBP",
        "delivery_cost": "3.95",
        "merchant_deep_link": "https://example.com/dress",
        "display_price": "£24.99",
        "data_feed_id": "101189",
    })
    row.update(changes)
    return row


class ImportValidationTests(unittest.TestCase):
    def parse(self, records):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "feed.csv"
            with path.open("w", encoding="utf-8-sig", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=HEADERS)
                writer.writeheader()
                writer.writerows(records)
            return validate_file(path)[:2]

    def test_valid_record_and_blank_optional_fields(self):
        valid, rejected = self.parse([fixture()])
        self.assertEqual((len(valid), len(rejected)), (1, 0))
        self.assertIsNone(valid[0].values["store_price"])
        self.assertIsNone(valid[0].values["feed_last_updated"])
        self.assertEqual(valid[0].values["raw_record"]["product_name"], "Example dress | Size: 10")

    def test_duplicate_source_id_is_rejected(self):
        valid, rejected = self.parse([fixture(), fixture(product_name="Changed title")])
        self.assertEqual((len(valid), len(rejected)), (1, 1))
        self.assertIn("duplicate", rejected[0]["reason"])

    def test_unsafe_affiliate_host_is_rejected(self):
        valid, rejected = self.parse([fixture(aw_deep_link="https://evil.example/cread.php?p=123&a=456&m=78586")])
        self.assertEqual(len(valid), 0)
        self.assertIn("unsafe", rejected[0]["reason"])

    def test_wrong_merchant_in_link_is_rejected(self):
        valid, rejected = self.parse([fixture(aw_deep_link="https://www.awin1.com/cread.php?p=123&a=456&m=9")])
        self.assertEqual(len(valid), 0)
        self.assertIn("merchant", rejected[0]["reason"])

    def test_fractional_penny_is_rejected(self):
        valid, rejected = self.parse([fixture(search_price="24.999")])
        self.assertEqual(len(valid), 0)
        self.assertIn("decimal places", rejected[0]["reason"])

    def test_pooler_uri_with_special_password_character_is_parsed(self):
        config = {
            "NEXT_PUBLIC_SUPABASE_URL": "https://exampleproject.supabase.co",
            "DATABASE_URL": "postgresql://postgres.exampleproject:pass@word@aws-1-region.pooler.supabase.com:6543/postgres?pgbouncer=true",
        }
        connection = confirm_target(config, "exampleproject")
        self.assertEqual(connection["password"], "pass@word")
        self.assertEqual(connection["port"], 6543)

    def test_wrong_project_is_rejected(self):
        config = {
            "NEXT_PUBLIC_SUPABASE_URL": "https://otherproject.supabase.co",
            "DATABASE_URL": "postgresql://postgres.exampleproject:example@aws-1-region.pooler.supabase.com:6543/postgres",
        }
        with self.assertRaisesRegex(ValueError, "project URL"):
            confirm_target(config, "exampleproject")


if __name__ == "__main__":
    unittest.main()

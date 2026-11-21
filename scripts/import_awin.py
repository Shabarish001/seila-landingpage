"""Validate an Awin CSV locally; import only with an explicit --apply flag.

Install psycopg for --apply: python -m pip install -r requirements-awin.txt
No database connection is made during the default dry run.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, parse_qsl, unquote, urlsplit


HEADERS = (
    "aw_deep_link", "product_name", "aw_product_id", "merchant_product_id",
    "merchant_image_url", "description", "merchant_category", "search_price",
    "merchant_name", "merchant_id", "category_name", "category_id",
    "aw_image_url", "currency", "store_price", "delivery_cost",
    "merchant_deep_link", "language", "last_updated", "display_price",
    "data_feed_id",
)
MONEY_COLUMNS = ("search_price", "store_price", "delivery_cost")
DB_COLUMNS = (
    "aw_product_id", "merchant_product_id", "merchant_id", "merchant_name",
    "product_name", "description", "merchant_category", "category_name",
    "category_id", "search_price", "currency", "store_price", "delivery_cost",
    "display_price", "merchant_image_url", "aw_image_url", "aw_deep_link",
    "merchant_deep_link", "language", "feed_last_updated", "data_feed_id",
    "raw_record", "record_sha256", "source_file_sha256", "source_row_number",
)
UPSERT = f"""
INSERT INTO public.affiliate_products ({', '.join(DB_COLUMNS)})
VALUES ({', '.join(['%s'] * len(DB_COLUMNS))})
ON CONFLICT (merchant_id, aw_product_id) DO UPDATE SET
    {', '.join(f'{column} = EXCLUDED.{column}' for column in DB_COLUMNS if column not in ('merchant_id', 'aw_product_id'))},
    active = true,
    updated_at = now()
WHERE public.affiliate_products.record_sha256 IS DISTINCT FROM EXCLUDED.record_sha256
   OR public.affiliate_products.active = false
RETURNING id
"""


@dataclass
class ValidatedRow:
    number: int
    original: dict[str, str]
    values: dict[str, object]


def load_local_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            if line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"\'')
    values.update(os.environ)
    return values


def safe_https(value: str, *, host: str | None = None) -> bool:
    try:
        url = urlsplit(value)
        return (
            url.scheme.lower() == "https"
            and bool(url.hostname)
            and url.port in (None, 443)
            and not url.username
            and not url.password
            and (host is None or url.hostname.lower() == host)
        )
    except ValueError:
        return False


def money(value: str, *, required: bool) -> Decimal | None:
    if not value:
        if required:
            raise ValueError("missing price")
        return None
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError("invalid decimal price") from exc
    if not amount.is_finite() or amount < 0 or amount >= Decimal("10000000000"):
        raise ValueError("price out of range")
    if amount.as_tuple().exponent < -2:
        raise ValueError("price has more than two decimal places")
    return amount


def validate_row(raw: dict[str, str], number: int, file_hash: str) -> ValidatedRow:
    row = {key: value.strip() for key, value in raw.items()}
    for key in ("aw_product_id", "merchant_product_id", "merchant_id", "merchant_name",
                "product_name", "data_feed_id", "currency", "aw_deep_link"):
        if not row[key]:
            raise ValueError(f"missing {key}")
    for key in ("aw_product_id", "merchant_product_id", "merchant_id", "data_feed_id"):
        if not row[key].isdigit():
            raise ValueError(f"invalid {key}")
    if not re.fullmatch(r"[A-Z]{3}", row["currency"]):
        raise ValueError("invalid currency")
    parsed_money = {key: money(row[key], required=(key == "search_price")) for key in MONEY_COLUMNS}
    if not safe_https(row["aw_deep_link"], host="www.awin1.com"):
        raise ValueError("unsafe aw_deep_link")
    query = parse_qs(urlsplit(row["aw_deep_link"]).query)
    if query.get("m") != [row["merchant_id"]] or not query.get("a") or not query.get("p"):
        raise ValueError("affiliate link parameters do not match merchant")
    for key in ("merchant_image_url", "aw_image_url", "merchant_deep_link"):
        if row[key] and not safe_https(row[key]):
            raise ValueError(f"unsafe {key}")
    if not (row["merchant_image_url"] or row["aw_image_url"]):
        raise ValueError("missing product image URL")
    updated = None
    if row["last_updated"]:
        try:
            updated = datetime.fromisoformat(row["last_updated"].replace("Z", "+00:00"))
            if updated.tzinfo is None:
                raise ValueError("last_updated lacks timezone")
        except ValueError as exc:
            raise ValueError("invalid last_updated") from exc
    record_hash = hashlib.sha256(
        json.dumps(raw, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    values: dict[str, object] = {key: row[key] or None for key in DB_COLUMNS if key in row}
    values.update(parsed_money)
    values.update({
        "feed_last_updated": updated,
        "raw_record": raw,
        "record_sha256": record_hash,
        "source_file_sha256": file_hash,
        "source_row_number": number,
    })
    return ValidatedRow(number, raw, values)


def validate_file(path: Path) -> tuple[list[ValidatedRow], list[dict[str, object]], str]:
    file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    valid: list[ValidatedRow] = []
    rejected: list[dict[str, object]] = []
    seen: set[tuple[str, str]] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream, strict=True)
        headers = next(reader, None)
        if headers != list(HEADERS):
            raise ValueError("CSV headers differ from the reviewed 21-column Awin feed")
        for number, fields in enumerate(reader, start=1):
            if len(fields) != len(HEADERS):
                rejected.append({"record": number, "reason": "wrong column count"})
                continue
            try:
                item = validate_row(dict(zip(HEADERS, fields)), number, file_hash)
                key = (str(item.values["merchant_id"]), str(item.values["aw_product_id"]))
                if key in seen:
                    raise ValueError("duplicate merchant_id and aw_product_id in CSV")
                seen.add(key)
                valid.append(item)
            except ValueError as exc:
                rejected.append({"record": number, "reason": str(exc)})
    return valid, rejected, file_hash


def confirm_target(config: dict[str, str], expected_ref: str) -> dict[str, object]:
    public_host = urlsplit(config.get("NEXT_PUBLIC_SUPABASE_URL", "")).hostname
    if public_host != f"{expected_ref}.supabase.co":
        raise ValueError("Supabase project URL does not match --confirm-project-ref")
    dsn = config.get("DATABASE_URL", "")
    parsed = urlsplit(dsn)
    username = unquote(parsed.username or "")
    host = (parsed.hostname or "").lower()
    direct = host == f"db.{expected_ref}.supabase.co"
    pooler = host.endswith(".pooler.supabase.com") and username.endswith(f".{expected_ref}")
    if parsed.scheme not in ("postgres", "postgresql") or not (direct or pooler):
        raise ValueError("DATABASE_URL does not identify the confirmed Supabase project")
    options = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if set(options) - {"pgbouncer", "sslmode"}:
        raise ValueError("DATABASE_URL has unreviewed connection options")
    if options.get("sslmode", "require") not in ("require", "verify-ca", "verify-full"):
        raise ValueError("DATABASE_URL must require TLS")
    if not parsed.password or not parsed.path.lstrip("/"):
        raise ValueError("DATABASE_URL needs a password and database name")
    return {
        "host": host,
        "port": parsed.port or 5432,
        "user": username,
        "password": unquote(parsed.password),
        "dbname": unquote(parsed.path.lstrip("/")),
        "sslmode": options.get("sslmode", "require"),
    }


def apply_rows(rows: list[ValidatedRow], config: dict[str, str], expected_ref: str) -> dict[str, int]:
    connection = confirm_target(config, expected_ref)
    local_dependencies = Path(__file__).resolve().parents[1] / ".deps"
    if local_dependencies.is_dir():
        sys.path.insert(0, str(local_dependencies))
    try:
        import psycopg
        from psycopg.types.json import Jsonb
    except ImportError as exc:
        raise RuntimeError("Install requirements-awin.txt before --apply") from exc
    with psycopg.connect(**connection, autocommit=True, connect_timeout=15) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.affiliate_products')")
            if cur.fetchone()[0] is None:
                raise RuntimeError("public.affiliate_products does not exist; review and apply migration separately")
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='affiliate_products'")
            columns = {item[0] for item in cur.fetchall()}
            required = set(DB_COLUMNS) | {"active", "imported_at", "updated_at"}
            if not required <= columns:
                raise RuntimeError("Existing affiliate_products schema is incompatible; inspect before changing it")
            cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid='public.affiliate_products'::regclass")
            if not cur.fetchone()[0]:
                raise RuntimeError("affiliate_products RLS is not enabled")
            cur.execute("""SELECT has_table_privilege(current_user, 'public.affiliate_products', 'INSERT')
                               AND has_table_privilege(current_user, 'public.affiliate_products', 'UPDATE')
                               AND has_table_privilege(current_user, 'public.affiliate_products', 'SELECT')""")
            if not cur.fetchone()[0]:
                raise RuntimeError("Database user lacks affiliate_products insert, update, or select permission")
            cur.execute("""SELECT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'public.affiliate_products'::regclass
                  AND conname = 'affiliate_products_merchant_aw_product_key'
                  AND contype = 'u')""")
            if not cur.fetchone()[0]:
                raise RuntimeError("Expected merchant/Awin product uniqueness constraint is missing")
        inserted = updated = unchanged = 0
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(hashtext('vestra_awin_import'))")
                merchants = sorted({str(row.values["merchant_id"]) for row in rows})
                cur.execute("SELECT merchant_id, aw_product_id, record_sha256, active FROM public.affiliate_products WHERE merchant_id = ANY(%s)", (merchants,))
                existing = {(merchant, awid): (digest, active) for merchant, awid, digest, active in cur.fetchall()}
                for row in rows:
                    key = (str(row.values["merchant_id"]), str(row.values["aw_product_id"]))
                    prior = existing.get(key)
                    if prior and prior[0] == row.values["record_sha256"] and prior[1]:
                        unchanged += 1
                        continue
                    params = tuple(Jsonb(row.values[name]) if name == "raw_record" else row.values[name] for name in DB_COLUMNS)
                    cur.execute(UPSERT, params)
                    if cur.fetchone() is None:
                        raise RuntimeError("Unexpected upsert conflict; transaction will roll back")
                    if prior:
                        updated += 1
                    else:
                        inserted += 1
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.affiliate_products")
            final_count = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM public.affiliate_products WHERE merchant_id = ANY(%s)", (merchants,))
            merchant_count = cur.fetchone()[0]
    return {"inserted": inserted, "updated": updated, "unchanged": unchanged,
            "final_table_count": final_count, "selected_merchant_count": merchant_count}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, default=Path(__file__).resolve().parents[1] / "datafeed_3143018.csv")
    parser.add_argument("--apply", action="store_true", help="Write valid rows to the existing table")
    parser.add_argument("--confirm-project-ref", help="Required with --apply; must match both configured URLs")
    args = parser.parse_args()
    try:
        rows, rejected, file_hash = validate_file(args.file)
        report: dict[str, object] = {
            "mode": "apply" if args.apply else "dry-run",
            "file_sha256": file_hash,
            "total_records": len(rows) + len(rejected),
            "valid_records": len(rows),
            "rejected_records": len(rejected),
            "rejections": rejected,
        }
        if args.apply:
            if not args.confirm_project_ref:
                raise ValueError("--confirm-project-ref is required with --apply")
            if rejected:
                raise ValueError("Import refused because CSV contains rejected records")
            report.update(apply_rows(rows, load_local_env(Path(__file__).resolve().parents[1] / ".env"), args.confirm_project_ref))
        print(json.dumps(report, indent=2))
        return 0 if not rejected else 2
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"Import stopped: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

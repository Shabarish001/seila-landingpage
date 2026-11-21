-- Review the target database and confirm this table is absent before running.
-- This migration creates only the Awin ingestion table. It does not grant public access.
BEGIN;

CREATE TABLE public.affiliate_products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aw_product_id text NOT NULL,
    merchant_product_id text NOT NULL,
    merchant_id text NOT NULL,
    merchant_name text NOT NULL,
    product_name text NOT NULL,
    description text,
    merchant_category text,
    category_name text,
    category_id text,
    search_price numeric(12, 2) NOT NULL CHECK (search_price >= 0),
    currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    store_price numeric(12, 2) CHECK (store_price IS NULL OR store_price >= 0),
    delivery_cost numeric(12, 2) CHECK (delivery_cost IS NULL OR delivery_cost >= 0),
    display_price text,
    merchant_image_url text,
    aw_image_url text,
    aw_deep_link text NOT NULL,
    merchant_deep_link text,
    language text,
    feed_last_updated timestamptz,
    data_feed_id text NOT NULL,
    raw_record jsonb NOT NULL,
    record_sha256 char(64) NOT NULL,
    source_file_sha256 char(64) NOT NULL,
    source_row_number integer NOT NULL CHECK (source_row_number > 0),
    active boolean NOT NULL DEFAULT true,
    imported_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT affiliate_products_merchant_aw_product_key UNIQUE (merchant_id, aw_product_id)
);

CREATE INDEX affiliate_products_feed_idx ON public.affiliate_products (data_feed_id);
CREATE INDEX affiliate_products_merchant_idx ON public.affiliate_products (merchant_id);

ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliate_products FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.affiliate_products_id_seq FROM anon, authenticated;

COMMIT;

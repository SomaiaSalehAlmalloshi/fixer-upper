/*
# Make ref_*.created_by nullable + seed currencies and countries

## Purpose
1. Several ref_* tables have `created_by UUID NOT NULL` with no default, which
   blocks seed data (no users exist yet) and is unnecessarily strict for
   reference data. This migration makes `created_by` nullable on all ref_*
   tables so seed rows and system-created reference records can have NULL
   ownership while still being shared/readable by all authenticated users.
2. Seeds `ref_currencies` and `ref_countries` with common baseline data.

## Changes
- ALTER COLUMN created_by DROP NOT NULL on all 17 ref_* tables.
- INSERT seed rows into ref_currencies and ref_countries (ON CONFLICT DO NOTHING).

## Security
- No policy changes. RLS remains enabled with admin+analyst write, authenticated read.
*/

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ref_currencies','ref_countries','ref_regions','ref_cities','ref_branches',
    'ref_departments','ref_customer_categories','ref_product_types','ref_loan_types',
    'ref_account_types','ref_asset_classes','ref_risk_categories','ref_basel_risk_weights',
    'ref_rating_grades','ref_collateral_types','ref_employment_types','ref_job_titles'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_by DROP NOT NULL;', t);
  END LOOP;
END $$;

INSERT INTO public.ref_currencies (code, name, symbol, decimals) VALUES
  ('USD','US Dollar','$',2),
  ('EUR','Euro','€',2),
  ('GBP','British Pound','£',2),
  ('CHF','Swiss Franc','Fr',2),
  ('JPY','Japanese Yen','¥',0),
  ('CNY','Chinese Yuan','¥',2),
  ('SAR','Saudi Riyal','﷼',2),
  ('AED','UAE Dirham','د.إ',2),
  ('EGP','Egyptian Pound','£E',2),
  ('KWD','Kuwaiti Dinar','د.ك',3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_countries (code, code3, name, region) VALUES
  ('US','USA','United States','North America'),
  ('GB','GBR','United Kingdom','Europe'),
  ('DE','DEU','Germany','Europe'),
  ('FR','FRA','France','Europe'),
  ('CH','CHE','Switzerland','Europe'),
  ('JP','JPN','Japan','Asia'),
  ('CN','CHN','China','Asia'),
  ('SA','SAU','Saudi Arabia','Middle East'),
  ('AE','ARE','United Arab Emirates','Middle East'),
  ('EG','EGY','Egypt','Africa'),
  ('KW','KWT','Kuwait','Middle East'),
  ('BH','BHR','Bahrain','Middle East'),
  ('QA','QAT','Qatar','Middle East'),
  ('OM','OMN','Oman','Middle East'),
  ('JO','JOR','Jordan','Middle East')
ON CONFLICT (code) DO NOTHING;

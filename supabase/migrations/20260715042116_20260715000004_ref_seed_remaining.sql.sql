/*
# Seed remaining reference data tables

## Purpose
Seeds ref_employment_types, ref_customer_categories, ref_product_types,
ref_account_types, ref_rating_grades with common baseline values using the
correct column names from the existing schema (label, description, etc.).

## Changes
- INSERT seed rows into 5 ref_* tables (ON CONFLICT DO NOTHING).
*/

INSERT INTO public.ref_employment_types (code, label, description) VALUES
  ('full_time','Full-Time','Permanent full-time employment'),
  ('part_time','Part-Time','Permanent part-time employment'),
  ('contract','Contract','Fixed-term contract'),
  ('self_employed','Self-Employed','Self-employed or freelancer'),
  ('retired','Retired','Retired'),
  ('unemployed','Unemployed','Not currently employed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_customer_categories (code, label, description) VALUES
  ('individual','Individual','Retail individual customer'),
  ('sme','SME','Small and medium enterprise'),
  ('corporate','Corporate','Large corporate customer'),
  ('sovereign','Sovereign','Sovereign and government entity'),
  ('bank','Bank','Financial institution')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_product_types (code, label, category, description) VALUES
  ('term_loan','Term Loan','credit','Standard term loan'),
  ('revolving_credit','Revolving Credit','credit','Revolving credit facility'),
  ('overdraft','Overdraft','credit','Overdraft facility'),
  ('letter_of_credit','Letter of Credit','credit','Trade finance LC'),
  ('guarantee','Bank Guarantee','credit','Bank guarantee facility')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_account_types (code, label, description) VALUES
  ('checking','Checking Account','Transactional checking account'),
  ('savings','Savings Account','Interest-bearing savings account'),
  ('current','Current Account','Non-interest current account'),
  ('term_deposit','Term Deposit','Fixed-term deposit')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_rating_grades (code, label, pd_floor, pd_cap, sort_order, investment_grade) VALUES
  ('AAA','AAA - Highest quality',0.0001,0.0005,1,true),
  ('AA','AA - Very high quality',0.0003,0.0010,2,true),
  ('A','A - High quality',0.0010,0.0050,3,true),
  ('BBB','BBB - Medium grade',0.0050,0.0200,4,true),
  ('BB','BB - Speculative',0.0200,0.0800,5,false),
  ('B','B - Highly speculative',0.0800,0.2000,6,false),
  ('CCC','CCC - Extremely speculative',0.2000,0.5000,7,false),
  ('D','D - Default',1.0000,1.0000,8,false)
ON CONFLICT (code) DO NOTHING;

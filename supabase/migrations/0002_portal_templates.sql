-- Starting checklist templates. Both are editable in the staff console and
-- MUST be reviewed by Crown staff before a request is sent to a client.
-- No client names, emails or data appear here; org names are typed by staff
-- when a request is created.

insert into portal_templates (slug, name, purpose, instructions, checklist) values
(
  'nmsdc-mbe-certification',
  'NMSDC MBE certification intake',
  'NMSDC certification intake',
  'Please upload the documents below as PDF, JPG or PNG (50 MB per file). Scans or clear phone photos are fine. If an item does not apply to your company, you can skip it; we will follow up on anything missing. Where a customer invoice is requested, please pair it with proof that it was paid (bank or card statement line, cancelled check, or remittance).',
  '[
    {"group":"Ownership and governance","items":[
      {"label":"Articles of incorporation or organization (filed copy)","note":""},
      {"label":"Bylaws or operating agreement, including all amendments","note":""},
      {"label":"Stock certificates or membership ledger (front and back) and stock transfer ledger","note":""},
      {"label":"Minutes of the first and most recent board or member meetings","note":""},
      {"label":"Proof of ethnicity for each minority owner (birth certificate, passport, tribal enrollment, or similar)","note":"Government-issued documents only; redact ID numbers if you prefer."},
      {"label":"Proof of U.S. citizenship for each minority owner","note":""},
      {"label":"Proof of capital contribution or purchase of ownership interest","note":"Cancelled checks, wire confirmations, or bills of sale."},
      {"label":"Buy-sell, shareholder, voting trust, or management agreements, if any","note":""}
    ]},
    {"group":"Management and control","items":[
      {"label":"Resumes for all owners, officers, directors and key managers","note":""},
      {"label":"Current organizational chart","note":""},
      {"label":"Bank signature card or bank letter showing authorized signers","note":""},
      {"label":"Professional, contractor or trade licenses held by the company and by each owner","note":""}
    ]},
    {"group":"Business operations","items":[
      {"label":"Business license and fictitious business name statement (DBA), if any","note":""},
      {"label":"Office or yard lease, or deed if owned","note":""},
      {"label":"Equipment list with ownership or lease documents for major items","note":""},
      {"label":"Certificate of liability insurance and workers'' compensation certificate","note":""},
      {"label":"Current customer list with contact information","note":"A short spreadsheet printed to PDF is fine."},
      {"label":"Three recent customer invoices, each paired with proof of payment","note":"Please upload the invoice and its payment proof as separate files named to match (for example Invoice-1041.pdf and Invoice-1041-paid.pdf)."},
      {"label":"Signed contracts or purchase orders for the three largest recent jobs","note":""}
    ]},
    {"group":"Financial and tax","items":[
      {"label":"Federal business tax returns for the last three years, all schedules","note":""},
      {"label":"Most recent year-end balance sheet and profit and loss statement","note":""},
      {"label":"Current interim balance sheet and profit and loss statement","note":""},
      {"label":"Most recent payroll report or quarterly payroll tax filing (DE 9 / Form 941)","note":""},
      {"label":"Loan agreements, lines of credit and personal guarantees, if any","note":""}
    ]},
    {"group":"Prior certifications","items":[
      {"label":"Current or prior certification letters (SBE, DBE, MBE, WBE, DVBE, 8(a), HUBZone) and any denial or decertification letters","note":""}
    ]}
  ]'::jsonb
),
(
  'dbe-initial-screen',
  'DBE initial eligibility screen',
  'Initial DBE eligibility screening',
  'This is an initial screen only, not the full DBE application. Please upload what you have for each item below as PDF, JPG or PNG (50 MB per file). We are not asking for a personal narrative at this stage. If something does not apply, skip it and we will follow up.',
  '[
    {"group":"Ownership and governance","items":[
      {"label":"Articles of incorporation or organization and all amendments","note":""},
      {"label":"Bylaws or operating agreement","note":""},
      {"label":"Current ownership breakdown (stock ledger, membership schedule, or cap table)","note":""},
      {"label":"Proof of how each owner acquired their interest (capital contribution, purchase, gift, or inheritance)","note":""},
      {"label":"Any agreement that limits an owner''s control (buy-sell, voting, management, or franchise agreements)","note":""}
    ]},
    {"group":"Company size and affiliates","items":[
      {"label":"Federal business tax returns for the last three years","note":"Used for the gross receipts size test."},
      {"label":"List of any other businesses owned or managed by the owners, with ownership percentages","note":"A short written list is fine."},
      {"label":"Shared resources with other companies (employees, equipment, office, bonding, or financing), if any","note":""},
      {"label":"Most recent payroll summary showing headcount","note":""}
    ]},
    {"group":"Licenses and who controls each line of work","items":[
      {"label":"Contractor, trade and professional licenses held by the company and by each owner or manager","note":"Please include the CSLB license detail page if applicable."},
      {"label":"Resumes for each owner and for anyone who supervises field work or estimating","note":""},
      {"label":"A short list of your main work lines (for example tree trimming, line clearance, hauling) and who makes day-to-day and bidding decisions for each","note":""},
      {"label":"Equipment list with title, lease or loan documents for major items","note":""}
    ]},
    {"group":"Prior certifications","items":[
      {"label":"Any current or prior certification letters (DBE, SBE, DVBE, MBE, WBE) and any denial, decertification, or reevaluation correspondence","note":""}
    ]}
  ]'::jsonb
)
on conflict (slug) do update
  set name = excluded.name,
      purpose = excluded.purpose,
      instructions = excluded.instructions,
      checklist = excluded.checklist;

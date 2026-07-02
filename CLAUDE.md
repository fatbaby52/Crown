# Crown Consulting Team - Project Context

## Overview
Single-page landing site for Crown Consulting Team, a consulting firm run by two attorneys (Tony Carlos and Alex Craig) who help small-to-mid-sized contractors—especially in California vegetation management—compete with larger firms using AI and technology.

## Live Site
- **Domain:** crownconsultingteam.com
- **Hosting:** Netlify
- **Repo:** github.com/fatbaby52/Crown

## Tech Stack
- Vanilla HTML/CSS/JS
- Netlify serverless function for OpenAI API calls (`/netlify/functions/chat.js`)
- Netlify Forms for consultation requests
- Google Workspace email (MX records preserved)
- Google Analytics 4 (Measurement ID: G-LXXD13ZM2L)

## Key Design Decisions
- **Apple-inspired aesthetic:** Dark theme (#0a0a0a), electric green accent (#39FF14), dramatic typography (Space Grotesk + Inter)
- **Hero flow:** Logo → Bold headline → Input box → Subheadline/credibility → Scroll indicator
- **Input box:** Green pulsing border to draw attention, cycling placeholder examples, hidden caret
- **AI responses:** Report-style modal (not chat), shows "Your Issue" and "Our Recommendation"
- **Case studies:** Abstract animated visuals for each (Compliance AI, Certification Pipeline, Bid Intelligence, Living Documents)

## AI Behavior (System Prompt)
- Concise responses (2-3 paragraphs max)
- Always finds a way to help—never refers people away
- Connects any request to Crown's services (compliance, certifications, bidding, AI implementation, etc.)

## Forms
- Consultation form uses Netlify Forms (not Google Forms)
- When user clicks CTA from report modal, their question auto-fills in the form

## DNS Setup (Squarespace Domains)
- A record: @ → 75.2.60.5
- CNAME: www → crownconsulting.netlify.app
- TXT: SPF record for Google Workspace (preserved)

## Files
- `index.html` - Main homepage
- `styles.css` - All styling (including subpage styles)
- `main.js` - Interactions, modals, placeholder cycling, search bar handling
- `netlify/functions/chat.js` - OpenAI serverless function
- `.env` - OpenAI API key (not committed)

## SEO Landing Pages
All SEO pages include: navigation bar, AI search bar, page content, CTA section, footer with site navigation, schema markup, and Google Analytics.

**Certifications (`/certifications/`):**
- `dbe-certification-california.html` - DBE certification help (primary SEO target: Caltrans, LA Metro, CUCP queries)
- `california-dbe-reevaluation.html` - DBE reevaluation help under the 2025 USDOT Interim Final Rule (49 CFR § 26.111), reframed for the post-deadline phase
- `dbe-personal-narrative-california.html` - Personal Narrative preparation help
- `dbe-reevaluation-deadline-missed.html` - Late reevaluation submissions after the April 16, 2026 deadline
- `dbe-reevaluation-rfi-response.html` - Responding to reevaluation requests for additional information
- `dbe-decertification-appeal.html` - Decertification responses and 45-day USDOT appeals under 49 CFR § 26.89
- `dbe-labor-contractor-california.html`, `dbe-site-preparation-contractor-california.html`, `dbe-highway-subcontractor-california.html`, `dbe-utility-crews-california.html` - trade-specific DBE pages
- `dvbe-certification-california.html` - DVBE (disabled veteran) certification
- `sbe-certification-california.html` - Small business certification
- `mbe-wbe-certification-california.html` - Minority/women-owned certification

**Compliance (`/compliance/`):**
- `pge-contractor-compliance.html` - PG&E contractor requirements
- `cal-osha-tree-service-compliance.html` - Cal/OSHA for tree service
- `california-iipp-requirements.html` - Injury & Illness Prevention Program
- `vegetation-management-compliance.html` - Utility vegetation management

**Bidding (`/bidding/`):**
- `california-government-contracts-small-business.html` - Government contracting guide
- `utility-contractor-bidding.html` - Utility contract bidding strategies

**Funding (`/funding/`):**
- `usda-community-facilities-rural.html` - USDA Community Facilities loans/grants for rural California

**General (`/general/`):**
- `contractor-compliance-consultant-california.html` - Overview of Crown's services

**Industries (`/industries/`):** construction, janitorial, landscaping, electrical, solar, hvac, plumbing (all `*-contractor-california.html`)

## SEO / LLM Infrastructure
- `sitemap.xml` - All pages (25 as of July 2026), extensionless URLs (Netlify serves these; canonicals match)
- `robots.txt` - Allows all crawlers, explicitly welcomes AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.), points to sitemap
- `llms.txt` - LLM-readable site summary with key facts (CUCP agencies, PNW cap, IFR) and page links
- All pages have: canonical, Open Graph + Twitter card tags, JSON-LD
- Homepage has ProfessionalService org schema (`@id: .../#organization`) with phone, email, founders
- DBE pages have Service + BreadcrumbList JSON-LD; the core DBE pages (main, reevaluation, personal narrative, deadline-missed, RFI, appeal) also have Article JSON-LD with datePublished/dateModified (bump dateModified + visible "Updated" line + sitemap lastmod on every content edit) and FAQPage JSON-LD mirroring the visible FAQ sections (keep them in sync when editing FAQs)
- DBE facts current as of July 2026: Oct 2025 USDOT Interim Final Rule, Personal Narrative required, PNW cap $2,047,000, CUCP certifiers include Caltrans, LA Metro, BART, SFMTA, SANDAG, AC Transit, Sacramento RTD, VTA, OCTA, LAWA
- Reevaluation timeline facts (July 2026): Caltrans submission deadline was April 16, 2026; late packets still accepted, processed after on-time queue; non-submitters ineligible until approved; new DBE applications on hold until reevaluation completes; decertified firms appeal to USDOT under 49 CFR § 26.89 within 45 days (record-review only, decision stays in effect); § 26.87 procedures don't apply to reevaluation decertifications; Mid-America Milling dismissed as moot 3/19/2026
- IndexNow + Bing Webmaster Tools are set up (done June 2026)

## Site Navigation
- Homepage footer has links to all SEO pages organized by category
- All SEO pages have the same footer navigation
- SEO pages have top nav bar with logo (links to homepage) and "Free Consultation" CTA

## Founders
- **Tony Carlos, Esq.** - Utility line clearance operations, in-house counsel background
- **Alex Craig, Esq.** - Business development, bid surfacing, certifications, analytics

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
- `dbe-certification-california.html` - DBE certification help
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

**General (`/general/`):**
- `contractor-compliance-consultant-california.html` - Overview of Crown's services

## Site Navigation
- Homepage footer has links to all SEO pages organized by category
- All SEO pages have the same footer navigation
- SEO pages have top nav bar with logo (links to homepage) and "Free Consultation" CTA

## Founders
- **Tony Carlos, Esq.** - Utility line clearance operations, in-house counsel background
- **Alex Craig, Esq.** - Business development, bid surfacing, certifications, analytics

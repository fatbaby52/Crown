# Crown Consulting Team - SEO Pages Package

## Overview

This package contains SEO-optimized landing pages for Crown Consulting Team. Each page targets specific search queries that potential clients use when looking for help with certifications, compliance, and bidding.

## Target Audience

Small to mid-sized California contractors, typically family-owned businesses in utility line clearance, tree care, and vegetation management.

## File Structure

```
/pages
  /certifications
    dbe-certification-california.md
    dvbe-certification-california.md
    sbe-certification-california.md
    mbe-wbe-certification-california.md
  /compliance
    pge-contractor-compliance.md
    cal-osha-tree-service-compliance.md
    california-iipp-requirements.md
    vegetation-management-compliance.md
  /bidding
    california-government-contracts-small-business.md
    utility-contractor-bidding.md
  /general
    contractor-compliance-consultant-california.md
```

## Implementation Notes for Claude Code

### Page Structure

Each markdown file includes:
- Title (H1) optimized for the target keyword
- Meta description (in frontmatter)
- Target keywords (in frontmatter)
- Body content (500-800 words)
- Call to action section

### Frontmatter Format

```yaml
---
title: "Page Title for SEO"
meta_description: "155 characters max for search results"
target_keywords:
  - primary keyword
  - secondary keyword
slug: url-friendly-slug
---
```

### Conversion to HTML

These pages should be converted to HTML and integrated into the existing Crown Consulting website. Each page should:

1. Use the site's existing header/footer/navigation
2. **Include the AI-powered search bar (ChatGPT widget) on every page** — This is a key differentiator and conversion tool. The search bar should appear prominently, ideally near the top of the page or in a consistent location that matches the homepage. It demonstrates Crown's AI capabilities while helping visitors get immediate answers before booking a consultation.
3. Include the "Book a Free Consultation" CTA button
4. Include the phone number prominently
5. Match the existing site's visual style

**Note on the AI search bar:** The homepage uses the prompt "What do you need help with?" — consider using the same prompt on subpages, or a contextual variant like "Have a question about [certification/compliance/bidding]?" that matches the page topic.

### Suggested URL Structure

```
crownconsultingteam.com/certifications/dbe-certification-california
crownconsultingteam.com/certifications/dvbe-certification-california
crownconsultingteam.com/compliance/pge-contractor-requirements
etc.
```

### Internal Linking Strategy

Each page should link to:
- Related certification pages (from other certification pages)
- The main consultation booking page
- The About page (Tony and Alex bios)

### Schema Markup (Recommended)

Add LocalBusiness and Service schema to each page:

```json
{
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "name": "Crown Consulting Team",
  "description": "Certification, compliance, and bidding consulting for California contractors",
  "areaServed": "California",
  "serviceType": ["Business Consulting", "Certification Assistance", "Compliance Consulting"]
}
```

## Tracking & Analytics

Recommended UTM structure for paid campaigns pointing to these pages:
- utm_source=google
- utm_medium=cpc
- utm_campaign=certifications (or compliance, bidding)
- utm_content=dbe (specific page identifier)

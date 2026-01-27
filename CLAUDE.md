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
- `index.html` - Main page
- `styles.css` - All styling
- `main.js` - Interactions, modals, placeholder cycling
- `netlify/functions/chat.js` - OpenAI serverless function
- `.env` - OpenAI API key (not committed)

## Founders
- **Tony Carlos, Esq.** - Utility line clearance operations, in-house counsel background
- **Alex Craig, Esq.** - Business development, bid surfacing, certifications, analytics

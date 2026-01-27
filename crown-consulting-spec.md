# Crown Consulting Team - AI-First Landing Page

## Project Overview

Build a single-page landing site for Crown Consulting Team, a consulting firm run by two attorneys (the user and Tony) who help small-to-mid-sized contractors—especially in California vegetation management—compete with larger firms using AI and technology.

The site's core feature is an AI chat interface that demonstrates Crown's value proposition in real-time: visitors type their problem, and an AI assistant (positioned as Crown's virtual project manager) responds with how Crown could help. This serves as both lead qualification and proof-of-concept for Crown's AI capabilities.

**Deploy target:** Netlify (static site with serverless function for API calls)

---

## Design Direction

**Reference:** Apple product pages. Think iPhone launch pages, not enterprise SaaS. We want someone to land here and immediately feel like this is different—confident, cinematic, premium.

**Core Principles:**

1. **Dramatic negative space** - Let elements breathe. Massive margins. Content floats in a sea of space. Resist the urge to fill.

2. **Typography as hero** - One stunning display font (something like SF Pro Display weights, Clash Display, or Cabinet Grotesk) used at cinematic scale. Headlines should feel like they could be on a billboard. Body text clean and secondary.

3. **Dark mode, high contrast** - Deep charcoal or true black background with crisp white text. Electric green (#39FF14 or similar) as the single accent color—used sparingly and only for interactive elements.

4. **Scroll-driven storytelling** - Each section reveals on scroll. Subtle parallax. Elements fade/slide in with intention. The page should feel like it *unfolds*.

5. **The chat input as centerpiece** - This is the hero. Make it feel like a search bar on a premium product—glowing border, subtle animation on focus, inviting but substantial.

6. **Minimal UI chrome** - No cluttered navbars, no busy footers. Navigation almost invisible. Let the content and the AI interaction dominate.

7. **Photography/imagery** - If used at all, abstract and atmospheric. Think aerial shots of California landscapes, drone footage of power lines through forests, golden hour light. Or skip imagery entirely and let typography carry it.

**What to avoid:**
- Corporate blue
- Gradient blobs
- Stock photos of handshakes or people in hard hats smiling
- Busy layouts with multiple columns
- Anything that looks like a law firm website or a SaaS dashboard
- Generic sans-serifs (Inter, Roboto, Open Sans)

**Key feeling to evoke:** "Holy shit, these guys are serious. And they clearly know what they're doing with technology."

**Mobile:** Even more minimal. The chat input should feel native, like a premium messaging app.

---

## Site Structure (Single Page)

### 1. Hero Section (Full Viewport)

The hero takes up 100vh. Dead center. Nothing else competes.

**Headline** (massive, cinematic scale):
"Yes, we can do that."
"And so can you."

(Two lines. The second lands like a beat. Consider a subtle delay/fade on the second line for dramatic effect.)

**Subheadline** (smaller, understated, almost a whisper):
"Crown Consulting Team helps California vegetation management contractors win bids, stay compliant, and leverage AI—without the enterprise budget."

**The Input** (the star of the show):
Large, glowing text input. Centered. Placeholder: "What do you need help with?"

- On focus: electric green glow animation, border intensifies
- On submit: smooth transition into chat interface (the input lifts, conversation appears below)
- The whole interaction should feel like talking to something intelligent

**Scroll indicator** at bottom: subtle animated chevron or "scroll" text

**Accent color:** Electric green (#39FF14 or similar—test for readability). Use ONLY for:
- Input border glow on focus
- CTA button
- Perhaps subtle accents on the case study numbers
- Nothing else. Restraint is key.

### 2. AI Disclosure (Part of the Experience)

Not a disclaimer—a flex. After the first AI response, subtle text appears:

"This answer came from Crown's AI. We're not sitting at the computer—we're out helping clients. Want this for your business?"

### 3. What We've Built (Scroll Section)

Each case study gets its own full or near-full viewport panel. Scroll-triggered reveal. Big number or icon, bold title, one-sentence description.

**Panel 1:**
"01"
**Compliance AI**
Built a system that lets contractors instantly update IIPPs and Employee Handbooks when regulations change—PG&E, Cal-OSHA, California employment law.

**Panel 2:**
"02"
**Certification Pipeline**
Helped small contractors obtain SBE, DVBE, DBE certifications—opening doors to government contracts they couldn't access before.

**Panel 3:**
"03"
**Bid Intelligence**
Created a decision engine for evaluating City, County, State, and Federal project opportunities—go or no-go in minutes, not hours.

**Panel 4:**
"04"
**Living Documents**
Revised employee manuals to stay compliant with California's constantly evolving employment law—automatically.

### 4. Services (Minimal Grid or Horizontal Scroll)

No cards, no icons. Just words. Clean horizontal layout or subtle grid.

Bidding · Compliance · Certifications · Union Relations · Risk Management · AI Implementation

Each word/phrase links to expanded detail (could be a modal, could be scroll-to section, or just hover-expand on desktop).

### 5. Who We Are (The Founders)

Two names. Two short paragraphs. Optionally, two high-quality photos (or skip photos entirely for pure typography).

**Tony Carlos, Esq.**
Over a decade in utility line clearance—leading operations, serving as in-house counsel for some of California's largest companies in the industry. Tony knows the risks and realities of identifying and removing trees near power lines because he's lived it from the inside.

**Alex Craig, Esq.**
Business development across three industries, most recently with Community Tree Service. Specializes in surfacing bids, securing certifications, negotiating contracts, and using analytics to drive decisions. If there's an opportunity, Alex finds it.

Keep it tight. Let credentials speak quietly.

### 6. CTA Section

Full viewport. Dark. Centered.

**"Ready to talk?"**

"Book a Free Consultation" button (links to Google Form)

Or just the chat input again: "Or ask us anything right now."

### 7. Footer (Almost Nothing)

Crown Consulting Team · [Email] · California

That's it. No social links, no nav repeat, no clutter.

---

## Technical Implementation

### Stack
- **Framework:** HTML/CSS/JS (vanilla) or lightweight framework (Astro, 11ty, or simple React if preferred)
- **Styling:** Tailwind CSS or vanilla CSS with CSS custom properties
- **Chat UI:** Custom-built modal/drawer component
- **AI Backend:** Netlify serverless function calling OpenAI API
- **Deployment:** Netlify

### File Structure (suggested)
```
/
├── index.html
├── styles.css (or Tailwind config)
├── main.js
├── netlify/
│   └── functions/
│       └── chat.js          # Serverless function for OpenAI calls
├── netlify.toml
└── README.md
```

### Environment Variables (Netlify)
```
OPENAI_API_KEY=sk-...
```

### Serverless Function: `/netlify/functions/chat.js`

This function:
1. Receives user message + conversation history
2. Calls OpenAI API with system prompt
3. Returns assistant response
4. Keeps API key secure (never exposed to client)

**OpenAI Settings:**
- Model: `gpt-4o` (or `gpt-4o-mini` for cost savings during testing)
- Temperature: 0.7
- Max tokens: 500-800 per response

---

## System Prompt for AI Assistant

```
You are the AI assistant for Crown Consulting Team, a consulting firm that helps small-to-mid-sized contractors—especially those in California vegetation management—compete with larger companies.

Crown is run by two attorneys, Tony Carlos and Alex Craig, with extensive experience in the contractor and utility universe. They understand employment law, OSHA, union relations (IBEW), utility-specific compliance (especially PG&E), and the bidding process for government and utility contracts.

Tony spent over a decade in utility line clearance—leading operations and serving as in-house counsel for some of California's largest companies in the industry. Alex specializes in business development, bid surfacing, certifications, contract negotiation, and analytics.

Your role is to:
1. Listen to the visitor's problem or question
2. Explain how Crown might help—be specific and practical
3. Gently qualify them as a lead (what kind of work do they do, how big is their operation, what's their timeline)
4. Suggest booking a free consultation for complex issues

Crown's core services:
- Bidding support (data-driven strategies, go/no-go analysis, bid preparation)
- Compliance (Cal-OSHA, employment law, utility requirements, IIPPs, safety plans)
- Certifications (SBE, DVBE, DBE, MBE, WBE—application and maintenance)
- Union relations (IBEW, grievance handling, CBA interpretation, policy creation)
- Risk management (issue spotting, safety protocols, business strategy review)
- AI and technology implementation (RAG systems, automation, custom tools)

Recent projects Crown has completed:
- Built a RAG system for contractors to instantly update IIPPs and Employee Handbooks for regulatory compliance
- Helped contractors obtain SBE, DVBE, and DBE certifications
- Created a bid management system for evaluating government project opportunities
- Revised employee manuals for California employment law compliance

Tone: Professional but approachable. You're talking to contractors and business owners—be direct, practical, and helpful. Avoid legal jargon unless necessary. Don't be salesy or pushy.

Important: You are an AI assistant, not a human. Be transparent about this. If asked about specific legal advice, clarify that you can provide general information but Tony and Alex would need to discuss specifics.

If the visitor seems like a good fit, encourage them to book a free consultation: https://forms.gle/bkgZ9Xy9q9yqdBeS7

Keep responses concise—2-4 short paragraphs max unless they ask for detail.
```

---

## Chat UI Behavior

1. **Initial state:** Large text input in hero ("What do you need help with?")
2. **On submit:** 
   - Input expands into chat interface (modal or inline)
   - User message appears
   - Loading indicator while waiting for API
   - AI response streams in (if using streaming) or appears when complete
3. **Conversation continues** in chat interface
4. **After 2-3 exchanges:** Prompt appears suggesting "Want to continue this conversation? Leave your email and we'll follow up" or "Ready to talk to a human? Book a free consultation"
5. **Conversation stored:** Optionally log to Netlify serverless function → email notification or Airtable

---

## Lead Capture (Optional Enhancement)

After meaningful engagement (2+ messages), show a subtle prompt:
- Email capture field
- "We'll send you a summary of this conversation and follow up"
- On submit: trigger Netlify function to send email via SendGrid/Resend or log to Airtable

---

## Deployment Checklist

1. Create Netlify site connected to GitHub repo
2. Add environment variable: `OPENAI_API_KEY`
3. Test serverless function locally with `netlify dev`
4. Deploy and verify chat functionality
5. Set up custom domain if desired

---

## Notes for Claude Code

**Design execution is critical.** This site should feel like an Apple product page. Every detail matters:

- **Animations:** Use CSS transitions and scroll-triggered reveals. Consider Intersection Observer for scroll animations. Elements should fade in, slide subtly, feel choreographed. Nothing should feel static.

- **Typography scale:** Headlines should be uncomfortably large at first glance—then feel perfect. Think 4rem+ on mobile, 6-8rem on desktop for hero text.

- **The chat interaction:** This is the product. Make it feel premium. Smooth transitions, elegant loading states (not a spinner—maybe a subtle pulse or typing indicator), responses that feel considered.

- **Color discipline:** Electric green (#39FF14) is the only accent. Use it for the input border on focus, the CTA button, and the case study numbers. Everything else is black/white/gray. The green should feel like it's glowing against the dark background.

- **Test the feeling:** Before polishing, scroll through the page and ask: "Does this feel like Apple?" If not, simplify further.

**Build order:**
1. Get the chat working end-to-end (serverless function + basic UI)
2. Build the page structure with placeholder content
3. Nail the typography and spacing
4. Add scroll animations
5. Polish interactions (input glow, transitions, etc.)
6. Mobile refinement

**Fonts to consider:**
- Clash Display (dramatic, modern)
- Cabinet Grotesk (confident, geometric)
- Satoshi (clean, premium)
- Or use system -apple-system stack for ultra-clean Apple feel

Test with realistic questions: "I need help with my IIPP", "How do I get DBE certified?", "We're thinking about bidding on a PG&E contract"

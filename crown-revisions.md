# Crown Consulting Site Revisions

## Change 1: Update Subheadline + Add Credibility Line + Add Logo

**Location:** Hero section

**Add at top of hero:**
- Display the Crown logo (file: "crown logo" in the project folder)
- Position: top center of the hero section
- Size: modest—shouldn't compete with the headline. Around 60-80px height, scale appropriately.
- Style: if the logo has a light version, use it. Otherwise ensure it's visible against the dark background.

**Below logo, the headline:**
"Yes, we can do that."
"And so can you."

**Below headline, subheadline:**
"Crown Consulting Team helps California contractors punch above their weight. Win bids, stay compliant, and leverage AI without an enterprise budget."

**Add below that (new line):**
"Founded by two attorneys who've spent their careers in the contractor universe."

**Styling for the credibility line:**
- Smaller than the subheadline
- Slightly muted (gray or lower opacity white)
- Almost a whisper—understated credibility, not a headline
- Consider italics or a lighter font weight to differentiate it

---

## Change 2: Add Scroll Indicator for Previous Projects

**Location:** Bottom of the hero section, above or near the scroll indicator

**Text:** "Scroll to see what we've done"

**Behavior:** 
- This should appear near the bottom of the hero viewport
- Style it subtly (smaller text, slightly muted compared to the headline)
- Pair with an animated down arrow/chevron
- Consider a subtle fade-in animation after the page loads (1-2 second delay)

---

## Change 3: Add Abstract Visuals for Each Case Study

**Location:** The four case study panels (Compliance AI, Certification Pipeline, Bid Intelligence, Living Documents)

**Goal:** Each panel should have a stylized, code-generated visual element that teases what the project looks like—abstract and cinematic, not literal screenshots. These visuals should reinforce the premium, Apple-style aesthetic.

**Visual approach for each:**

### 01 - Compliance AI
Create an animated SVG or CSS animation showing:
- A document outline with lines of "text" (abstract horizontal bars)
- Text lines subtly rewriting/updating themselves (fade out old, fade in new)
- Optional: small indicator showing "PG&E," "Cal-OSHA," "CA Labor" cycling through
- Electric green accent on active/updating elements
- Feels like: a living document that updates itself

### 02 - Certification Pipeline
Create a visual showing:
- A horizontal flow of 3-4 connected nodes (circles or rounded squares)
- Labels like "Apply → Review → Approved" or certification badges (SBE, DVBE, DBE)
- Animated progress: a pulse or glow traveling along the connection lines
- Final node has a checkmark or "certified" state
- Electric green for the active/complete states
- Feels like: a streamlined approval process

### 03 - Bid Intelligence
Create a minimal dashboard-style visual:
- 3-4 "project cards" stacked or in a grid (just abstract rectangles with minimal text placeholders)
- Each card has a status indicator: green dot = "GO", subtle red or gray = "NO-GO"
- One card could animate: evaluating → decision appears
- Feels like: instant clarity on which opportunities to pursue

### 04 - Living Documents
Create a visual showing:
- A document icon or outline
- A version history stack (multiple pages slightly offset behind each other)
- Animated: new version slides to the front, or a "last updated" timestamp ticks
- Small indicators showing sections that changed (highlighted in green)
- Feels like: documents that maintain themselves

**General styling notes:**
- Keep visuals minimal and abstract—no fake UI with too much detail
- Dark background, white/gray elements, electric green (#39FF14) accents only
- Subtle animations: gentle fades, pulses, slides. Nothing frenetic.
- Visuals should be ~300-400px wide on desktop, scale down gracefully on mobile
- Use CSS animations or lightweight SVG—avoid heavy libraries
- These should enhance the case study panels, not overwhelm the typography

---

## Change 4: Replace Google Form with Netlify Form

**Location:** All "Book a Free Consultation" buttons (hero section CTA and footer CTA)

**Current behavior:** Links to external Google Form (https://forms.gle/bkgZ9Xy9q9yqdBeS7)

**New behavior:** Opens a simple modal with a Netlify-powered form

**Form design:**
- Modal overlay (dark, semi-transparent background)
- Clean, minimal form matching the site aesthetic
- Dark card with white text, electric green submit button

**Form fields:**
1. **Name** (text input, required)
2. **Email** (email input, required)
3. **Phone** (tel input, optional)
4. **"What can we help you with?"** (textarea, required)
   - Placeholder: "Tell us about your project or challenge..."

**Submit button:** "Send Message" (electric green)

**On submit:**
- Show brief success state: "Thanks—we'll be in touch soon."
- Close modal after 2-3 seconds (or on click)

**Technical notes:**
- Use Netlify Forms (add `netlify` attribute to form element)
- Form name: "consultation"
- Include honeypot field for spam protection: `<input name="bot-field" hidden>`
- Add `data-netlify="true"` to the form tag
- No backend needed—Netlify handles submissions and you'll see them in the Netlify dashboard under Forms

**Example form structure:**
```html
<form name="consultation" method="POST" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="consultation" />
  <input name="bot-field" hidden />
  
  <label>Name</label>
  <input type="text" name="name" required />
  
  <label>Email</label>
  <input type="email" name="email" required />
  
  <label>Phone (optional)</label>
  <input type="tel" name="phone" />
  
  <label>What can we help you with?</label>
  <textarea name="message" placeholder="Tell us about your project or challenge..." required></textarea>
  
  <button type="submit">Send Message</button>
</form>
```

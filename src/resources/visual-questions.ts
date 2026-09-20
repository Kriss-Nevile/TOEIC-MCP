export const VISUAL_QUESTIONS_RESOURCE_URI = "toeic://guides/visual-questions";

export const VISUAL_QUESTIONS_GUIDE_TEXT = `# TOEIC Visual Content & Image Sourcing Specification for Agents

When preparing image-based questions for **TOEIC Speaking (Q3–4: Describe a Picture)** or **TOEIC Writing (Q1–5: Write a Sentence Based on a Picture)**, you must **never default to generating raw inline SVGs**.

Authentic exam simulation requires real, high-quality photographic media depicting authentic workplace scenarios. You must adhere strictly to the following 3-tier sourcing hierarchy:

\`\`\`
[Visual Question Drafted]
          │
          ▼
   1. Search Internet for Real Photographs (Unsplash, Wikimedia Commons, Pexels)
          │
          ├─► [Decent Picture Found?] ──► YES ──► Use Direct HTTPS Image URL
          │
          ▼ NO
   2. Fallback to Curated Image Pool (below)
          │
          ├─► [Curated Match Found?] ──► YES ──► Use Curated Image URL
          │
          ▼ NO
   3. Last-Resort Fallback: Structured Semantic SVG
       (ONLY when offline or no decent image exists online; NO stick figures)
\`\`\`

---

## 1. The "DECENT" Picture Standard

An image is considered **decent** for a TOEIC exam if and only if it satisfies all 4 criteria:

1. **Thematic Authenticity**: Depicts international business or workplace settings (e.g., conference rooms, customer service counters, retail stores, warehouses, airports, cafes, construction sites with safety equipment). Reject fantasy, cartoon, or abstract art.
2. **Compositional Density (Speaking Q3–4)**: Shows 1 or more discernible people performing clear actions (e.g., presenting, typing, inspecting inventory, conversing) across distinct foreground, midground, and background planes to enable rich spatial descriptions (*in front of*, *behind*, *to the left*).
3. **Keyword Compatibility (Writing Q1–5)**: Allows a candidate to naturally connect the two required prompt words (e.g., *negotiate / contract*, *customer / cashier*) in a single grammatical sentence without forced or contrived interpretation.
4. **Direct HTTPS Link**: Must be a direct link to an image file (e.g., ending in \`.jpg\`, \`.png\`, \`.webp\`, or a direct CDN URL such as \`https://images.unsplash.com/...\`), NEVER an HTML gallery or search results webpage.

---

## 2. Recommended Search Strategies

When using web search tools to find pictures, use targeted search patterns:

- **Office / Boardroom**: \`"business meeting colleagues discussion" site:unsplash.com\` or \`"office meeting" site:commons.wikimedia.org\`
- **Retail / Customer Service**: \`"cashier customer retail store" site:unsplash.com\`
- **Warehouse / Logistics**: \`"warehouse worker checking inventory" site:unsplash.com\`
- **Airport / Transit**: \`"airport terminal travelers luggage" site:unsplash.com\`
- **Construction / Architecture**: \`"engineers reviewing blueprints on site" site:unsplash.com\`
- **Hospitality / Dining**: \`"waiter serving food restaurant outdoor" site:unsplash.com\`

Direct CDN patterns:
- Unsplash: \`https://images.unsplash.com/photo-[ID]?auto=format&fit=crop&w=1000&q=80\`
- Wikimedia: \`https://upload.wikimedia.org/wikipedia/commons/[hash]/[hash]/[Filename].jpg\`
- Pexels: \`https://images.pexels.com/photos/[ID]/pexels-photo-[ID].jpeg?auto=compress&cs=tinysrgb&w=1000\`

---

## 3. Curated High-Availability Direct Image Pool

If web search is unavailable or returns ambiguous results, use these pre-approved direct URLs:

### Corporate & Office
- **Team Meeting around Table**:
  https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80
- **Presentation at Boardroom Screen**:
  https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1000&q=80
- **Colleagues Reviewing Laptop**:
  https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1000&q=80
- **Modern Office Workstation**:
  https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1000&q=80

### Retail, Service & Hospitality
- **Cashier Assisting Customer at Checkout**:
  https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1000&q=80
- **Barista Preparing Coffee behind Counter**:
  https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=80
- **Outdoor Dining & Restaurant Service**:
  https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80

### Industry, Logistics & Construction
- **Warehouse Worker Inspecting Inventory**:
  https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=80
- **Construction Engineers Examining Blueprints**:
  https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80
- **Factory Assembly Line Technician**:
  https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1000&q=80

### Travel & Transportation
- **Passengers in Airport Terminal with Suitcases**:
  https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&w=1000&q=80
- **Commuters on Transit Platform**:
  https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1000&q=80

---

## 4. Fallback SVG Restrictions (Strict Last Resort)

Generating raw inline SVG data URIs (\`data:image/svg+xml;utf8,...\`) is **strictly forbidden** unless you cannot access the internet or web search yielded zero usable pictures. If SVG fallback is unavoidable:
- It **must** have a responsive \`viewBox\` (e.g., \`0 0 800 500\`).
- It **must** feature layered, recognizable objects and figures in an office or commercial setting.
- Primitive stick figures, single-line boxes, and text-only placeholding diagrams are strictly prohibited.
`;

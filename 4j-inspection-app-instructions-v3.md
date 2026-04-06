# 4J Construction Property Inspection App - Development Instructions (v3)

## Project Overview

Build a property inspection Progressive Web App (PWA) for 4J Construction that allows inspectors to collect data on-site (even offline), review and refine with AI assistance at their desk, and generate professional PDF reports.

**Two Inspection Modes:**
- **Home Inspection** - Residential properties
- **Facility Inspection** - Government/Commercial properties

Both are functionally identical with different labels. The architecture supports adding mode-specific fields later if needed.

### Key Requirements
- **Offline-first architecture** - Must work fully without internet on iPad
- **PWA** - Installable on iPad home screen, feels like native app
- **Local data persistence** - IndexedDB for all inspection data and photos
- **Manual + automatic sync** - Explicit "Sync Now" button + sync on app open
- **AI integration (OpenAI via backend proxy)** - Clean up notes, generate summaries and recommendations
- **Desktop Review Mode** - Polish inspection data before report generation
- **Server-side PDF Generation** - Reliable, handles large photo counts
- **Touch-optimized** - Large tap targets, swipe gestures, iPad-friendly
- **Voice dictation support** - Easy voice input for field notes

### Photo Limits
- **Maximum ~100 photos per inspection**
- **Compressed storage**: 1920px max dimension, 80% JPEG quality
- **Show storage warnings** at 75 photos and 100 photos

---

## Two-Phase Workflow (Device-Enforced Separation)

### Phase 1: Field Collection (iPad Only, Works Offline)
Inspector is on-site collecting raw data:
1. Client & Property Information
2. Front facade photo
3. Building characteristics
4. Walk through each category, capturing:
   - Multiple observations per item (e.g., different walls)
   - Each observation has: grade, photos, raw notes (voice or typed)
5. Complete "Field Checklist" confirmation
6. Mark as "Field Complete" → triggers sync when online

**Device Enforcement**: When inspection status is `field-draft` or `field-complete`, only allow editing on mobile/tablet. Desktop shows read-only view with "Waiting for field sync" message.

### Phase 2: Desktop Review (Desktop/Laptop Only, Requires Online)
Inspector is at desk refining the report:
1. **AI Note Cleanup** - AI polishes raw field notes → Accept/Decline/Edit each (batch option available)
2. **AI Executive Summary** - Generated from all data → Accept/Edit/Request Revision/Write Own
3. **AI Recommendations** - Prioritized action items → Accept/Edit/Remove/Add Custom
4. **Final Review** - Verify everything, capture signature
5. **PDF Generation** - Server generates professional branded report

**Device Enforcement**: When inspection status is `review-in-progress` or later, only allow editing on desktop. Mobile shows read-only view with "Continue on desktop" message.

### Status Flow
```
field-draft → field-complete → review-in-progress → review-complete → report-generated
    │              │                   │                   │                │
    └── iPad ──────┘                   └───── Desktop ─────┴────────────────┘
```

---

## Technology Stack

### Frontend
- **React 18+** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **React Hook Form** for form handling
- **Workbox** for service worker/PWA functionality

### Data & Storage (Local)
- **Dexie.js** (IndexedDB wrapper) for structured data
- **Separate IndexedDB store** for photo blobs (keeps main DB lean)

### Backend (Supabase - Simplest Option)
- **Supabase Auth** - Email/password login for inspectors
- **Supabase Database** (PostgreSQL) - Cloud storage for inspections
- **Supabase Storage** - Object storage for photos
- **Supabase Edge Functions** - AI proxy (holds OpenAI key), PDF generation

### AI Integration
- **OpenAI API** (GPT-4o) via Supabase Edge Function proxy
- Frontend never sees API key

### PDF Generation
- **Server-side** via Supabase Edge Function
- **@react-pdf/renderer** running in Deno/Node environment
- Returns PDF as downloadable file

---

## Application Structure

```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── PhotoCapture.tsx
│   │   ├── GradeSelector.tsx
│   │   ├── TextField.tsx
│   │   ├── TextArea.tsx
│   │   ├── VoiceInputButton.tsx        # NEW: Voice dictation
│   │   ├── SelectField.tsx
│   │   ├── MultiSelect.tsx
│   │   ├── SyncStatusIndicator.tsx     # NEW: Sync status
│   │   ├── OfflineIndicator.tsx
│   │   ├── ProgressTracker.tsx
│   │   ├── StorageWarning.tsx          # NEW: Photo limit warnings
│   │   └── SignatureCapture.tsx
│   ├── inspection/
│   │   ├── ObservationCard.tsx
│   │   ├── ObservationList.tsx
│   │   ├── AddObservationButton.tsx
│   │   ├── EditObservationModal.tsx    # NEW: Edit existing
│   │   ├── DeleteConfirmation.tsx      # NEW: Delete confirmation
│   │   ├── PhotoGallery.tsx
│   │   ├── NotesList.tsx
│   │   ├── CategoryAccordion.tsx
│   │   ├── QuickNAButton.tsx           # NEW: Mark all N/A
│   │   └── FieldCompleteChecklist.tsx  # NEW: Pre-submit checklist
│   ├── review/
│   │   ├── AIReviewPanel.tsx
│   │   ├── NoteCleanupCard.tsx
│   │   ├── BatchCleanupButton.tsx      # NEW: Clean all notes
│   │   ├── CleanupProgressBar.tsx      # NEW: Batch progress
│   │   ├── AcceptDeclineButtons.tsx
│   │   ├── EditableTextBlock.tsx
│   │   ├── RevisionRequestInput.tsx
│   │   ├── SummaryReview.tsx
│   │   ├── RecommendationsReview.tsx
│   │   └── EmptyRecommendations.tsx    # NEW: No issues state
│   ├── sync/
│   │   ├── SyncManager.tsx             # NEW: Sync orchestration
│   │   ├── SyncButton.tsx              # NEW: Manual sync
│   │   ├── SyncQueue.tsx               # NEW: Queue display
│   │   └── ConflictWarning.tsx         # NEW: Device lock warning
│   ├── report/
│   │   ├── ReportPreview.tsx           # NEW: Preview before generate
│   │   ├── GenerateButton.tsx
│   │   └── DownloadButton.tsx
│   └── layout/
│       ├── AppShell.tsx
│       ├── Navigation.tsx
│       ├── Header.tsx
│       └── DeviceGate.tsx              # NEW: Enforce device rules
├── pages/
│   ├── Home.tsx
│   ├── Login.tsx                       # NEW: Auth
│   ├── NewInspection.tsx
│   ├── ClientInfo.tsx
│   ├── PropertyInfo.tsx
│   ├── BuildingData.tsx
│   ├── InspectionChecklist.tsx
│   ├── CategoryDetail.tsx
│   ├── FieldCompleteConfirm.tsx        # NEW: Checklist page
│   ├── DesktopReview.tsx
│   ├── NoteReview.tsx
│   ├── SummaryReview.tsx
│   ├── RecommendationsReview.tsx
│   ├── FinalReview.tsx
│   ├── ReportPreview.tsx
│   ├── InspectionList.tsx
│   └── Settings.tsx
├── hooks/
│   ├── useOffline.ts
│   ├── useCamera.ts
│   ├── usePhotoCompression.ts          # NEW
│   ├── useVoiceInput.ts                # NEW
│   ├── useInspection.ts
│   ├── useSync.ts
│   ├── useSyncQueue.ts                 # NEW
│   ├── useDeviceType.ts                # NEW
│   ├── useAI.ts
│   └── useAutoSave.ts
├── stores/
│   ├── inspectionStore.ts
│   ├── syncStore.ts                    # NEW
│   ├── reviewStore.ts
│   └── settingsStore.ts
├── db/
│   ├── database.ts
│   ├── photoStore.ts                   # NEW: Separate photo storage
│   ├── syncQueue.ts                    # NEW: Outbox queue
│   └── schema.ts
├── services/
│   ├── supabaseClient.ts               # NEW
│   ├── authService.ts                  # NEW
│   ├── syncService.ts                  # NEW
│   ├── aiService.ts                    # Calls Edge Function proxy
│   ├── pdfService.ts                   # Calls Edge Function
│   └── photoService.ts                 # NEW: Compression, upload
├── types/
│   └── inspection.ts
└── data/
    ├── inspectionCategories.ts
    ├── buildingOptions.ts
    └── reportLimitations.ts            # Placeholder for limitations text
```

---

## Data Models

### TypeScript Types

```typescript
// types/inspection.ts

export type InspectionType = 'home' | 'facility';
export type Grade = 'good' | 'fair' | 'poor' | 'na';
export type ReviewStatus = 'pending' | 'accepted' | 'declined' | 'edited';
export type InspectionStatus = 
  | 'field-draft' 
  | 'field-complete' 
  | 'review-in-progress' 
  | 'review-complete' 
  | 'report-generated';

export type SyncStatus = 'local' | 'queued' | 'syncing' | 'synced' | 'error';

// ============================================
// PHOTO MODEL (Stored separately from main data)
// ============================================

export interface Photo {
  id: string;                    // UUID
  inspectionId: string;
  observationId: string;
  
  // Local storage
  localBlobId?: string;          // Reference to IndexedDB blob store
  thumbnailBlobId?: string;      // Smaller version for UI
  
  // Cloud storage (after sync)
  storageKey?: string;           // Supabase Storage key
  storageUrl?: string;           // Public/signed URL
  
  // Metadata
  timestamp: Date;
  caption?: string;
  originalSize: number;          // Bytes, for tracking
  compressedSize: number;
  
  syncStatus: SyncStatus;
}

// ============================================
// NOTE MODEL
// ============================================

export interface Note {
  id: string;                    // UUID
  rawText: string;               // Original field note (typed or voice)
  inputMethod: 'typed' | 'voice';
  cleanedText?: string;          // AI-polished version
  reviewStatus: ReviewStatus;
  timestamp: Date;
}

// ============================================
// OBSERVATION MODEL (Core of inspection data)
// ============================================

export interface Observation {
  id: string;                    // UUID
  itemId: string;                // e.g., 'ext-foundation'
  grade: Grade;
  photoIds: string[];            // References to Photo records
  notes: Note[];
  timestamp: Date;
  updatedAt: Date;
}

// ============================================
// CLIENT INFORMATION
// ============================================

export interface ClientInfo {
  name: string;
  company?: string;
  email: string;
  phone: string;
}

// ============================================
// BUILDING DATA
// ============================================

export interface BuildingData {
  lotSize: string;
  buildingSize: string;
  yearBuilt: string;
  propertyType: string;                    // Single select
  foundationType: string;                  // Single select
  roofType: string;                        // Single select
  exteriorMaterials: string[];             // Multi-select
  ceilingStructure: string;                // Single select
  interiorWallMaterials: string[];         // Multi-select
  floorTypes: string[];                    // Multi-select (renamed for clarity)
  windowType: string;                      // Single select
  generatorType: string;                   // Single select
  rvParking: boolean;
  additionalParking: string;
  additionalFeatures: string;
}

// ============================================
// AI-GENERATED CONTENT
// ============================================

export interface AIContent {
  text: string;
  reviewStatus: ReviewStatus;
  revisionHistory: string[];
  lastFeedback?: string;
}

export interface Recommendation {
  id: string;                              // UUID
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  estimatedUrgency: string;
  reviewStatus: ReviewStatus;
}

// ============================================
// MAIN INSPECTION MODEL
// ============================================

export interface Inspection {
  id: string;                              // UUID
  type: InspectionType;
  status: InspectionStatus;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  fieldCompletedAt?: Date;
  reviewCompletedAt?: Date;
  reportGeneratedAt?: Date;
  
  // Device tracking (for conflict prevention)
  lastEditedByDeviceId: string;
  lastEditedByDeviceType: 'mobile' | 'desktop';
  
  // Sync
  syncStatus: SyncStatus;
  lastSyncedAt?: Date;
  version: number;                         // Increment on each save
  
  // Inspector Info
  inspectorId: string;                     // Supabase Auth user ID
  inspectorName: string;
  inspectorSignature?: string;             // Base64 data URL
  inspectionDate: Date;
  
  // Client Info
  clientInfo: ClientInfo;
  
  // Property Info
  propertyAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  facadePhotoId?: string;                  // Reference to Photo record
  
  // Building Data
  buildingData: BuildingData;
  
  // Observations (keyed by itemId, array for multiple observations)
  observations: Record<string, Observation[]>;
  
  // AI Generated Content (populated during review phase)
  executiveSummary?: AIContent;
  recommendations: Recommendation[];
  
  // Report
  reportStorageKey?: string;               // Supabase Storage key for PDF
  reportUrl?: string;
}

// ============================================
// SYNC QUEUE ITEM
// ============================================

export interface SyncQueueItem {
  id: string;                              // UUID
  inspectionId: string;
  action: 'create' | 'update' | 'upload-photo';
  payload: any;                            // The data to sync
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  errorMessage?: string;
  createdAt: Date;
}
```

---

## Inspection Categories Data

```typescript
// data/inspectionCategories.ts

export interface InspectionItemDef {
  id: string;
  name: string;
  categoryId: string;
}

export interface InspectionCategory {
  id: string;
  name: string;
  icon: string;
  limitations: string;
  items: InspectionItemDef[];
}

export const inspectionCategories: InspectionCategory[] = [
  {
    id: 'exterior',
    name: 'Exterior',
    icon: '🏠',
    limitations: 'The exterior inspection is limited to visible and accessible areas only. Areas concealed by vegetation, snow, stored items, or other obstructions were not inspected. Underground drainage systems, buried utilities, and structural elements below grade were not evaluated.',
    items: [
      { id: 'ext-foundation', name: 'Foundation', categoryId: 'exterior' },
      { id: 'ext-grading', name: 'Lot Grading & Drainage', categoryId: 'exterior' },
      { id: 'ext-driveways', name: 'Driveways/Walkways/Patios', categoryId: 'exterior' },
      { id: 'ext-decks', name: 'Decks/Porches/Stairs/Railings', categoryId: 'exterior' },
      { id: 'ext-vegetation', name: 'Vegetation', categoryId: 'exterior' },
      { id: 'ext-parking', name: 'Parking Areas/Additional Structures', categoryId: 'exterior' },
      { id: 'ext-walls', name: 'Exterior Walls', categoryId: 'exterior' },
      { id: 'ext-windows', name: 'Windows', categoryId: 'exterior' },
      { id: 'ext-doors', name: 'Doors', categoryId: 'exterior' },
      { id: 'ext-other', name: 'Other', categoryId: 'exterior' },
    ]
  },
  {
    id: 'interior',
    name: 'Interior',
    icon: '🪑',
    limitations: 'The interior inspection is limited to visible and accessible areas. Furniture, stored items, and personal belongings were not moved. Areas behind walls, above ceilings, and below floors were not inspected. Cosmetic conditions are noted but not the primary focus of this inspection.',
    items: [
      { id: 'int-walls', name: 'Walls & Ceilings', categoryId: 'interior' },
      { id: 'int-floors', name: 'Floors & Transitions', categoryId: 'interior' },
      { id: 'int-stairs', name: 'Stairs / Railings', categoryId: 'interior' },
      { id: 'int-doors', name: 'Doors', categoryId: 'interior' },
      { id: 'int-windows', name: 'Windows', categoryId: 'interior' },
      { id: 'int-appliances', name: 'Built-in Appliances', categoryId: 'interior' },
      { id: 'int-other', name: 'Other', categoryId: 'interior' },
    ]
  },
  {
    id: 'roofing',
    name: 'Roofing',
    icon: '🏚️',
    limitations: 'The roof inspection was performed from ground level and/or accessible areas. Walking on the roof surface was limited based on safety considerations, roof pitch, and surface conditions. Roof covering life expectancy estimates are approximations only. Hidden damage beneath roofing materials cannot be detected without removal.',
    items: [
      { id: 'roof-material', name: 'Roofing Material', categoryId: 'roofing' },
      { id: 'roof-gutters', name: 'Gutters & Downspouts', categoryId: 'roofing' },
      { id: 'roof-flashing', name: 'Flashing', categoryId: 'roofing' },
      { id: 'roof-penetrations', name: 'Skylights / Chimneys / Roof Penetrations', categoryId: 'roofing' },
      { id: 'roof-other', name: 'Other', categoryId: 'roofing' },
    ]
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🚿',
    limitations: 'The plumbing inspection is limited to visible and accessible components only. Pipes concealed within walls, floors, ceilings, or underground were not inspected. Water quality, flow rate measurements, and well/septic systems require specialized testing not included in this inspection. Interior pipe conditions cannot be determined without camera inspection.',
    items: [
      { id: 'plumb-supply', name: 'Supply Line (visible)', categoryId: 'plumbing' },
      { id: 'plumb-heater', name: 'Water Heater', categoryId: 'plumbing' },
      { id: 'plumb-bibs', name: 'Exterior Hose Bibs', categoryId: 'plumbing' },
      { id: 'plumb-fixtures', name: 'Interior Faucets and Fixtures', categoryId: 'plumbing' },
      { id: 'plumb-other', name: 'Other', categoryId: 'plumbing' },
    ]
  },
  {
    id: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    limitations: 'The electrical inspection is limited to visible and accessible components. Wiring concealed within walls, ceilings, floors, and conduits was not inspected. Panel covers were removed where safe to do so. Low-voltage systems, security systems, and specialized circuits require evaluation by qualified specialists. This inspection does not constitute a code compliance evaluation.',
    items: [
      { id: 'elec-panel', name: 'Service Entry & Main Panel', categoryId: 'electrical' },
      { id: 'elec-subpanels', name: 'Sub Panels', categoryId: 'electrical' },
      { id: 'elec-breakers', name: 'Breakers / Fuses', categoryId: 'electrical' },
      { id: 'elec-wiring', name: 'Wiring', categoryId: 'electrical' },
      { id: 'elec-fixtures', name: 'Fixtures / Switches / Receptacles', categoryId: 'electrical' },
      { id: 'elec-gfci', name: 'GFCI / AFCI', categoryId: 'electrical' },
      { id: 'elec-other', name: 'Other', categoryId: 'electrical' },
    ]
  },
  {
    id: 'hvac',
    name: 'Heating and Cooling',
    icon: '🌡️',
    limitations: 'The HVAC inspection is limited to visible and accessible components and basic operational testing. Heat exchangers, internal components, and refrigerant levels require specialized equipment and licensed technicians to fully evaluate. Ductwork concealed within walls and ceilings was not inspected. Efficiency ratings and remaining useful life are estimates only.',
    items: [
      { id: 'hvac-heating', name: 'Heating System', categoryId: 'hvac' },
      { id: 'hvac-venting', name: 'Venting / Flues / Chimney', categoryId: 'hvac' },
      { id: 'hvac-cooling', name: 'Cooling System', categoryId: 'hvac' },
      { id: 'hvac-thermostat', name: 'Thermostat Operation', categoryId: 'hvac' },
      { id: 'hvac-other', name: 'Other', categoryId: 'hvac' },
    ]
  },
  {
    id: 'insulation',
    name: 'Insulation & Ventilation',
    icon: '🧊',
    limitations: 'The insulation inspection is limited to visible and accessible areas, primarily the attic and crawlspace where accessible. Insulation within walls cannot be evaluated without invasive testing. R-value estimates are visual approximations. Vapor barrier inspection is limited to visible areas of crawlspaces.',
    items: [
      { id: 'ins-attic', name: 'Attic Insulation', categoryId: 'insulation' },
      { id: 'ins-crawlspace', name: 'Crawlspace Insulation', categoryId: 'insulation' },
      { id: 'ins-ventilation', name: 'Ventilation', categoryId: 'insulation' },
      { id: 'ins-vapor', name: 'Vapor Barriers', categoryId: 'insulation' },
      { id: 'ins-other', name: 'Other', categoryId: 'insulation' },
    ]
  },
  {
    id: 'fireplace',
    name: 'Fireplaces & Fuel Burning Appliances',
    icon: '🔥',
    limitations: 'The fireplace and fuel-burning appliance inspection is limited to visible components. Flue interiors, chimney liner conditions, and internal combustion chambers require specialized camera inspection by a certified chimney sweep. Gas connections should be evaluated by a licensed plumber or gas technician. Fires were not started during this inspection.',
    items: [
      { id: 'fire-firebox', name: 'Firebox', categoryId: 'fireplace' },
      { id: 'fire-chimney', name: 'Chimney / Vent Visible', categoryId: 'fireplace' },
      { id: 'fire-dampers', name: 'Dampers / Accessories', categoryId: 'fireplace' },
      { id: 'fire-other', name: 'Other', categoryId: 'fireplace' },
    ]
  },
  {
    id: 'safety',
    name: 'Safety & Misc.',
    icon: '🛡️',
    limitations: 'The safety inspection includes visual verification of detector presence and basic testing where accessible. Battery conditions and sensor calibration require specialized testing. Security system functionality should be verified with the monitoring company. Environmental hazards such as mold, asbestos, radon, and lead require specialized testing not included in this inspection.',
    items: [
      { id: 'safe-detectors', name: 'Smoke / CO Detectors', categoryId: 'safety' },
      { id: 'safe-security', name: 'Security Systems', categoryId: 'safety' },
      { id: 'safe-other', name: 'Other', categoryId: 'safety' },
    ]
  },
];
```

---

## Building Data Options

```typescript
// data/buildingOptions.ts

export const propertyTypes = [
  'Single Family',
  'Multi-Family',
  'Townhouse',
  'Condominium',
  'Mobile Home',
  'Commercial',
  'Industrial',
  'Mixed Use',
  'Government',
  'Other'
];

export const foundationTypes = [
  'Slab on Grade',
  'Crawlspace',
  'Full Basement',
  'Partial Basement',
  'Pier and Beam',
  'Raised Foundation',
  'Other'
];

export const roofTypes = [
  'Asphalt Shingle',
  'Metal',
  'Tile (Clay/Concrete)',
  'Slate',
  'Wood Shake/Shingle',
  'Flat/Built-Up',
  'TPO/EPDM',
  'Other'
];

export const exteriorMaterials = [
  'Vinyl Siding',
  'Wood Siding',
  'Fiber Cement',
  'Brick',
  'Stone',
  'Stucco',
  'Metal',
  'EIFS',
  'Other'
];

export const ceilingStructures = [
  'Drywall',
  'Plaster',
  'Drop/Suspended',
  'Exposed Beams',
  'Tongue and Groove',
  'Other'
];

export const interiorWallMaterials = [
  'Drywall',
  'Plaster',
  'Wood Paneling',
  'Concrete Block',
  'Other'
];

export const floorTypes = [
  'Hardwood',
  'Laminate',
  'Vinyl/LVP',
  'Tile',
  'Carpet',
  'Concrete',
  'Other'
];

export const windowTypes = [
  'Single Pane',
  'Double Pane',
  'Triple Pane',
  'Single Hung',
  'Double Hung',
  'Casement',
  'Sliding',
  'Other'
];

export const generatorTypes = [
  'None',
  'Portable',
  'Standby (Natural Gas)',
  'Standby (Propane)',
  'Standby (Diesel)',
  'Solar with Battery',
  'Other'
];
```

---

## Report Limitations (Placeholder)

```typescript
// data/reportLimitations.ts

/**
 * PLACEHOLDER: Client to provide general report limitations text.
 * This text appears on the Report Limitations page of the PDF.
 * 
 * Example structure:
 */

export const generalReportLimitations = `
[CLIENT TO PROVIDE]

This section should include:
- Scope of the inspection
- What is NOT included in the inspection
- Liability limitations
- Recommendations for specialized inspections
- Standards of practice reference
- Any state-specific disclosure requirements

Example text:
"This inspection is a visual examination of the accessible areas of the property 
at the time of inspection. This report is not a guarantee or warranty of any kind. 
The inspector is not required to move furniture, stored items, or any obstructions. 
Areas that were inaccessible, concealed, or not visible were not inspected..."
`;

// Section-specific limitations are defined in inspectionCategories.ts
```

---

## Sync Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         SYNC FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────────┐     ┌────────────────────┐   │
│  │  iPad    │     │   Sync       │     │    Supabase        │   │
│  │  (Field) │────▶│   Queue      │────▶│    Cloud           │   │
│  └──────────┘     │  (IndexedDB) │     │                    │   │
│       │           └──────────────┘     │  ┌──────────────┐  │   │
│       │                  │             │  │  Database    │  │   │
│       ▼                  │             │  │  (Postgres)  │  │   │
│  ┌──────────┐           │             │  └──────────────┘  │   │
│  │  Local   │           │             │                    │   │
│  │  Storage │           │             │  ┌──────────────┐  │   │
│  │(IndexedDB)│          │             │  │  Storage     │  │   │
│  └──────────┘           │             │  │  (Photos)    │  │   │
│                         │             │  └──────────────┘  │   │
│                         │             │                    │   │
│                         ▼             │  ┌──────────────┐  │   │
│  ┌──────────┐     ┌──────────────┐   │  │  Edge        │  │   │
│  │ Desktop  │◀────│   Pull on    │◀──│  │  Functions   │  │   │
│  │ (Review) │     │   App Open   │   │  │  (AI, PDF)   │  │   │
│  └──────────┘     └──────────────┘   │  └──────────────┘  │   │
│                                       └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Queue Implementation

```typescript
// db/syncQueue.ts

import Dexie from 'dexie';
import { SyncQueueItem } from '../types/inspection';

class SyncQueueDB extends Dexie {
  queue!: Dexie.Table<SyncQueueItem, string>;

  constructor() {
    super('4jSyncQueue');
    this.version(1).stores({
      queue: 'id, inspectionId, status, createdAt'
    });
  }
}

export const syncQueueDB = new SyncQueueDB();

// ============================================
// QUEUE OPERATIONS
// ============================================

export async function addToQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<string> {
  const id = crypto.randomUUID();
  await syncQueueDB.queue.add({
    ...item,
    id,
    status: 'queued',
    attempts: 0,
    createdAt: new Date()
  });
  return id;
}

export async function getQueuedItems(): Promise<SyncQueueItem[]> {
  return syncQueueDB.queue
    .where('status')
    .anyOf(['queued', 'failed'])
    .sortBy('createdAt');
}

export async function markInProgress(id: string): Promise<void> {
  await syncQueueDB.queue.update(id, { 
    status: 'in-progress',
    lastAttempt: new Date()
  });
}

export async function markCompleted(id: string): Promise<void> {
  await syncQueueDB.queue.update(id, { status: 'completed' });
}

export async function markFailed(id: string, error: string): Promise<void> {
  const item = await syncQueueDB.queue.get(id);
  if (item) {
    await syncQueueDB.queue.update(id, {
      status: 'failed',
      attempts: item.attempts + 1,
      errorMessage: error,
      lastAttempt: new Date()
    });
  }
}

export async function clearCompleted(): Promise<void> {
  await syncQueueDB.queue.where('status').equals('completed').delete();
}

export async function getQueueStats(): Promise<{
  queued: number;
  inProgress: number;
  failed: number;
  completed: number;
}> {
  const all = await syncQueueDB.queue.toArray();
  return {
    queued: all.filter(i => i.status === 'queued').length,
    inProgress: all.filter(i => i.status === 'in-progress').length,
    failed: all.filter(i => i.status === 'failed').length,
    completed: all.filter(i => i.status === 'completed').length,
  };
}
```

### Sync Service

```typescript
// services/syncService.ts

import { supabase } from './supabaseClient';
import { 
  addToQueue, 
  getQueuedItems, 
  markInProgress, 
  markCompleted, 
  markFailed 
} from '../db/syncQueue';
import { inspectionDB } from '../db/database';
import { photoStore } from '../db/photoStore';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff

// ============================================
// SYNC TRIGGERS
// ============================================

export function initSyncListeners() {
  // Sync on app open / resume
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      processQueue();
    }
  });

  // Sync when coming online
  window.addEventListener('online', () => {
    processQueue();
  });
}

// ============================================
// MANUAL SYNC
// ============================================

export async function syncNow(): Promise<{ success: boolean; errors: string[] }> {
  if (!navigator.onLine) {
    return { success: false, errors: ['No internet connection'] };
  }
  
  return processQueue();
}

// ============================================
// QUEUE PROCESSOR
// ============================================

async function processQueue(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  const items = await getQueuedItems();
  
  for (const item of items) {
    // Skip if too many retries
    if (item.attempts >= MAX_RETRIES) {
      continue;
    }
    
    try {
      await markInProgress(item.id);
      
      switch (item.action) {
        case 'create':
        case 'update':
          await syncInspection(item.payload);
          break;
        case 'upload-photo':
          await uploadPhoto(item.payload);
          break;
      }
      
      await markCompleted(item.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${item.action} failed: ${errorMsg}`);
      await markFailed(item.id, errorMsg);
      
      // Wait before next item (backoff)
      const delay = RETRY_DELAYS[Math.min(item.attempts, RETRY_DELAYS.length - 1)];
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return { 
    success: errors.length === 0, 
    errors 
  };
}

// ============================================
// INSPECTION SYNC
// ============================================

async function syncInspection(inspection: any): Promise<void> {
  const { data, error } = await supabase
    .from('inspections')
    .upsert({
      id: inspection.id,
      type: inspection.type,
      status: inspection.status,
      inspector_id: inspection.inspectorId,
      inspector_name: inspection.inspectorName,
      inspection_date: inspection.inspectionDate,
      client_info: inspection.clientInfo,
      property_address: inspection.propertyAddress,
      building_data: inspection.buildingData,
      observations: inspection.observations,
      executive_summary: inspection.executiveSummary,
      recommendations: inspection.recommendations,
      version: inspection.version,
      last_edited_by_device_id: inspection.lastEditedByDeviceId,
      last_edited_by_device_type: inspection.lastEditedByDeviceType,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id'
    });
  
  if (error) throw error;
}

// ============================================
// PHOTO UPLOAD
// ============================================

async function uploadPhoto(photoData: {
  photoId: string;
  inspectionId: string;
  localBlobId: string;
}): Promise<void> {
  // Get blob from local storage
  const blob = await photoStore.getBlob(photoData.localBlobId);
  if (!blob) throw new Error('Photo blob not found locally');
  
  // Upload to Supabase Storage
  const path = `inspections/${photoData.inspectionId}/${photoData.photoId}.jpg`;
  
  const { data, error } = await supabase.storage
    .from('inspection-photos')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('inspection-photos')
    .getPublicUrl(path);
  
  // Update photo record with storage info
  await inspectionDB.photos.update(photoData.photoId, {
    storageKey: path,
    storageUrl: urlData.publicUrl,
    syncStatus: 'synced'
  });
}

// ============================================
// PULL FROM CLOUD
// ============================================

export async function pullInspection(inspectionId: string): Promise<any> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', inspectionId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function pullAllInspections(inspectorId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('inspector_id', inspectorId)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}
```

### Sync Status UI Component

```typescript
// components/sync/SyncStatusIndicator.tsx

import React from 'react';
import { useSyncStore } from '../../stores/syncStore';

export function SyncStatusIndicator() {
  const { queueStats, isSyncing, lastSyncTime } = useSyncStore();
  
  const pendingCount = queueStats.queued + queueStats.failed;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      {isSyncing ? (
        <>
          <span className="animate-spin">🔄</span>
          <span className="text-blue-600">Syncing...</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <span className="text-yellow-600">🟡</span>
          <span className="text-yellow-600">
            {pendingCount} pending
          </span>
        </>
      ) : (
        <>
          <span className="text-green-600">🟢</span>
          <span className="text-green-600">Synced</span>
        </>
      )}
      
      {queueStats.failed > 0 && (
        <span className="text-red-600 text-xs">
          ({queueStats.failed} failed)
        </span>
      )}
    </div>
  );
}
```

### Manual Sync Button

```typescript
// components/sync/SyncButton.tsx

import React, { useState } from 'react';
import { syncNow } from '../../services/syncService';
import { useSyncStore } from '../../stores/syncStore';

export function SyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { refreshStats } = useSyncStore();
  const isOnline = navigator.onLine;
  
  const handleSync = async () => {
    if (!isOnline) {
      alert('No internet connection. Please try again when online.');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await syncNow();
      if (!result.success) {
        alert(`Sync completed with errors:\n${result.errors.join('\n')}`);
      }
    } finally {
      setIsLoading(false);
      refreshStats();
    }
  };
  
  return (
    <button
      onClick={handleSync}
      disabled={isLoading || !isOnline}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg font-medium
        ${isOnline 
          ? 'bg-primary text-white hover:bg-primary-dark' 
          : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
      `}
    >
      {isLoading ? (
        <>
          <span className="animate-spin">🔄</span>
          Syncing...
        </>
      ) : (
        <>
          <span>☁️</span>
          Sync Now
        </>
      )}
    </button>
  );
}
```

---

## Photo Service (Compression & Storage)

```typescript
// services/photoService.ts

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;
const THUMBNAIL_SIZE = 200;

// ============================================
// COMPRESSION
// ============================================

export async function compressPhoto(file: File | Blob): Promise<{
  fullSize: Blob;
  thumbnail: Blob;
  originalSize: number;
  compressedSize: number;
}> {
  const originalSize = file.size;
  
  // Create image from file
  const img = await createImageFromBlob(file);
  
  // Compress full size
  const fullSize = await resizeAndCompress(img, MAX_DIMENSION, JPEG_QUALITY);
  
  // Create thumbnail
  const thumbnail = await resizeAndCompress(img, THUMBNAIL_SIZE, 0.7);
  
  return {
    fullSize,
    thumbnail,
    originalSize,
    compressedSize: fullSize.size
  };
}

async function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

async function resizeAndCompress(
  img: HTMLImageElement, 
  maxDimension: number, 
  quality: number
): Promise<Blob> {
  // Calculate new dimensions
  let { width, height } = img;
  
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = (height / width) * maxDimension;
      width = maxDimension;
    } else {
      width = (width / height) * maxDimension;
      height = maxDimension;
    }
  }
  
  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  
  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Failed to compress')),
      'image/jpeg',
      quality
    );
  });
}

// ============================================
// STORAGE TRACKING
// ============================================

export async function getStorageUsage(inspectionId: string): Promise<{
  photoCount: number;
  totalBytes: number;
  percentOfLimit: number;
}> {
  const photos = await inspectionDB.photos
    .where('inspectionId')
    .equals(inspectionId)
    .toArray();
  
  const totalBytes = photos.reduce((sum, p) => sum + (p.compressedSize || 0), 0);
  const photoCount = photos.length;
  
  // Assume ~2MB average per compressed photo, 100 photo limit = ~200MB
  const estimatedLimit = 100 * 2 * 1024 * 1024; // 200MB
  const percentOfLimit = (totalBytes / estimatedLimit) * 100;
  
  return { photoCount, totalBytes, percentOfLimit };
}

// ============================================
// CONVERT BLOB TO BASE64 (for PDF generation)
// ============================================

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### Storage Warning Component

```typescript
// components/common/StorageWarning.tsx

import React from 'react';

interface StorageWarningProps {
  photoCount: number;
  maxPhotos?: number;
}

export function StorageWarning({ photoCount, maxPhotos = 100 }: StorageWarningProps) {
  if (photoCount < 75) return null;
  
  const isAtLimit = photoCount >= maxPhotos;
  const isNearLimit = photoCount >= 75 && photoCount < maxPhotos;
  
  return (
    <div className={`
      p-3 rounded-lg mb-4 flex items-center gap-2
      ${isAtLimit ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}
    `}>
      <span>{isAtLimit ? '🚫' : '⚠️'}</span>
      <span>
        {isAtLimit 
          ? `Photo limit reached (${photoCount}/${maxPhotos}). Delete some photos to add more.`
          : `Approaching photo limit (${photoCount}/${maxPhotos}).`
        }
      </span>
    </div>
  );
}
```

---

## Voice Input Integration

The simplest approach is to leverage iOS's built-in dictation. We'll create a component that:
1. Shows a prominent microphone button
2. Focuses the textarea and triggers dictation-ready state
3. Works with iOS's native speech-to-text

```typescript
// hooks/useVoiceInput.ts

import { useRef, useCallback } from 'react';

/**
 * Hook to facilitate voice input on iOS/iPadOS.
 * 
 * Strategy: Focus the textarea, which makes the iOS keyboard appear.
 * User can then tap the microphone button on the iOS keyboard to dictate.
 * 
 * We also set inputMode and add visual cues to make this obvious.
 */
export function useVoiceInput() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const triggerVoiceInput = useCallback(() => {
    if (inputRef.current) {
      // Focus the input to bring up keyboard
      inputRef.current.focus();
      
      // On iOS, this should position cursor at end
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, []);
  
  return {
    inputRef,
    triggerVoiceInput
  };
}
```

```typescript
// components/common/VoiceInputButton.tsx

import React from 'react';

interface VoiceInputButtonProps {
  onPress: () => void;
  isListening?: boolean;
}

/**
 * Large, prominent button that indicates voice input is available.
 * On press, focuses the associated textarea so user can use iOS dictation.
 */
export function VoiceInputButton({ onPress, isListening }: VoiceInputButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`
        w-14 h-14 rounded-full flex items-center justify-center
        transition-all duration-200
        ${isListening 
          ? 'bg-red-500 text-white animate-pulse' 
          : 'bg-primary text-white hover:bg-primary-dark active:scale-95'}
      `}
      aria-label="Voice input - tap to dictate"
    >
      <svg 
        className="w-6 h-6" 
        fill="currentColor" 
        viewBox="0 0 24 24"
      >
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    </button>
  );
}
```

```typescript
// components/inspection/NoteInput.tsx

import React, { useState } from 'react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { VoiceInputButton } from '../common/VoiceInputButton';

interface NoteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder?: string;
}

export function NoteInput({ value, onChange, onSave, placeholder }: NoteInputProps) {
  const { inputRef, triggerVoiceInput } = useVoiceInput();
  const [inputMethod, setInputMethod] = useState<'typed' | 'voice'>('typed');
  
  const handleVoicePress = () => {
    setInputMethod('voice');
    triggerVoiceInput();
  };
  
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Add your observation notes..."}
          className="
            flex-1 p-3 border rounded-lg resize-none
            text-base leading-relaxed
            focus:ring-2 focus:ring-primary focus:border-primary
          "
          rows={3}
        />
        <div className="flex flex-col gap-2">
          <VoiceInputButton onPress={handleVoicePress} />
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">
          💡 Tap the mic, then use iOS keyboard dictation
        </span>
        <button
          onClick={onSave}
          disabled={!value.trim()}
          className="
            px-4 py-2 bg-primary text-white rounded-lg
            disabled:bg-gray-300 disabled:cursor-not-allowed
          "
        >
          Save Note
        </button>
      </div>
    </div>
  );
}
```

---

## Quick N/A Feature

```typescript
// components/inspection/QuickNAButton.tsx

import React, { useState } from 'react';

interface QuickNAButtonProps {
  categoryName: string;
  itemCount: number;
  onMarkAllNA: () => void;
  onUndo: () => void;
}

export function QuickNAButton({ 
  categoryName, 
  itemCount, 
  onMarkAllNA, 
  onUndo 
}: QuickNAButtonProps) {
  const [showUndo, setShowUndo] = useState(false);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const handleMarkAll = () => {
    onMarkAllNA();
    setShowUndo(true);
    
    // Auto-hide undo after 10 seconds
    const timeout = setTimeout(() => {
      setShowUndo(false);
    }, 10000);
    setUndoTimeout(timeout);
  };
  
  const handleUndo = () => {
    if (undoTimeout) clearTimeout(undoTimeout);
    onUndo();
    setShowUndo(false);
  };
  
  if (showUndo) {
    return (
      <button
        onClick={handleUndo}
        className="
          w-full p-3 bg-yellow-100 text-yellow-800 rounded-lg
          flex items-center justify-center gap-2
          border-2 border-yellow-300
        "
      >
        <span>↩️</span>
        <span>Undo - Marked {itemCount} items as N/A</span>
      </button>
    );
  }
  
  return (
    <button
      onClick={handleMarkAll}
      className="
        w-full p-3 bg-gray-100 text-gray-600 rounded-lg
        flex items-center justify-center gap-2
        hover:bg-gray-200 active:bg-gray-300
      "
    >
      <span>⚡</span>
      <span>Mark all {categoryName} items as N/A</span>
    </button>
  );
}
```

---

## Field Complete Checklist

```typescript
// components/inspection/FieldCompleteChecklist.tsx

import React from 'react';
import { Inspection } from '../../types/inspection';
import { inspectionCategories } from '../../data/inspectionCategories';

interface FieldCompleteChecklistProps {
  inspection: Inspection;
  onComplete: () => void;
  onBack: () => void;
}

interface ChecklistItem {
  label: string;
  isComplete: boolean;
  isRequired: boolean;
}

export function FieldCompleteChecklist({ 
  inspection, 
  onComplete, 
  onBack 
}: FieldCompleteChecklistProps) {
  
  const checklistItems: ChecklistItem[] = [
    {
      label: 'Client information entered',
      isComplete: !!(inspection.clientInfo.name && inspection.clientInfo.email && inspection.clientInfo.phone),
      isRequired: true
    },
    {
      label: 'Property address entered',
      isComplete: !!(inspection.propertyAddress.street && inspection.propertyAddress.city),
      isRequired: true
    },
    {
      label: 'Front facade photo captured',
      isComplete: !!inspection.facadePhotoId,
      isRequired: true
    },
    {
      label: 'Building data completed',
      isComplete: !!(inspection.buildingData.propertyType && inspection.buildingData.yearBuilt),
      isRequired: false
    },
    ...inspectionCategories.map(cat => {
      const hasObservations = cat.items.some(
        item => (inspection.observations[item.id]?.length || 0) > 0
      );
      return {
        label: `${cat.name} inspected`,
        isComplete: hasObservations,
        isRequired: false
      };
    })
  ];
  
  const requiredComplete = checklistItems
    .filter(i => i.isRequired)
    .every(i => i.isComplete);
  
  const completedCount = checklistItems.filter(i => i.isComplete).length;
  const totalCount = checklistItems.length;
  
  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Field Complete Checklist
      </h2>
      <p className="text-gray-600 mb-6">
        Review before marking this inspection as field complete.
      </p>
      
      <div className="bg-white rounded-lg border divide-y">
        {checklistItems.map((item, index) => (
          <div 
            key={index}
            className="flex items-center gap-3 p-4"
          >
            <span className={`text-xl ${item.isComplete ? 'text-green-500' : 'text-gray-300'}`}>
              {item.isComplete ? '✓' : '○'}
            </span>
            <span className={item.isComplete ? 'text-gray-900' : 'text-gray-500'}>
              {item.label}
            </span>
            {item.isRequired && !item.isComplete && (
              <span className="text-xs text-red-500 ml-auto">Required</span>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center text-gray-600">
        {completedCount} of {totalCount} items complete
      </div>
      
      <div className="mt-6 flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 p-4 bg-gray-100 text-gray-700 rounded-lg font-medium"
        >
          ← Back to Inspection
        </button>
        <button
          onClick={onComplete}
          disabled={!requiredComplete}
          className={`
            flex-1 p-4 rounded-lg font-medium
            ${requiredComplete 
              ? 'bg-primary text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
          `}
        >
          Mark Field Complete ✓
        </button>
      </div>
      
      {!requiredComplete && (
        <p className="mt-3 text-center text-red-500 text-sm">
          Complete all required items before proceeding
        </p>
      )}
    </div>
  );
}
```

---

## AI Service (Backend Proxy)

### Frontend Service (calls Edge Function)

```typescript
// services/aiService.ts

import { supabase } from './supabaseClient';
import { Inspection, Note, Recommendation } from '../types/inspection';

// ============================================
// NOTE CLEANUP (Single)
// ============================================

export async function cleanupNote(
  note: Note,
  context: {
    category: string;
    item: string;
    grade: string;
  }
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-cleanup-note', {
    body: {
      rawText: note.rawText,
      context
    }
  });
  
  if (error) throw error;
  return data.cleanedText;
}

// ============================================
// NOTE CLEANUP (Batch)
// ============================================

export async function cleanupNotesBatch(
  notes: Array<{
    noteId: string;
    rawText: string;
    context: { category: string; item: string; grade: string };
  }>
): Promise<Array<{ noteId: string; cleanedText: string }>> {
  const { data, error } = await supabase.functions.invoke('ai-cleanup-notes-batch', {
    body: { notes }
  });
  
  if (error) throw error;
  return data.results;
}

// ============================================
// EXECUTIVE SUMMARY
// ============================================

export async function generateExecutiveSummary(
  inspection: Inspection,
  feedback?: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-executive-summary', {
    body: {
      inspection: prepareInspectionForAI(inspection),
      feedback
    }
  });
  
  if (error) throw error;
  return data.summary;
}

// ============================================
// RECOMMENDATIONS
// ============================================

export async function generateRecommendations(
  inspection: Inspection,
  feedback?: string
): Promise<Recommendation[]> {
  const { data, error } = await supabase.functions.invoke('ai-recommendations', {
    body: {
      inspection: prepareInspectionForAI(inspection),
      feedback
    }
  });
  
  if (error) throw error;
  
  // Add IDs and default status
  return data.recommendations.map((rec: any) => ({
    ...rec,
    id: crypto.randomUUID(),
    reviewStatus: 'pending'
  }));
}

// ============================================
// HELPER
// ============================================

function prepareInspectionForAI(inspection: Inspection) {
  // Strip blobs and unnecessary data, keep relevant info
  return {
    type: inspection.type,
    inspectionDate: inspection.inspectionDate,
    propertyAddress: inspection.propertyAddress,
    buildingData: inspection.buildingData,
    observations: inspection.observations
  };
}
```

### Supabase Edge Function (Backend)

```typescript
// supabase/functions/ai-cleanup-note/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

serve(async (req) => {
  try {
    const { rawText, context } = await req.json();
    
    const systemPrompt = `You are a professional property inspector's assistant. Clean up and professionalize field notes while preserving all technical details.

Rules:
- Maintain all factual information exactly as stated
- Use professional, clear language
- Fix grammar and spelling
- Expand abbreviations
- Keep the same meaning and observations
- Do not add information that wasn't in the original
- Keep it concise but complete`;

    const userPrompt = `Clean up this field note for a property inspection report.

Category: ${context.category}
Item: ${context.item}
Grade: ${context.grade}

Original note:
"${rawText}"

Provide only the cleaned-up text, no explanations.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const cleanedText = data.choices[0].message.content.trim();

    return new Response(
      JSON.stringify({ cleanedText }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

```typescript
// supabase/functions/ai-recommendations/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { inspectionCategories } from '../_shared/inspectionCategories.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

serve(async (req) => {
  try {
    const { inspection, feedback } = await req.json();
    
    const systemPrompt = `You are a professional property inspector generating recommendations.

Guidelines:
- Prioritize safety issues as HIGH priority
- Most recommendations should advise hiring a licensed contractor/specialist
- Be specific about what type of professional to hire
- Include urgency timeframe
- Base recommendations only on items graded as "fair" or "poor"
- If all items are "good" or "N/A", return a single positive recommendation noting no immediate action needed
- Order by priority (High → Medium → Low)

Return a JSON object with this exact structure:
{
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "category": "Category name",
      "title": "Brief title",
      "description": "Detailed recommendation including what type of contractor to hire",
      "estimatedUrgency": "Immediate" | "Within 30 days" | "Within 6 months" | "Within 12 months" | "When convenient"
    }
  ]
}`;

    const inspectionData = formatInspectionData(inspection);
    
    let userPrompt = `Generate recommendations based on this inspection:

${inspectionData}`;

    if (feedback) {
      userPrompt += `

Inspector feedback for revision: "${feedback}"`;
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function formatInspectionData(inspection: any): string {
  const lines: string[] = [];
  
  lines.push(`TYPE: ${inspection.type === 'home' ? 'Residential' : 'Commercial/Facility'}`);
  lines.push(`DATE: ${new Date(inspection.inspectionDate).toLocaleDateString()}`);
  lines.push(`PROPERTY: ${inspection.propertyAddress.street}, ${inspection.propertyAddress.city}, ${inspection.propertyAddress.state}`);
  lines.push(`YEAR BUILT: ${inspection.buildingData.yearBuilt || 'Unknown'}`);
  lines.push(`PROPERTY TYPE: ${inspection.buildingData.propertyType || 'Unknown'}`);
  lines.push('');
  lines.push('FINDINGS:');
  
  for (const category of inspectionCategories) {
    const categoryFindings: string[] = [];
    
    for (const item of category.items) {
      const observations = inspection.observations[item.id] || [];
      
      for (const obs of observations) {
        const notes = obs.notes
          .map((n: any) => n.cleanedText || n.rawText)
          .join(' ');
        
        if (notes || obs.grade !== 'na') {
          categoryFindings.push(`  - ${item.name}: [${obs.grade.toUpperCase()}] ${notes}`);
        }
      }
    }
    
    if (categoryFindings.length > 0) {
      lines.push(`\n${category.name}:`);
      lines.push(...categoryFindings);
    }
  }
  
  return lines.join('\n');
}
```

---

## Server-Side PDF Generation

```typescript
// supabase/functions/generate-pdf/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderToBuffer } from 'https://esm.sh/@react-pdf/renderer@3';
import React from 'https://esm.sh/react@18';

// Import PDF document components (would be in _shared folder)
import { InspectionReportDocument } from '../_shared/pdfDocument.tsx';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  try {
    const { inspectionId } = await req.json();
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Fetch inspection data
    const { data: inspection, error: fetchError } = await supabase
      .from('inspections')
      .select('*')
      .eq('id', inspectionId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Fetch photos and convert to base64
    const photoIds = extractAllPhotoIds(inspection);
    const photosWithBase64 = await fetchPhotosAsBase64(supabase, photoIds);
    
    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(InspectionReportDocument, {
        inspection,
        photos: photosWithBase64
      })
    );
    
    // Upload PDF to storage
    const pdfPath = `reports/${inspectionId}/report-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('inspection-reports')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('inspection-reports')
      .getPublicUrl(pdfPath);
    
    // Update inspection record
    await supabase
      .from('inspections')
      .update({
        report_storage_key: pdfPath,
        report_url: urlData.publicUrl,
        report_generated_at: new Date().toISOString(),
        status: 'report-generated'
      })
      .eq('id', inspectionId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        reportUrl: urlData.publicUrl 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function extractAllPhotoIds(inspection: any): string[] {
  const ids: string[] = [];
  
  if (inspection.facade_photo_id) {
    ids.push(inspection.facade_photo_id);
  }
  
  for (const observations of Object.values(inspection.observations || {})) {
    for (const obs of observations as any[]) {
      ids.push(...(obs.photoIds || []));
    }
  }
  
  return ids;
}

async function fetchPhotosAsBase64(
  supabase: any, 
  photoIds: string[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  
  // Fetch photo records to get storage URLs
  const { data: photos } = await supabase
    .from('photos')
    .select('id, storage_key')
    .in('id', photoIds);
  
  for (const photo of photos || []) {
    if (photo.storage_key) {
      const { data } = await supabase.storage
        .from('inspection-photos')
        .download(photo.storage_key);
      
      if (data) {
        const buffer = await data.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        result[photo.id] = `data:image/jpeg;base64,${base64}`;
      }
    }
  }
  
  return result;
}
```

---

## Supabase Database Schema

```sql
-- supabase/migrations/001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Inspectors (uses Supabase Auth, this adds profile data)
CREATE TABLE inspector_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inspections
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('home', 'facility')),
  status TEXT NOT NULL DEFAULT 'field-draft' CHECK (status IN (
    'field-draft', 'field-complete', 'review-in-progress', 
    'review-complete', 'report-generated'
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  field_completed_at TIMESTAMPTZ,
  review_completed_at TIMESTAMPTZ,
  report_generated_at TIMESTAMPTZ,
  
  -- Device tracking
  last_edited_by_device_id TEXT,
  last_edited_by_device_type TEXT CHECK (last_edited_by_device_type IN ('mobile', 'desktop')),
  
  -- Sync
  version INTEGER DEFAULT 1,
  
  -- Inspector
  inspector_id UUID REFERENCES auth.users(id) NOT NULL,
  inspector_name TEXT NOT NULL,
  inspector_signature TEXT, -- Base64
  inspection_date DATE NOT NULL,
  
  -- Client info (JSONB for flexibility)
  client_info JSONB NOT NULL DEFAULT '{}',
  
  -- Property
  property_address JSONB NOT NULL DEFAULT '{}',
  facade_photo_id UUID,
  
  -- Building data
  building_data JSONB NOT NULL DEFAULT '{}',
  
  -- Observations (JSONB, keyed by item ID)
  observations JSONB NOT NULL DEFAULT '{}',
  
  -- AI content
  executive_summary JSONB,
  recommendations JSONB DEFAULT '[]',
  
  -- Report
  report_storage_key TEXT,
  report_url TEXT
);

-- Photos (separate table, references inspection)
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE NOT NULL,
  observation_id UUID, -- Can be null for facade photo
  
  storage_key TEXT, -- Supabase Storage path
  storage_url TEXT,
  
  caption TEXT,
  original_size INTEGER,
  compressed_size INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inspections_inspector ON inspections(inspector_id);
CREATE INDEX idx_inspections_status ON inspections(status);
CREATE INDEX idx_inspections_updated ON inspections(updated_at DESC);
CREATE INDEX idx_photos_inspection ON photos(inspection_id);

-- Row Level Security
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspector_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: Inspectors can only see their own data
CREATE POLICY "Inspectors can view own inspections"
  ON inspections FOR SELECT
  USING (auth.uid() = inspector_id);

CREATE POLICY "Inspectors can insert own inspections"
  ON inspections FOR INSERT
  WITH CHECK (auth.uid() = inspector_id);

CREATE POLICY "Inspectors can update own inspections"
  ON inspections FOR UPDATE
  USING (auth.uid() = inspector_id);

CREATE POLICY "Inspectors can view own photos"
  ON photos FOR SELECT
  USING (
    inspection_id IN (
      SELECT id FROM inspections WHERE inspector_id = auth.uid()
    )
  );

CREATE POLICY "Inspectors can insert own photos"
  ON photos FOR INSERT
  WITH CHECK (
    inspection_id IN (
      SELECT id FROM inspections WHERE inspector_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own profile"
  ON inspector_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON inspector_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Storage buckets (run via Supabase dashboard or API)
-- inspection-photos: For observation photos
-- inspection-reports: For generated PDFs
```

---

## Getting Started Commands

```bash
# Create new Vite React project
npm create vite@latest 4j-inspector -- --template react-ts

# Navigate to project
cd 4j-inspector

# Install core dependencies
npm install react-router-dom zustand dexie
npm install react-hook-form @hookform/resolvers zod

# Supabase client
npm install @supabase/supabase-js

# PWA support
npm install -D vite-plugin-pwa

# UI utilities
npm install clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Signature capture
npm install react-signature-canvas
npm install -D @types/react-signature-canvas

# Start development
npm run dev

# ============================================
# SUPABASE SETUP
# ============================================

# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize Supabase in project
supabase init

# Link to your project (get project ref from dashboard)
supabase link --project-ref YOUR_PROJECT_REF

# Push database migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy ai-cleanup-note
supabase functions deploy ai-cleanup-notes-batch
supabase functions deploy ai-executive-summary
supabase functions deploy ai-recommendations
supabase functions deploy generate-pdf

# Set secrets (OpenAI key)
supabase secrets set OPENAI_API_KEY=your_openai_key
```

---

## Environment Variables

```env
# .env.local (frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Supabase Edge Functions (set via CLI)
# OPENAI_API_KEY=your_openai_key (set via supabase secrets set)
```

---

## Summary

This v3 specification addresses all feedback and includes:

### Architecture Improvements
- ✅ Device-enforced workflow (iPad for field, Desktop for review)
- ✅ Manual "Sync Now" button + auto-sync on app open/resume
- ✅ Durable sync queue with retry/backoff
- ✅ Photos stored separately, uploaded to object storage
- ✅ Backend proxy for OpenAI (no exposed API keys)
- ✅ Server-side PDF generation

### Photo Handling
- ✅ Compression on capture (1920px, 80% JPEG)
- ✅ Thumbnail generation for UI
- ✅ 100 photo limit with warnings at 75/100
- ✅ Storage tracking and display

### UX Enhancements
- ✅ Voice dictation support (iOS keyboard integration)
- ✅ "Mark all N/A" quick action with undo
- ✅ Field Complete checklist before submission
- ✅ Batch note cleanup option
- ✅ Edit/delete observations
- ✅ Empty recommendations handling

### Data Model
- ✅ UUIDs throughout (no Date.now() collisions)
- ✅ Consistent single-select vs multi-select types
- ✅ Version tracking for sync
- ✅ Device tracking for conflict prevention
- ✅ Photos stored by reference, not embedded

### Backend (Supabase)
- ✅ Complete database schema with RLS
- ✅ Edge Functions for AI and PDF
- ✅ Storage buckets for photos and reports

**Build order recommendation:**
1. Basic field collection UI (offline)
2. Local storage (IndexedDB)
3. Supabase auth + sync
4. Photo capture + compression
5. Desktop review UI
6. AI integration
7. PDF generation

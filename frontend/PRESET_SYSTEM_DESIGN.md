# Preset System Design

## Overview

A flexible, user-configurable system for creating Works, Versions, and Assets with custom fields while maintaining type safety for core fields.

## Architecture

### 1. Core Schema + Metadata Pattern

**Core Fields** (strongly typed, always available):

- Work: `id`, `title`, `subtitle`, `authors`, `workType`, `topics`, `favorite`, etc.
- Version: `id`, `workId`, `versionNumber`, `year`, `publisher`, etc.
- Asset: `id`, `versionId`, `sha256`, `filename`, `assetType`, etc.

**Metadata Field** (flexible, user-defined):

```typescript
metadata?: Record<string, unknown>
```

Stores custom fields like:

- `abstract: string`
- `citationCount: number`
- `labNotebook: string`
- `confidenceRating: number`
- `custom_xyz: any`

### 2. Preset Entity

Defines **form templates** for creating entities.

```typescript
interface Preset {
  id: string;
  kind: "preset";
  name: string; // "Research Paper", "PhD Thesis", "Course Textbook"
  description?: string;
  icon?: string; // lucide icon name
  color?: string; // hex color

  // What entity type this preset is for
  targetEntity: "work" | "version" | "asset";

  // Configuration for core fields
  coreFieldConfig: {
    [fieldName: string]: {
      required: boolean;
      hidden?: boolean;
      defaultValue?: unknown;
      helpText?: string;
    };
  };

  // Custom fields to include
  customFields: CustomFieldDefinition[];

  // UI hints
  formLayout?: "single-column" | "two-column";
  fieldOrder?: string[];

  createdAt: string;
  updatedAt: string;
}

interface CustomFieldDefinition {
  key: string; // metadata key
  label: string; // Display name
  type:
    | "text"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "date"
    | "textarea";
  required: boolean;
  defaultValue?: unknown;
  helpText?: string;
  placeholder?: string;

  // For select/multiselect
  options?: Array<{ value: string; label: string }>;

  // Validation
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}
```

### 3. Default Presets

**Paper Preset:**

```typescript
{
  name: "Research Paper",
  targetEntity: "work",
  coreFieldConfig: {
    title: { required: true },
    subtitle: { required: false },
    authors: { required: true },
    workType: { required: true, defaultValue: "paper" },
    topics: { required: false },
  },
  customFields: [
    { key: "abstract", label: "Abstract", type: "textarea", required: false },
    { key: "doi", label: "DOI", type: "text", required: false },
    { key: "venue", label: "Venue/Conference", type: "text", required: false },
    { key: "citationCount", label: "Citation Count", type: "number", required: false },
  ]
}
```

**Textbook Preset:**

```typescript
{
  name: "Textbook",
  targetEntity: "work",
  coreFieldConfig: {
    title: { required: true },
    subtitle: { required: false },
    authors: { required: true },
    workType: { required: true, defaultValue: "textbook" },
  },
  customFields: [
    { key: "isbn", label: "ISBN", type: "text", required: false },
    { key: "courseLevel", label: "Course Level", type: "select",
      options: [
        { value: "undergraduate", label: "Undergraduate" },
        { value: "graduate", label: "Graduate" },
        { value: "advanced", label: "Advanced" }
      ]
    },
    { key: "prerequisites", label: "Prerequisites", type: "textarea", required: false },
  ]
}
```

**Thesis Preset:**

```typescript
{
  name: "PhD Thesis",
  targetEntity: "work",
  customFields: [
    { key: "institution", label: "Institution", type: "text", required: true },
    { key: "department", label: "Department", type: "text", required: false },
    { key: "advisor", label: "Advisor", type: "text", required: false },
    { key: "defenseDate", label: "Defense Date", type: "date", required: false },
  ]
}
```

## Implementation Plan

### Phase 1: Schema Updates

1. **Add metadata to existing schemas:**

   ```typescript
   // In src/schema/library.ts
   export const WorkSchema = z.object({
     // ... existing fields
     metadata: z.record(z.unknown()).optional(),
   });
   ```

2. **Create Preset schema:**

   ```typescript
   // In src/schema/presets.ts
   export const CustomFieldDefinitionSchema = z.object({
     /* ... */
   });
   export const PresetSchema = z.object({
     /* ... */
   });
   ```

3. **Update Dexie database:**
   ```typescript
   // Add presets table
   presets: "id, name, targetEntity, createdAt";
   ```

### Phase 2: Repository + Hooks

1. Create `src/repo/presets.ts` with CRUD operations
2. Create `src/hooks/usePresets.ts` with React Query hooks
3. Seed default presets on first run

### Phase 3: Dynamic Form Component

1. **PresetSelector**: Choose preset before creating entity
2. **DynamicForm**: Renders form based on preset configuration
   - Core fields (controlled by coreFieldConfig)
   - Custom fields (rendered from customFields)
   - Validation (Zod + custom rules)
3. **PresetManager**: UI to create/edit/delete presets

### Phase 4: Creation Flows

1. **Create Work from Blob:**
   - Select blob → Choose preset → Fill form → Create Work + Version + Asset
2. **Link Blob to Existing Work:**
   - Select blob → Choose work → Create Version + Asset
3. **Manual Work Creation:**
   - Choose preset → Fill form → Create Work

## Database Schema Changes

```typescript
// Add to Dexie
class LibraryDatabase extends Dexie {
  // ... existing tables
  presets!: EntityTable<Preset>;

  constructor() {
    super("LibraryDB");
    this.version(2).stores({
      // ... existing tables
      presets: "id, name, targetEntity, createdAt",
    });
  }
}
```

## UI Components

### 1. PresetSelector

```typescript
<PresetSelector
  targetEntity="work"
  onSelect={(preset) => setSelectedPreset(preset)}
/>
```

### 2. DynamicForm

```typescript
<DynamicForm
  preset={selectedPreset}
  initialData={blob} // Optional: pre-fill from blob metadata
  onSubmit={(data) => createWork(data)}
/>
```

### 3. PresetManager

```typescript
<PresetManager
  presets={presets}
  onCreatePreset={() => {}}
  onEditPreset={(id) => {}}
  onDeletePreset={(id) => {}}
/>
```

## Benefits

✅ **Type Safety**: Core fields remain strongly typed  
✅ **Flexibility**: Users can add any custom fields  
✅ **No Migrations**: Metadata is schemaless  
✅ **User-Defined**: Not hardcoded, fully customizable  
✅ **Validation**: Custom validation rules per field  
✅ **Reusable**: Same preset for multiple works  
✅ **Searchable**: Can index metadata fields  
✅ **Backward Compatible**: Existing works work without metadata

## Example Flow

### Creating a Paper from PDF Blob

1. User clicks "Link File" on orphaned PDF
2. System suggests: "Create new work" or "Link to existing"
3. User chooses "Create new work"
4. PresetSelector shows: Paper, Textbook, Thesis, Notes, Custom
5. User selects "Research Paper" preset
6. DynamicForm renders:

   ```
   Core Fields:
   - Title* (pre-filled from PDF metadata)
   - Authors* (pre-filled from PDF)
   - Work Type (defaulted to "paper")
   - Topics

   Custom Fields (from preset):
   - Abstract
   - DOI
   - Venue/Conference
   - Citation Count
   ```

7. User fills form, clicks "Create"
8. System creates:
   - Work (with core + metadata)
   - Version (with year from PDF)
   - Asset (with sha256 from blob)
9. Blob is now linked, disappears from orphaned section

## Migration Strategy

### Existing Works

- Work without metadata: Continue working normally
- Forms can still be rendered with default fields
- User can apply preset later to add custom fields

### Adding Metadata Later

```typescript
// Add custom fields to existing work
await updateWork(workId, {
  metadata: {
    abstract: "...",
    doi: "10.1234/5678",
  },
});
```

## Future Enhancements

- **Preset Sharing**: Import/export presets
- **Preset Inheritance**: Base preset + customization
- **Conditional Fields**: Show field X if field Y has value Z
- **Computed Fields**: Auto-calculate from other fields
- **Field Groups**: Organize fields into sections
- **Multi-step Forms**: Wizard-style forms for complex presets
- **AI-Assisted**: Suggest metadata from PDF content

## Summary

This preset system provides the perfect balance:

- **Strong typing** for essential library operations
- **Flexibility** for user-specific workflows
- **No breaking changes** to existing architecture
- **Extensible** for future enhancements

Ready to implement! 🚀

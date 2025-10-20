# Author System - Quick Reference

## For Users

### Adding Authors to Works

#### Method 1: Search and Select

1. Type author name in the "Authors" field
2. Select from dropdown of existing authors
3. Selected author appears as a chip

#### Method 2: Create New Author

1. Type author name in format:
   - "First Last" (e.g., "John Smith")
   - "Last, First" (e.g., "Smith, John")
   - With ORCID: "Smith, John (0000-0002-1825-0097)"
2. Press **Enter** or click "Create" button
3. Author is created and added

#### Method 3: Multiple Authors at Once

1. Type: `"Smith, John and Doe, Jane and Lee, Alice"`
2. Press **Enter**
3. All 3 authors created and added

#### Method 4: From BibTeX

1. Click "Add from bib" button
2. Paste BibTeX entry with `author = {Last1, First1 and Last2, First2}`
3. Authors automatically parsed and created

### Removing Authors

- Click the **X** button on any author chip

### Supported Name Formats

- `John Smith` → firstName: John, lastName: Smith
- `Smith, John` → firstName: John, lastName: Smith
- `Smith, John M.` → firstName: John, middleName: M., lastName: Smith
- `von Neumann, John` → firstName: John, lastName: von Neumann (particles preserved)
- `Jean-Pierre Martin` → Hyphenated names preserved

### ORCID Support

- Include ORCID in parentheses: `Smith, John (0000-0002-1825-0097)`
- ORCID used for deduplication
- Displayed in author chips and search results

## For Developers

### Creating Authors Programmatically

```typescript
import { findOrCreateAuthor } from "@/src/repo/authors";

// Smart deduplication - finds existing or creates new
const author = await findOrCreateAuthor({
  firstName: "John",
  lastName: "Smith",
  middleName: "M.",
  orcid: "0000-0002-1825-0097",
  affiliation: "MIT",
  contact: "jsmith@mit.edu",
});
```

### Using in React Components

```typescript
import { useAuthorsByIds } from '@/src/hooks/useAuthors';
import { AuthorInput } from '@/app/library/AuthorInput';

function MyComponent() {
  const [authorIds, setAuthorIds] = useState<string[]>([]);
  const { data: authors = [] } = useAuthorsByIds(authorIds);

  return (
    <AuthorInput
      value={authorIds}
      authors={authors}
      onChange={setAuthorIds}
    />
  );
}
```

### Parsing Names

```typescript
import { parseAuthorList, capitalizeName } from "@/src/utils/nameParser";

// Parse single author
const author = parseAuthorName("Smith, John M.");
// { firstName: "John", lastName: "Smith", middleName: "M." }

// Parse multiple authors
const authors = parseAuthorList("Smith, John and Doe, Jane");
// [
//   { firstName: "John", lastName: "Smith" },
//   { firstName: "Jane", lastName: "Doe" }
// ]

// Capitalize properly
capitalizeName("von neumann, john");
// "John von Neumann"
```

### Searching Authors

```typescript
import { useSearchAuthors } from "@/src/hooks/useAuthors";

const { searchQuery, setSearchQuery, results, isLoading } = useSearchAuthors(
  "smith",
  {
    limit: 10,
    debounceMs: 300,
  }
);
```

### Work Submission

```typescript
// In form submission
const workData = {
  title: "My Paper",
  authorIds: ["author-id-1", "author-id-2"], // Use authorIds, not authors
  // ... other fields
};
```

## API Reference

### Repository Functions

```typescript
// CRUD
createAuthor(data): Promise<Author>
getAuthor(id): Promise<Author | undefined>
getAuthors(ids): Promise<Author[]>
listAuthors(options?): Promise<Author[]>
updateAuthor(id, updates): Promise<void>
deleteAuthor(id): Promise<void>

// Search
searchAuthors(query, options?): Promise<Author[]>
searchAuthorsByOrcid(orcid): Promise<Author[]>

// Deduplication
findOrCreateAuthor(data): Promise<Author>

// Statistics
getAuthorStats(id): Promise<{ workCount, coAuthors }>
getWorksForAuthor(id): Promise<string[]>
```

### React Hooks

```typescript
// Queries
useAuthor(id)
useAuthorsByIds(ids)
useListAuthors(options?)
useSearchAuthors(query, options?)
useAuthorStats(id)

// Mutations
useCreateAuthor()
useUpdateAuthor()
useDeleteAuthor()
useFindOrCreateAuthor()

// Helpers
useAuthorList(initialIds?)
useAuthorAutocomplete(options?)
```

### Name Parser Functions

```typescript
parseAuthorName(input): ParsedAuthor
parseAuthorList(input): ParsedAuthor[]
capitalizeName(name): string
formatAuthorName(author, format): string
formatAuthorList(authors, options): string
```

## Database Schema

### Author Table

```typescript
{
  id: string;              // UUID
  kind: "author";          // Literal
  firstName: string;       // Required
  lastName: string;        // Required
  middleName?: string;     // Optional
  title?: string;          // e.g., "Dr.", "Prof."
  affiliation?: string;    // Institution
  contact?: string;        // Email
  orcid?: string;          // ORCID iD
  website?: string;        // URL
  bio?: string;            // Biography
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

### Indexes

- Primary: `id`
- Search: `lastName`, `firstName`, `orcid`, `affiliation`
- Timestamps: `createdAt`, `updatedAt`

### Work Integration

```typescript
{
  // ... other Work fields
  authorIds: string[];     // References to Author entities
  authors?: Person[];      // Legacy, for migration only
}
```

## Common Patterns

### Add Author with Form Validation

```typescript
const form = useForm({
  defaultValues: {
    authorIds: [],
  },
});

const findOrCreate = useFindOrCreateAuthor();

const handleAddAuthor = async (input: string) => {
  const parsed = parseAuthorList(input);

  for (const author of parsed) {
    const created = await findOrCreate.mutateAsync(author);
    form.setValue("authorIds", [...form.getValues("authorIds"), created.id]);
  }
};
```

### Display Author Names

```typescript
import { getAuthorFullName } from "@/src/schema/library";

// In component
const authorNames = authors.map(getAuthorFullName).join(", ");
```

### Search with Debouncing

```typescript
const [query, setQuery] = useState("");
const { results } = useSearchAuthors(query, {
  debounceMs: 300,
  limit: 10,
});

// results automatically debounced and limited
```

## Migration Notes

### Automatic Migration (v4 → v5)

On first load after update:

1. Creates `authors` table
2. Converts `Work.authors` strings to Author entities
3. Populates `Work.authorIds` with new IDs
4. Deduplicates by name (case-insensitive)
5. Preserves affiliation and ORCID if present

### Checking Migration Status

```typescript
// In browser DevTools
// Application → IndexedDB → DeepRecallDB → Check version
// Should show: version 5
```

## Troubleshooting

### "Author not found"

- Check if migration completed: IndexedDB version should be 5
- Try refreshing page to trigger migration

### "Duplicate authors created"

- Use `findOrCreateAuthor()` instead of `createAuthor()`
- Ensure ORCID or exact name match for deduplication

### "Name parsing incorrect"

- Check format: use "Last, First" or "First Last"
- Particles (von, van, de) should be lowercase
- Use commas for BibTeX format: "von Neumann, John"

### "Search not working"

- Ensure query is at least 1 character
- Search is case-insensitive
- Results limited to 10 by default (pass `limit` option)

## Best Practices

1. **Always use `findOrCreateAuthor`** for imports to avoid duplicates
2. **Store ORCIDs when available** for reliable deduplication
3. **Use AuthorInput component** in forms for consistent UX
4. **Parse names before creating** using `parseAuthorName()`
5. **Search before creating** to check for existing authors
6. **Use authorIds in Works**, not string-based authors
7. **Capitalize properly** using `capitalizeName()` for particles

## Examples

### Full Create Work Flow

```typescript
// 1. Parse BibTeX
const entry = parseBibtex(bibtexString);
const formValues = bibtexToWorkFormValues(entry);

// 2. Parse and create authors
const parsedAuthors = parseAuthorList(formValues.authors);
const authorIds = [];

for (const parsed of parsedAuthors) {
  const author = await findOrCreateAuthor(parsed);
  authorIds.push(author.id);
}

// 3. Create work
const work = await createWork({
  title: formValues.title,
  authorIds,
  // ... other fields
});
```

### Custom Author Search UI

```typescript
function AuthorSearch() {
  const { searchQuery, setSearchQuery, results, isLoading } = useAuthorAutocomplete({
    limit: 20,
    debounceMs: 200
  });

  return (
    <div>
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />
      {isLoading ? (
        <div>Searching...</div>
      ) : (
        <ul>
          {results.map(author => (
            <li key={author.id}>
              {getAuthorFullName(author)}
              {author.orcid && ` (${author.orcid})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Resources

- **Full Documentation**: `/frontend/AUTHOR_SYSTEM_SUMMARY.md`
- **Repository**: `/src/repo/authors.ts`
- **Hooks**: `/src/hooks/useAuthors.ts`
- **Name Parser**: `/src/utils/nameParser.ts`
- **Component**: `/app/library/AuthorInput.tsx`
- **Schema**: `/src/schema/library.ts`

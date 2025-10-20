# Author Library - User Guide

## Overview

The Author Library is a comprehensive management system for all authors in DeepRecall. It provides a centralized place to view, edit, create, and manage author information.

## Accessing the Author Library

Click the **"Authors"** button in the Library header (next to the Templates button).

## Features

### 1. **List View** (Default)

#### Search & Filter

- **Search Bar**: Search authors by name (first, last, or full name)
  - Real-time search with debouncing
  - Case-insensitive matching
  - Shows top 50 results

- **Sort Options**:
  - **Last Name** (default): Alphabetical by last name
  - **First Name**: Alphabetical by first name
  - **Recently Added**: Most recent first

#### Author Cards

Each author card displays:

- Full name (with title if present, e.g., "Dr. John Smith")
- Affiliation (institution/organization)
- ORCID identifier (if present)
- Number of connected works
- Edit button (pencil icon)

#### Actions

- **New Author**: Create a new author from scratch
- **Import from BibTeX**: Import authors from BibTeX code
- **Click any author**: Edit that author's details

---

### 2. **Edit View**

Accessible by clicking on any author in the list.

#### Connected Works Section

- Displays all works this author is connected to
- Shows up to 5 works, with "... and X more" for additional works
- **Important**: Authors can only be deleted if they have NO connections

#### Editable Fields

**Name Components**:

- **First Name** (required)
- **Last Name** (required)
- **Middle Name** (optional)
- **Title** (optional): e.g., Dr., Prof., PhD

**Professional Information**:

- **Affiliation** (optional): Institution or organization
- **ORCID** (optional): Standard format `0000-0002-1825-0097`
- **Contact** (optional): Email or other contact
- **Website** (optional): Must be valid URL

**Additional**:

- **Biography** (optional): Brief biography or description

#### Actions

- **Save Changes**: Update author information
- **Delete**: Remove author (only if no work connections)
- **Cancel**: Return to list without saving

---

### 3. **Create View**

Accessible via the "New Author" button.

#### Form

Same fields as Edit View, but all start empty.

#### Behavior

- First and Last Name are required
- All other fields are optional
- Auto-capitalizes names properly
- Handles particles (von, van, de, etc.)
- Creates new author and returns to list

---

### 4. **Import from BibTeX**

Accessible via the "Import from BibTeX" button.

#### How It Works

1. Paste any BibTeX entry containing an `author` field
2. System extracts and parses the author field
3. Creates or updates authors automatically
4. Shows import results (success/failure for each author)

#### Supported Formats

**Standard BibTeX**:

```bibtex
@article{key,
  author = {von Neumann, John and Turing, Alan M.},
  title = {Example},
}
```

**With ORCID**:

```bibtex
author = {Smith, John (0000-0002-1825-0097)}
```

#### Parsing Features

- Automatically handles "Last, First" format
- Handles "First Last" format
- Splits multiple authors by "and"
- Extracts ORCID from parentheses
- Auto-capitalizes names
- Preserves particles (von, van, de, etc.)
- **Deduplication**: If author already exists (by name or ORCID), updates instead of creating duplicate

#### Import Results

Shows for each author:

- ✓ Success: "John Smith" (green)
- ✗ Failed: "Jane Doe" (red, if error occurred)

---

## Smart Features

### Automatic Name Capitalization

The system intelligently capitalizes names:

- Standard: "john smith" → "John Smith"
- Hyphenated: "jean-pierre" → "Jean-Pierre"
- Particles: "von neumann" → "John von Neumann" (particles stay lowercase)

### Deduplication

Authors are automatically deduplicated:

1. **By ORCID**: Most reliable method
2. **By Full Name**: Case-insensitive exact match
3. **Updates Metadata**: If duplicate found, enriches with new info

### Connection Management

- View all works an author is connected to
- Authors with connections cannot be deleted
- Remove author from works first, then delete

---

## Use Cases

### Creating Authors in Work Forms

When creating a work, you can:

1. Search existing authors by typing
2. Create new authors inline
3. Add multiple authors with "and" separator
4. Example: "Smith, John and Doe, Jane" creates both

### Importing from BibTeX

1. Copy BibTeX entry from paper/website
2. Open Author Library → Import from BibTeX
3. Paste entry
4. Click "Import Authors"
5. All authors extracted and created/updated

### Managing Author Metadata

1. Open Author Library
2. Search for author
3. Click to edit
4. Add ORCID, affiliation, bio, etc.
5. Save changes

### Cleaning Up Duplicates

1. Find duplicate authors in list
2. Edit the one you want to keep
3. Add any missing info from duplicate
4. Delete the duplicate (must remove from works first)

---

## Tips & Best Practices

### ORCID Usage

- Always add ORCID when available
- Prevents duplicates across imports
- Standard format: `0000-0002-1825-0097`
- Find ORCIDs at: https://orcid.org

### Name Formatting

- Use "Last, First" for BibTeX imports
- System handles both formats
- Particles (von, van, de) preserved automatically
- Titles (Dr., Prof.) go in separate "Title" field

### Deduplication

- Import authors before creating works
- System automatically finds existing authors
- ORCID is most reliable identifier
- Name matching is case-insensitive

### Bulk Import

- Collect BibTeX entries for all papers
- Import authors from all entries
- Then create works and link to existing authors
- Saves time on manual author creation

---

## Keyboard Shortcuts

### List View

- Type to search (focus on search bar)
- Escape to clear search

### Edit/Create Forms

- Tab to navigate fields
- Enter to submit form
- Escape to cancel (same as Cancel button)

---

## Technical Details

### Data Storage

- Authors stored in local IndexedDB
- Persists across sessions
- Fast queries with indexes on:
  - firstName, lastName
  - ORCID
  - affiliation

### Search Performance

- Debounced (300ms delay)
- Searches firstName, lastName, middleName, fullName
- Ranks results by relevance:
  1. Exact matches
  2. Starts-with matches
  3. Contains matches
- Sorted alphabetically within each group

### Connections

- Works reference authors by ID
- Many-to-many relationship
- One work can have multiple authors
- One author can be in multiple works

---

## Troubleshooting

### "Cannot delete author" Error

**Cause**: Author is connected to one or more works.

**Solution**:

1. View connected works in edit screen
2. Edit each work to remove this author
3. Then return to author library and delete

### Import Fails

**Cause**: BibTeX format issue or no author field.

**Solution**:

- Ensure `author = {...}` field exists
- Check for proper braces/quotes
- Verify format: `Last, First and Last2, First2`

### Duplicate Authors

**Cause**: Created without ORCID or slight name variation.

**Solution**:

1. Add ORCID to both authors (if available)
2. Edit one author to merge info
3. Delete the duplicate

### Search Not Finding Author

**Cause**: Typo or different name format.

**Solution**:

- Try searching last name only
- Try first name only
- Check for particles (von, van, de)
- Browse all authors (clear search)

---

## Future Enhancements

Potential features for future versions:

- ORCID API integration (auto-fetch metadata)
- Author merging tool
- Co-author network visualization
- Export author database
- Bulk edit operations
- Author profiles with publication history

---

## Related Documentation

- [Author System Summary](./AUTHOR_SYSTEM_SUMMARY.md)
- [BibTeX Import Guide](./BIBTEX_IMPORT.md)
- [Work Creation Guide](./WORK_CREATION.md)

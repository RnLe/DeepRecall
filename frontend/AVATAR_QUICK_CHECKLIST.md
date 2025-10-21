# AuthorLibrary Redesign - Quick Checklist

## 📋 Step-by-Step Implementation

### Phase 1: Add Avatar Component (15 min)

- [ ] Open `/frontend/app/library/AuthorLibrary.tsx`
- [ ] Add imports at top:
  ```typescript
  import { Camera, LayoutGrid, List as ListIcon } from "lucide-react";
  import { ImageCropper } from "@/src/components/ImageCropper";
  import { useUploadAvatar, useDeleteAvatar } from "@/src/hooks/useAvatars";
  import type { CropRegion } from "@/src/schema/library";
  ```
- [ ] Copy `Avatar` component from examples file (lines 62-104)
- [ ] Test: Add `<Avatar author={author} />` somewhere to verify it works

### Phase 2: Add Display Mode Toggle (10 min)

- [ ] In main component, add state:
  ```typescript
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  type DisplayMode = "cards" | "list";
  ```
- [ ] Pass to AuthorListView props
- [ ] Add toggle buttons in toolbar (copy from examples)
- [ ] Test: Click toggle buttons, verify state changes (console.log)

### Phase 3: Calculate Work Stats (10 min)

- [ ] In AuthorListView, add the `authorWorkStats` useMemo (lines 8-23 of examples)
- [ ] Test: console.log(authorWorkStats) to see structure
- [ ] Expected: Map with authorId → {paper: 2, textbook: 1}

### Phase 4: Create Card Layout (30 min)

- [ ] Copy `AuthorCard` component from examples (lines 110-184)
- [ ] In AuthorListView, replace the list rendering with:
  ```typescript
  displayMode === "cards" ? (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {authors.map(author => (
        <AuthorCard
          key={author.id}
          author={author}
          workStats={authorWorkStats.get(author.id) || {}}
          onClick={() => onSelectAuthor(author.id)}
          onEditAvatar={() => onEditAvatar(author.id)}
        />
      ))}
    </div>
  ) : (
    // existing list code here
  )
  ```
- [ ] Test: View cards in grid, hover for camera icon

### Phase 5: Create List Mode (20 min)

- [ ] Create compact `AuthorListItem` component
- [ ] Replace "existing list code" from Phase 4 with list items
- [ ] Test: Toggle between modes, verify both work

### Phase 6: Add Avatar Editing (30 min)

- [ ] Add view state: `type View = "list" | "edit" | "create" | "import" | "avatar";`
- [ ] Create `AvatarEditView` component (copy from guide or examples)
- [ ] In main render, add:
  ```typescript
  {view === "avatar" && selectedAuthor && (
    <AvatarEditView
      author={selectedAuthor}
      onBack={() => setView("edit")}
      onUpdate={updateMutation.mutateAsync}
    />
  )}
  ```
- [ ] In AuthorEditView, add avatar section with edit button
- [ ] Test: Click "Edit Avatar", upload image, crop, save

### Phase 7: Polish & Test (20 min)

- [ ] Remove FileText icons from work counts
- [ ] Add serif italic styling to titles
- [ ] Test all flows:
  - [ ] Create author
  - [ ] Upload avatar
  - [ ] Edit avatar
  - [ ] Delete author (with avatar)
  - [ ] Toggle display modes
  - [ ] Search in both modes
- [ ] Verify work stats show correct format

---

## 🎯 Total Time Estimate: ~2.5 hours

## 🔍 Quick Tests After Each Phase

### After Phase 1 (Avatar Component)

```bash
# Should see: Initials in gradient circle for authors without avatars
```

### After Phase 3 (Work Stats)

```javascript
// Browser console should show:
Map {
  "author-id-1" => {paper: 2, textbook: 1},
  "author-id-2" => {notes: 5}
}
```

### After Phase 4 (Card Layout)

```bash
# Should see: Grid of cards with avatars, hover shows camera icon
```

### After Phase 6 (Avatar Editing)

```bash
# Should be able to: Upload → Crop → Save → See avatar in card
```

---

## 📁 Files Reference

- **Main file to edit:** `/frontend/app/library/AuthorLibrary.tsx`
- **Examples to copy from:** `/frontend/AVATAR_INTEGRATION_EXAMPLES.tsx`
- **Full guide:** `/frontend/AVATAR_IMPLEMENTATION_GUIDE.md`
- **Summary:** `/frontend/AVATAR_SYSTEM_SUMMARY.md`

---

## 🚨 Common Issues & Fixes

| Issue                             | Fix                                                 |
| --------------------------------- | --------------------------------------------------- |
| "Cannot find module ImageCropper" | Check import path: `@/src/components/ImageCropper`  |
| "Cannot find module useAvatars"   | Check import path: `@/src/hooks/useAvatars`         |
| Images don't load                 | Check `/data/avatars/` exists, check API endpoint   |
| Database not updating             | Clear IndexedDB in DevTools, refresh page           |
| Avatar shows broken image         | Check `avatarDisplayPath` value, verify file exists |

---

## ✅ Success Criteria

You're done when:

- [ ] Authors display in card grid with avatars
- [ ] Toggle between cards/list modes works
- [ ] Work stats show "2 papers, 1 textbook" format (not "3 works")
- [ ] Can upload and crop avatars
- [ ] Can edit existing avatars (loads original with crop region)
- [ ] Titles show in serif italic font
- [ ] Camera icon appears on card hover
- [ ] Authors without avatars show initials in gradient
- [ ] Search works in both display modes
- [ ] Everything is responsive (mobile/tablet/desktop)

---

## 🎨 Visual Checklist

### Card Mode

```
┌─────────────────────────┐
│  [Avatar Circle 64px]   │  ← Camera icon on hover
│  John M. Doe            │
│  Dr., Prof.             │  ← Serif italic
│  🏢 MIT                  │  ← Building icon
│  ─────────────────────  │
│  2 papers, 1 textbook   │  ← By type!
│  📧 🌐                   │  ← Small icons
└─────────────────────────┘
```

### List Mode

```
[32px]  John M. Doe  Dr.  |  MIT  |  3 works
[32px]  Jane Smith   Prof.|  Stanford  |  5 works
```

---

Good luck! You have all the pieces – just assemble them following this checklist. 🚀

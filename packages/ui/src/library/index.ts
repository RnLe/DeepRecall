// Library Components
export { AuthorLibrary, type AuthorLibraryPlatformOps } from "./AuthorLibrary";
export {
  ActivityBanner,
  type ActivityBannerOperations,
} from "./ActivityBanner";
export { CASPanel } from "./CASPanel";
export { AuthorInput } from "./AuthorInput";
export { BibtexExportModal } from "./BibtexExportModal";
export {
  BibtexImportModal,
  type BibtexEntry,
  type ParseResult,
} from "./BibtexImportModal";
export { CompactDynamicForm } from "./CompactDynamicForm";
export { CreateActivityDialog } from "./CreateActivityDialog";
export { CreateWorkDialog } from "./CreateWorkDialog";
export { DuplicateResolutionModal } from "./DuplicateResolutionModal";
export { DynamicForm } from "./DynamicForm";
export { EditWorkDialog, type EditWorkDialogProps } from "./EditWorkDialog";
export { ExportDataDialog } from "./ExportDataDialog";
export { FieldRenderer } from "./FieldRenderer";
export { FileInbox, type FileInboxProps } from "./FileInbox";
export {
  ImportDataDialog,
  type ImportDataDialogProps,
  type ImportOperations,
} from "./ImportDataDialog";
export { InputModal } from "./InputModal";
export { LibraryFilters } from "./LibraryFilters";
export { LibraryHeader, type LibraryHeaderOperations } from "./LibraryHeader";
export {
  LibraryLeftSidebar,
  type LibraryLeftSidebarOperations,
} from "./LibraryLeftSidebar";
export { LinkBlobDialog } from "./LinkBlobDialog";
export { MessageModal } from "./MessageModal";
export { OrphanedBlobs } from "./OrphanedBlobs";
export { PDFPreviewModal, type PDFPreviewModalProps } from "./PDFPreviewModal";
export { PDFThumbnail, type PDFThumbnailProps } from "./PDFThumbnail";
export { PresetFormBuilder } from "./PresetFormBuilder";
export { PresetManager } from "./PresetManager";
export { PresetSelector } from "./PresetSelector";
export { QuickPresetDialog } from "./QuickPresetDialog";
export {
  TemplateEditorModal,
  type TemplateEditorModalProps,
} from "./TemplateEditorModal";
export { TemplateLibrary } from "./TemplateLibrary";
export {
  UnlinkedAssetsList,
  type UnlinkedAssetsListOperations,
} from "./UnlinkedAssetsList";
export {
  WorkCardCompact,
  type WorkCardCompactOperations,
} from "./WorkCardCompact";
export {
  WorkCardDetailed,
  type WorkCardDetailedOperations,
} from "./WorkCardDetailed";
export { WorkCardList, type WorkCardListOperations } from "./WorkCardList";
export { WorkSelector } from "./WorkSelector";

// Export sub-component types where needed
export type { BlobStats } from "./LibraryHeader";
export type { DuplicateGroup } from "./DuplicateResolutionModal";

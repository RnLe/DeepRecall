/**
 * @deeprecall/ui
 * Platform-agnostic UI components for DeepRecall
 */

// Library components
export {
  ActivityBanner,
  type ActivityBannerOperations,
} from "./library/ActivityBanner";
export * from "./library/AuthorAvatar";
export * from "./library/AuthorCard";
export * from "./library/AuthorCreateView";
export * from "./library/AuthorEditView";
export * from "./library/AuthorFormFields";
export * from "./library/AuthorImportView";
export { AuthorInput } from "./library/AuthorInput";
export { AuthorLibrary } from "./library/AuthorLibrary";
export { AuthorListView } from "./library/AuthorListView";
export * from "./library/BibtexExportModal";
export * from "./library/BibtexImportModal";
export * from "./library/AvatarEditView";
export { CompactDynamicForm } from "./library/CompactDynamicForm";
export { CreateActivityDialog } from "./library/CreateActivityDialog";
export * from "./library/CreateWorkDialog";
export { DynamicForm } from "./library/DynamicForm";
export * from "./library/EditWorkDialog";
export * from "./library/ExportDataDialog";
export { FieldRenderer } from "./library/FieldRenderer";
export * from "./library/FileInbox";
export * from "./library/ImportDataDialog";
export * from "./library/InputModal";
export { LibraryFilters } from "./library/LibraryFilters";
export type { ViewMode } from "./library/LibraryFilters";
export * from "./library/LibraryHeader";
export * from "./library/LibraryLeftSidebar";
export * from "./library/LinkBlobDialog";
export * from "./library/MessageModal";
export * from "./library/OrphanedBlobs";
export { PDFPreviewModal } from "./library/PDFPreviewModal";
export { PDFThumbnail } from "./library/PDFThumbnail";
export * from "./library/PresetFormBuilder";
export * from "./library/PresetManager";
export * from "./library/PresetSelector";
export * from "./library/QuickPresetDialog";
export * from "./library/TemplateEditorModal";
export * from "./library/TemplateLibrary";
export * from "./library/UnlinkedAssetsList";
export * from "./library/WorkCardCompact";
export * from "./library/WorkCardDetailed";
export * from "./library/WorkCardList";
export * from "./library/WorkContextMenu";
export * from "./library/WorkSelector";
export { CASPanel } from "./library/CASPanel";
export type { CASPanelOperations } from "./library/CASPanel";
export { DuplicateResolutionModal } from "./library/DuplicateResolutionModal";
export type {
  DuplicateGroup,
  DuplicateResolutionModalProps,
} from "./library/DuplicateResolutionModal";

// Reader components
export { AnnotationContextMenu } from "./reader/AnnotationContextMenu";
export { AnnotationEditor } from "./reader/AnnotationEditor";
export type {
  AnnotationEditorProps,
  AnnotationEditorOperations,
} from "./reader/AnnotationEditor";
export { AnnotationHandlers } from "./reader/AnnotationHandlers";
export { AnnotationList } from "./reader/AnnotationList";
export { AnnotationOverlay } from "./reader/AnnotationOverlay";
export type {
  AnnotationOverlayProps,
  AnnotationOverlayOperations,
} from "./reader/AnnotationOverlay";
export { AnnotationToolbar } from "./reader/AnnotationToolbar";
export { CompactNoteItem } from "./reader/CompactNoteItem";
export type {
  CompactNoteItemProps,
  CompactNoteItemOperations,
} from "./reader/CompactNoteItem";
export { CreateNoteDialog } from "./reader/CreateNoteDialog";
export type {
  CreateNoteDialogProps,
  CreateNoteDialogOperations,
} from "./reader/CreateNoteDialog";
export { CreateGroupDialog } from "./reader/annotation/CreateGroupDialog";
export type { CreateGroupDialogProps } from "./reader/annotation/CreateGroupDialog";
export { NoteBranch } from "./reader/annotation/NoteBranch";
export type {
  NoteBranchProps,
  NoteBranchOperations,
} from "./reader/annotation/NoteBranch";
export { NoteTreeView } from "./reader/annotation/NoteTreeView";
export type {
  NoteTreeViewProps,
  NoteTreeViewOperations,
} from "./reader/annotation/NoteTreeView";
export { AnnotationPreview } from "./reader/annotation/AnnotationPreview";
export type {
  AnnotationPreviewProps,
  AnnotationPreviewOperations,
} from "./reader/annotation/AnnotationPreview";
export { FileList } from "./reader/FileList";
export { PDFPage } from "./reader/PDFPage";
export type { PDFPageProps } from "./reader/PDFPage";
export { PDFScrollbar } from "./reader/PDFScrollbar";
export { NotePreview } from "./reader/NotePreview";
export type {
  NotePreviewProps,
  NotePreviewOperations,
} from "./reader/NotePreview";
export { NoteDetailModal } from "./reader/NoteDetailModal";
export type {
  NoteDetailModalProps,
  NoteDetailModalOperations,
} from "./reader/NoteDetailModal";
export { NoteSidebar } from "./reader/NoteSidebar";
export type {
  NoteSidebarProps,
  NoteSidebarOperations,
} from "./reader/NoteSidebar";
export { ReaderLayout } from "./reader/ReaderLayout";
export type {
  ReaderLayoutProps,
  AnnotationEditorComponentProps,
} from "./reader/ReaderLayout";
export { TabContent } from "./reader/TabContent";
export type {
  TabContentProps,
  TabContentOperations,
  PDFViewerComponentProps,
} from "./reader/TabContent";

// Admin components
export {
  DexieGraphVisualization,
  type DexieGraphVisualizationOperations,
  type DexieGraphVisualizationProps,
} from "./admin/DexieGraphVisualization";
export { LogViewerButton, LogViewerDialog } from "./admin/LogViewer";

// Whiteboard components (new architecture)
export * from "./whiteboard";

// Components
export * from "./components";

// Utils
export * from "./utils/presets";
export * from "./utils/date";

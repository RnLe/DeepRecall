/**
 * Reader page - VSCode-style PDF reader with tabs and sidebars
 */

"use client";

import { ReaderLayout } from "./ReaderLayout";
import { TabContent } from "./TabContent";

export default function ReaderPage() {
  return (
    <div className="h-full">
      <ReaderLayout>
        <TabContent />
      </ReaderLayout>
    </div>
  );
}

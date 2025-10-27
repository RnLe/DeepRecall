import { useMemo } from "react";
import { useWorks, useAssets } from "@deeprecall/data/hooks";
import type { WorkExtended } from "@deeprecall/core";
import { FileText, BookOpen } from "lucide-react";

export function SimpleLibraryView() {
  const { data: worksData, isLoading: worksLoading } = useWorks();
  const { data: assetsData } = useAssets();

  const works = useMemo(() => {
    if (!worksData || !assetsData) return [];

    return worksData.map((work): WorkExtended => {
      const workAssets = assetsData.filter((asset) => asset.workId === work.id);
      return {
        ...work,
        assets: workAssets,
      };
    });
  }, [worksData, assetsData]);

  if (worksLoading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading library...</p>
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#666",
        }}
      >
        <BookOpen size={48} style={{ margin: "0 auto 20px" }} />
        <h3>No works in library</h3>
        <p>Upload PDFs to get started</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "20px", color: "#333" }}>
        Library ({works.length} works)
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        {works.map((work) => {
          const pdfCount =
            work.assets?.filter((a) => a.mime?.includes("pdf")).length || 0;

          return (
            <div
              key={work.id}
              style={{
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "16px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#333",
                    flex: 1,
                  }}
                >
                  {work.title || "Untitled"}
                </h3>
                {work.year && (
                  <span style={{ color: "#666", fontSize: "14px" }}>
                    {work.year}
                  </span>
                )}
              </div>

              <div
                style={{
                  color: "#666",
                  fontSize: "14px",
                  marginBottom: "12px",
                }}
              >
                {work.authors && work.authors.length > 0
                  ? work.authors.map((a: any) => a.name).join(", ")
                  : "No authors"}
              </div>

              {pdfCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#667eea",
                    fontSize: "12px",
                  }}
                >
                  <FileText size={14} />
                  <span>
                    {pdfCount} PDF{pdfCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

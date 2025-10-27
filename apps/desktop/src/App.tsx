import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTauriBlobStorage } from "./hooks/useBlobStorage";
import { ElectricSyncTest } from "./components/ElectricSyncTest";
import { SimpleLibraryView } from "./components/SimpleLibraryView";
import { Providers } from "./providers";
import "./App.css";

function AppContent() {
  // Platform injection
  const cas = useTauriBlobStorage();
  const [testStatus, setTestStatus] = useState<string>("");
  const [blobStats, setBlobStats] = useState<any>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const testBlobStorage = async () => {
    try {
      setTestStatus("Testing blob storage...");

      // Test 1: Get blob stats
      const stats = await invoke("get_blob_stats");
      setBlobStats(stats);
      setTestStatus("✅ Blob storage is working! Check console for details.");
      console.log("Blob Stats:", stats);

      // Test 2: List blobs
      const blobs = await invoke("list_blobs", { orphanedOnly: false });
      console.log("Blobs:", blobs);

      // Test 3: Health check
      const health = await invoke("health_check");
      console.log("Health Check:", health);
    } catch (error) {
      setTestStatus(`❌ Error: ${error}`);
      console.error("Test failed:", error);
    }
  };

  const uploadFile = async () => {
    try {
      setUploadStatus("Opening file picker...");

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "PDF Files",
            extensions: ["pdf"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      if (!selected || typeof selected !== "string") {
        setUploadStatus("");
        return;
      }

      setUploadStatus(`Reading file...`);

      // Read file using Tauri's fs
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const contents = await readFile(selected);

      const filename = selected.split("/").pop() || "file";
      const file = new File([contents], filename, {
        type: "application/pdf",
      });

      setUploadStatus(`Uploading ${filename}...`);
      const result = await cas.put(file);

      setUploadStatus(
        `✅ Uploaded! Hash: ${result.sha256.substring(0, 16)}...`
      );
      console.log("Upload result:", result);

      await testBlobStorage();
    } catch (error) {
      setUploadStatus(`❌ Upload failed: ${error}`);
      console.error("Upload error:", error);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>DeepRecall Desktop</h1>
        <p>Welcome to DeepRecall - Your reference management companion</p>
      </header>

      <main className="app-main">
        {/* Electric Sync Test */}
        <ElectricSyncTest />

        {/* Library View */}
        <SimpleLibraryView />

        <div className="placeholder-content">
          <h2>🧪 Testing Controls</h2>

          <div style={{ margin: "20px 0" }}>
            <button
              onClick={testBlobStorage}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                marginRight: "10px",
              }}
            >
              🧪 Test Blob Storage
            </button>

            <button
              onClick={uploadFile}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                background: "linear-gradient(135deg, #42e695 0%, #3bb2b8 100%)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              📁 Upload File
            </button>

            {testStatus && (
              <p style={{ marginTop: "10px", fontWeight: "bold" }}>
                {testStatus}
              </p>
            )}
            {uploadStatus && (
              <p
                style={{
                  marginTop: "10px",
                  fontWeight: "bold",
                  color: "#3bb2b8",
                }}
              >
                {uploadStatus}
              </p>
            )}
            {blobStats && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px",
                  background: "#f0f0f0",
                  borderRadius: "8px",
                  textAlign: "left",
                }}
              >
                <strong>Storage Stats:</strong>
                <ul>
                  <li>Total Blobs: {blobStats.totalBlobs}</li>
                  <li>
                    Total Size: {(blobStats.totalSize / 1024 / 1024).toFixed(2)}{" "}
                    MB
                  </li>
                </ul>
              </div>
            )}
          </div>

          <p>Progress:</p>
          <ul
            style={{
              textAlign: "left",
              margin: "20px auto",
              maxWidth: "400px",
            }}
          >
            <li>✅ Tauri project initialized</li>
            <li>✅ Blob storage adapter created</li>
            <li>✅ Rust backend commands implemented</li>
            <li>✅ SQLite catalog database</li>
            <li>✅ Electric sync configured</li>
            <li>⏳ Integrate UI components from @deeprecall/ui</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}

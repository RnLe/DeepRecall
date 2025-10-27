import { useAssets, useWorks } from "@deeprecall/data/hooks";

/**
 * ElectricSyncTest - Verifies Electric sync is working
 * Displays real-time synced data from Postgres
 */
export function ElectricSyncTest() {
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: works = [], isLoading: worksLoading } = useWorks();

  if (assetsLoading || worksLoading) {
    return (
      <div
        style={{
          padding: "20px",
          background: "#f0f0f0",
          borderRadius: "8px",
          margin: "20px 0",
        }}
      >
        <h3>🔄 Electric Sync Status</h3>
        <p>Loading synced data...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        background: "#f0f0f0",
        borderRadius: "8px",
        margin: "20px 0",
      }}
    >
      <h3>✅ Electric Sync Connected</h3>
      <div style={{ marginTop: "10px" }}>
        <p>
          <strong>Assets:</strong> {assets.length} synced
        </p>
        <p>
          <strong>Works:</strong> {works.length} synced
        </p>
        <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
          💡 Data syncs in real-time from Docker Postgres via Electric
        </p>
      </div>
    </div>
  );
}

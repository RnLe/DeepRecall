import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Providers } from "./providers";
import { Layout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/library/LibraryPage";
import ReaderPage from "./pages/ReaderPage";
import StudyPage from "./pages/StudyPage";
import BoardsPage from "./pages/board/BoardsPage";
import BoardPage from "./pages/board/BoardPage";
import CASAdminPage from "./pages/admin/CASAdminPage";
import DexieAdminPage from "./pages/admin/DexieAdminPage";
import ElectricAdminPage from "./pages/admin/ElectricAdminPage";
import PostgresAdminPage from "./pages/admin/PostgresAdminPage";

function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="reader" element={<ReaderPage />} />
            <Route path="reader/:sha256" element={<ReaderPage />} />
            <Route path="study" element={<StudyPage />} />
            <Route path="board" element={<BoardsPage />} />
            <Route path="board/:id" element={<BoardPage />} />
            <Route path="admin/cas" element={<CASAdminPage />} />
            <Route path="admin/dexie" element={<DexieAdminPage />} />
            <Route path="admin/electric" element={<ElectricAdminPage />} />
            <Route path="admin/postgres" element={<PostgresAdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}

export default App;

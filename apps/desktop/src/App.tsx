import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Providers } from "./providers";
import { Layout } from "./components/Layout";
import LibraryPage from "./pages/LibraryPage";
import ReaderPage from "./pages/ReaderPage";
import StudyPage from "./pages/StudyPage";
import AdminPage from "./pages/AdminPage";
import "./globals.css";
import "katex/dist/katex.min.css";

function AppContent() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/reader" element={<ReaderPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}

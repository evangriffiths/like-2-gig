import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ArtistsPage } from "./pages/ArtistsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/artists" element={<ArtistsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

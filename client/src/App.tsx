import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ArtistsPage } from "./pages/ArtistsPage";
import { GigsPage } from "./pages/GigsPage";
import { Header } from "./components/Header";
import { SyncProvider } from "./contexts/SyncContext";

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SyncProvider>
      <Header />
      {children}
    </SyncProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/artists" element={<AuthedLayout><ArtistsPage /></AuthedLayout>} />
      <Route path="/gigs" element={<AuthedLayout><GigsPage /></AuthedLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

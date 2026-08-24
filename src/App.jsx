import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppShell from "./components/Layout/AppShell.jsx";
import Login from "./pages/Auth/Login.jsx";
import Register from "./pages/Auth/Register.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import ProgramListPage from "./pages/Programs/ProgramListPage.jsx";
import NewProgramPage from "./pages/Programs/NewProgramPage.jsx";
import SetupProgramPage from "./pages/Programs/SetupProgramPage.jsx";
import RunPage from "./pages/Run/RunPage.jsx";
import ImageLibraryPage from "./pages/ImageLibrary/ImageLibraryPage.jsx";
import LogsPage from "./pages/Logs/LogsPage.jsx";
import IOSettingsPage from "./pages/IOSettings/IOSettingsPage.jsx";
import ChatbotPage from "./pages/Chatbot/ChatbotPage.jsx";
import AccountPage from "./pages/Account/AccountPage.jsx";

function Shell({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />

      <Route path="/programs" element={<Shell><ProgramListPage /></Shell>} />
      <Route
        path="/programs/new"
        element={
          <ProtectedRoute engineerOnly>
            <AppShell><NewProgramPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/programs/:programId/setup/:step?"
        element={
          <ProtectedRoute engineerOnly>
            <AppShell><SetupProgramPage /></AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="/run" element={<Shell><RunPage /></Shell>} />
      <Route path="/run/:programId" element={<Shell><RunPage /></Shell>} />

      <Route path="/image-library" element={<Shell><ImageLibraryPage /></Shell>} />
      <Route path="/logs" element={<Shell><LogsPage /></Shell>} />

      <Route
        path="/io-settings/:programId?"
        element={
          <ProtectedRoute engineerOnly>
            <AppShell><IOSettingsPage /></AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="/help" element={<Shell><ChatbotPage /></Shell>} />
      <Route path="/account" element={<Shell><AccountPage /></Shell>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

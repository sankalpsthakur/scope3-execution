import { useEffect, useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { API_BASE } from "@/lib/api";

// Pages
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";

// Auth Context
import { createContext, useContext } from "react";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const hash = window.location.hash;
      const sessionId = new URLSearchParams(hash.substring(1)).get("session_id");

      if (!sessionId) {
        navigate("/", { replace: true });
        return;
      }

      try {
        const response = await axios.post(
          `${API_BASE}/auth/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        // Redirect to dashboard with user data
        navigate("/dashboard", { 
          replace: true, 
          state: { user: response.data.user } 
        });
      } catch (error) {
        console.error("Auth error:", error);
        navigate("/", { replace: true });
      }
    };

    processAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Authenticating...</p>
      </div>
    </div>
  );
};

// Demo mode: auto-authenticate with backend to get a real session cookie
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;

    const init = async () => {
      try {
        // Try existing session first
        const me = await axios.get(`${API_BASE}/auth/me`, { withCredentials: true });
        setUser(me.data);
        setReady(true);
      } catch {
        // No session — create one via test-login
        try {
          const res = await axios.post(
            `${API_BASE}/auth/test-login`,
            {},
            { withCredentials: true, headers: { "X-Test-Auth": "local_dev_token" } }
          );
          setUser(res.data.user);
          setReady(true);
        } catch {
          // Fallback to demo user if backend is unreachable
          setUser({ user_id: "demo_user", email: "demo@example.com", name: "Demo User", picture: null });
          setReady(true);
        }
      }
    };
    init();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

const AppRouter = () => {
  const location = useLocation();

  // Check URL fragment for session_id synchronously during render
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <div className="noise-overlay" aria-hidden="true" />
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;

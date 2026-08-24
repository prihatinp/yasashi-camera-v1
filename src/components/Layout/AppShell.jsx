import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import YasashiLogo from "../YasashiLogo.jsx";
import ChatbotWidget from "../Chatbot/ChatbotWidget.jsx";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/programs", label: "Program", icon: "🧩" },
  { to: "/run", label: "Run", icon: "▶️" },
  { to: "/image-library", label: "Image Library", icon: "🖼️" },
  { to: "/logs", label: "Logs", icon: "📋" },
  { to: "/io-settings", label: "I/O Settings", icon: "🔌", engineerOnly: true },
  { to: "/help", label: "Chatbot / Help", icon: "💬" },
  { to: "/account", label: "Account", icon: "⚙️" },
];

export default function AppShell({ children }) {
  const { profile, isEngineer, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="hidden md:flex w-64 flex-col border-r border-gray-100 bg-white p-5">
        <YasashiLogo />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.engineerOnly || isEngineer).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-yasashi-green/10 text-yasashi-green-dark"
                    : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 border-t border-gray-100 pt-4 text-sm">
          <div className="font-medium text-gray-800">{profile?.nama ?? profile?.email}</div>
          <div className="text-xs uppercase tracking-wide text-yasashi-green-dark">
            {profile?.role ?? "..."}
          </div>
          <button onClick={handleSignOut} className="btn-secondary mt-3 w-full !py-1.5 text-xs">
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex md:hidden items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <YasashiLogo size={32} />
          <button onClick={handleSignOut} className="text-sm text-gray-500">
            Keluar
          </button>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
        <nav className="md:hidden sticky bottom-0 flex justify-around border-t border-gray-100 bg-white py-2">
          {NAV_ITEMS.filter((item) => !item.engineerOnly || isEngineer)
            .slice(0, 5)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center text-[10px] px-2 ${
                    isActive ? "text-yasashi-green-dark" : "text-gray-400"
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>
      </div>
      <ChatbotWidget />
    </div>
  );
}

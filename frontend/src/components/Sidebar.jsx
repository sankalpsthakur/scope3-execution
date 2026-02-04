import { 
  Leaf, BarChart3, TrendingDown, Users, Settings, LogOut, 
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export const Sidebar = ({ user, onLogout }) => {
  const [activeItem, setActiveItem] = useState("reduce");

  return (
    <aside className="w-64 bg-[#121212] border-r border-white/10 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-[#22C55E]" />
          </div>
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-white block">
              SCOPE3
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Carbon Intelligence</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="mb-6">
          <span className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2 block">Modules</span>
          <div className="space-y-1">
            <button
              onClick={() => setActiveItem("measure")}
              className={`sidebar-item w-full text-left ${activeItem === "measure" ? "active" : ""}`}
              data-testid="nav-measure"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Measure</span>
            </button>
            <button
              onClick={() => setActiveItem("reduce")}
              className={`sidebar-item w-full text-left ${activeItem === "reduce" ? "active" : ""}`}
              data-testid="nav-reduce"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Reduce</span>
              <Badge className="ml-auto bg-[#22C55E]/20 text-[#22C55E] border-0 text-[10px]">AI</Badge>
            </button>
            <button
              onClick={() => setActiveItem("engage")}
              className={`sidebar-item w-full text-left ${activeItem === "engage" ? "active" : ""}`}
              data-testid="nav-engage"
            >
              <Users className="w-4 h-4" />
              <span>Engage</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-white/10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors" data-testid="user-menu-trigger">
              <div className="w-9 h-9 rounded-full bg-[#22C55E]/20 flex items-center justify-center overflow-hidden">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#22C55E] font-semibold text-sm">
                    {user?.name?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email || ""}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#121212] border-white/10">
            <DropdownMenuItem className="text-gray-400 hover:text-white hover:bg-white/5">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={onLogout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

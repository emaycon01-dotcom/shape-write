import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  History,
  LogOut,
  CreditCard,
  Headphones,
  Palette,
  ShieldBan,
  SlidersHorizontal,
  Rocket,
  Star,
  Gem,
  PenTool,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import logo from "@/assets/logo.png";
import { SupportDialog } from "@/components/SupportDialog";

const commonItems = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Serviços", url: "/dashboard/documents", icon: FileText },
  { title: "Histórico", url: "/dashboard/history", icon: History },
  { title: "Recarregar", url: "/dashboard/recarregar", icon: CreditCard },
];

const SIDEBAR_PLANOS = [
  { nome: "Dealer", preco: "R$ 150", icon: Rocket, gradient: "gradient-dealer" },
  { nome: "Master", preco: "R$ 450", icon: Star, gradient: "gradient-master" },
  { nome: "Diamond", preco: "R$ 999", icon: Gem, gradient: "gradient-diamond" },
];

type ThemeMode = "default" | "dark-blue" | "light";

const THEME_OPTIONS: { value: ThemeMode; label: string; colors: string[] }[] = [
  { value: "default", label: "Padrão", colors: ["hsl(220 50% 5%)", "hsl(217 91% 60%)"] },
  { value: "dark-blue", label: "Azul Escuro", colors: ["hsl(220 60% 3%)", "hsl(217 91% 60%)"] },
  { value: "light", label: "Branco", colors: ["hsl(0 0% 98%)", "hsl(217 91% 50%)"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("bellarus-theme") as ThemeMode) || "default";
  });

  const applyTheme = (t: ThemeMode) => {
    setTheme(t);
    localStorage.setItem("bellarus-theme", t);
    document.documentElement.classList.remove("theme-dark-blue", "theme-light");
    if (t !== "default") {
      document.documentElement.classList.add(`theme-${t}`);
    }
  };

  useState(() => {
    if (theme !== "default") {
      document.documentElement.classList.add(`theme-${theme}`);
    }
  });

  const isAdmin = user?.role === "admin";

  const renderMenuItems = (items: typeof commonItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="hover:bg-secondary/50"
            activeClassName="bg-secondary text-primary font-medium"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {!collapsed && (
          <div className="px-4 py-5 flex items-center gap-3">
            <img src={logo} alt="MonkeyLab" className="h-10 w-auto object-contain" />
            <span className="block text-[10px] tracking-[0.3em] text-accent">SISTEMAS</span>
          </div>

        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">MENU PRINCIPAL</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(commonItems)}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setSupportOpen(true)} className="hover:bg-secondary/50 cursor-pointer">
                  <Headphones className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Suporte</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Ferramentas */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">FERRAMENTAS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/ferramentas/assinaturas"
                    className="hover:bg-secondary/50"
                    activeClassName="bg-secondary text-primary font-medium"
                  >
                    <PenTool className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Criador de Assinaturas</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Admin: only Menu Admin + Alinhamento */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">ADMINISTRAÇÃO</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/admin" end className="hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <ShieldBan className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Menu Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/template-align" className="hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Menu de Alinhamento</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">PLANOS</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="grid grid-cols-3 gap-1.5 px-2">
                {SIDEBAR_PLANOS.map((p) => (
                  <Link
                    key={p.nome}
                    to="/dashboard/recarregar"
                    className="group relative overflow-hidden rounded-lg border border-border/60 bg-card/50 p-2 text-center transition-all hover:-translate-y-0.5"
                  >
                    <div className={`absolute inset-x-0 top-0 h-[2px] ${p.gradient}`} />
                    <div className={`absolute -right-6 -top-6 h-14 w-14 rounded-full ${p.gradient} opacity-20 blur-xl`} />
                    <div className="relative space-y-1">
                      <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md ${p.gradient}`}>
                        <p.icon className="h-3 w-3 text-primary-foreground" />
                      </span>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-foreground">{p.nome}</p>
                      <p className="text-[9px] text-muted-foreground">{p.preco}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="mt-auto p-4 space-y-3">
          {!collapsed && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Palette className="w-3.5 h-3.5" />
                <span>Cor</span>
              </div>
              <div className="flex gap-2">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => applyTheme(opt.value)}
                    title={opt.label}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      theme === opt.value ? "border-primary scale-110" : "border-border hover:border-muted-foreground"
                    }`}
                    style={{ background: `linear-gradient(135deg, ${opt.colors[0]} 50%, ${opt.colors[1]} 50%)` }}
                  />
                ))}
              </div>
            </div>
          )}
          {!collapsed && user && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <button onClick={logout} className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors">
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sair"}
          </button>
        </div>

        <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
      </SidebarContent>
    </Sidebar>
  );
}

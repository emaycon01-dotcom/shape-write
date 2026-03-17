import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  History,
  LogOut,
  Settings,
  Users,
  CreditCard,
  Send,
  BarChart3,
  Crown,
  Wrench,
  Download,
  PenTool,
  MapPin,
  Blend,
  ChevronDown,
  Headphones,
  Palette,
  ImageIcon,
  IdCard,
  IdCard,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logo from "@/assets/logo.png";
import { SupportDialog } from "@/components/SupportDialog";

const commonItems = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Serviços Digitais", url: "/dashboard/documents", icon: FileText },
  { title: "Histórico", url: "/dashboard/history", icon: History },
  { title: "Recarregar", url: "/dashboard/recarregar", icon: CreditCard },
  { title: "Planos", url: "/dashboard/planos", icon: Crown },
];

const toolItems = [
  { title: "Gerador de Assinatura", url: "/dashboard/ferramentas/assinatura", icon: PenTool },
  { title: "Removedor de Fundo", url: "/dashboard/ferramentas/remover-fundo", icon: ImageIcon },
  { title: "Mesclagem de Rosto", url: "/dashboard/ferramentas/mesclagem-rosto", icon: Blend },
];

const adminItems = [
  { title: "Revendedores", url: "/dashboard/revendedores", icon: Users },
  { title: "Transferir", url: "/dashboard/transferir", icon: Send },
  { title: "Métricas", url: "/dashboard/metricas", icon: BarChart3 },
  { title: "Alinhamento", url: "/dashboard/template-align", icon: Wrench },
  { title: "Configurações", url: "/dashboard/configuracoes", icon: Settings },
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

  // Apply saved theme on mount
  useState(() => {
    if (theme !== "default") {
      document.documentElement.classList.add(`theme-${theme}`);
    }
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {!collapsed && (
          <div className="px-4 py-5 flex items-center gap-3">
            <img src={logo} alt="Bellarus" className="w-9 h-9" />
            <div>
              <span className="font-display font-bold text-lg tracking-wider text-foreground">BELLARUS</span>
              <span className="block text-[10px] tracking-[0.3em] text-accent -mt-1">SISTEMAS</span>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">
            MENU PRINCIPAL
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {commonItems.map((item) => (
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
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setSupportOpen(true)}
                  className="hover:bg-secondary/50 cursor-pointer"
                >
                  <Headphones className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Suporte</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">
            FERRAMENTAS
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-secondary/50"
                      activeClassName="bg-secondary text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1 text-muted-foreground text-[10px] tracking-widest font-medium uppercase hover:text-foreground transition-colors">
              DOCUMENTOS FÍSICOS
              <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/cnh-fisica/todos"
                        className="hover:bg-secondary/50"
                        activeClassName="bg-secondary text-primary font-medium"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        {!collapsed && <span>CNH Todos os Estados</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/documentos-fisicos/carteirinhas"
                        className="hover:bg-secondary/50"
                        activeClassName="bg-secondary text-primary font-medium"
                      >
                        <IdCard className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Carteirinhas</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/documentos-fisicos/rg-fisico"
                        className="hover:bg-secondary/50"
                        activeClassName="bg-secondary text-primary font-medium"
                      >
                        <IdCard className="mr-2 h-4 w-4" />
                        {!collapsed && <span>RG Físico Todos os Estados</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">
              ADMINISTRAÇÃO
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-secondary/50"
                        activeClassName="bg-secondary text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
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
                      theme === opt.value
                        ? "border-primary scale-110"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${opt.colors[0]} 50%, ${opt.colors[1]} 50%)`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {!collapsed && user && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sair"}
          </button>
        </div>

        <SupportDialog open={supportOpen} onOpenChange={setSupportOpen} />
      </SidebarContent>
    </Sidebar>
  );
}

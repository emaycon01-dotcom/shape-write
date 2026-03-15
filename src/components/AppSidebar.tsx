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
  ChevronDown,
  Headphones,
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
  { title: "Serviços", url: "/dashboard/documents", icon: FileText },
  { title: "Histórico", url: "/dashboard/history", icon: History },
  { title: "Recarregar", url: "/dashboard/recarregar", icon: CreditCard },
  { title: "Planos", url: "/dashboard/planos", icon: Crown },
];

const toolItems = [
  { title: "Gerador de Assinatura", url: "/dashboard/ferramentas/assinatura", icon: PenTool },
];

const adminItems = [
  { title: "Revendedores", url: "/dashboard/revendedores", icon: Users },
  { title: "Transferir", url: "/dashboard/transferir", icon: Send },
  { title: "Métricas", url: "/dashboard/metricas", icon: BarChart3 },
  { title: "Alinhamento", url: "/dashboard/template-align", icon: Wrench },
  { title: "Configurações", url: "/dashboard/configuracoes", icon: Settings },
];

const ESTADOS_UF = ["SP","RJ","PE","BA","MG","RS"];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);

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
              SERVIÇOS FÍSICOS
              <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ESTADOS_UF.map((uf) => (
                    <SidebarMenuItem key={uf}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={`/dashboard/cnh-fisica/${uf.toLowerCase()}`}
                          className="hover:bg-secondary/50"
                          activeClassName="bg-secondary text-primary font-medium"
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          {!collapsed && <span>CNH {uf}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
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

        <div className="mt-auto p-4 space-y-2">
          <button
            onClick={() => setSupportOpen(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Headphones className="w-4 h-4" />
            {!collapsed && "Suporte"}
          </button>
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

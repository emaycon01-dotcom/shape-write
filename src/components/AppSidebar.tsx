import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  History,
  LogOut,
  Settings,
  Users,
  Move,
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

const mainItems = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard },
  { title: "Documentos", url: "/dashboard/documents", icon: FileText },
  { title: "Histórico", url: "/dashboard/history", icon: History },
  { title: "Alinhamento", url: "/dashboard/template-align", icon: Move },
];

const adminItems = [
  { title: "Gerenciar Usuários", url: "/dashboard/admin/users", icon: Users },
  { title: "Configurações", url: "/dashboard/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {/* Logo */}
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
              {mainItems.map((item) => (
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

        <div className="mt-auto p-4">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sair"}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

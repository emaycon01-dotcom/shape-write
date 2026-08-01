import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  History,
  LogOut,
  CreditCard,
  ShieldBan,
  SlidersHorizontal,
  PenTool,
  Smartphone,
  UserCheck,
  BadgeCheck,
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
import logo from "@/assets/logo.webp";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useOpenTickets } from "@/hooks/use-open-tickets";
import { usePendingApprovals } from "@/hooks/use-pending-approvals";


const commonItems = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Serviços", url: "/dashboard/documents", icon: FileText },
  { title: "Histórico", url: "/dashboard/history", icon: History },
  { title: "Recarregar", url: "/dashboard/recarregar", icon: CreditCard },
];



export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const { count: openTickets } = useOpenTickets();
  const { count: pendingApprovals } = usePendingApprovals();


  const isAdmin = user?.role === "admin";
  const isGerente = user?.role === "gerente";
  const isStaff = isAdmin || isGerente;


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
          <div className="px-4 py-5 flex items-center">
            <img src={logo} alt="MonkeyLab" className="h-12 w-auto object-contain" />
          </div>


        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">MENU PRINCIPAL</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItems(commonItems)}
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


        {/* Administração: admins veem tudo; gerentes só aprovações e chamados */}
        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">{isAdmin ? "ADMINISTRAÇÃO" : "GERÊNCIA"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/admin" end className="hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <ShieldBan className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Menu Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/admin/aprovacoes" className="relative hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <UserCheck className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Aprovar Contas</span>}
                      {pendingApprovals > 0 && (
                        <span
                          className={
                            collapsed
                              ? "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
                              : "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground"
                          }
                        >
                          {pendingApprovals > 99 ? "99+" : pendingApprovals}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/admin/verificacoes" className="relative hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Verificar Contas</span>}
                      {unverified > 0 && (
                        <span
                          className={
                            collapsed
                              ? "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
                              : "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground"
                          }
                        >
                          {unverified > 99 ? "99+" : unverified}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>

                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/admin/chamados" className="relative hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <Headphones className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Chamados</span>}
                      {openTickets > 0 && (
                        <span
                          className={
                            collapsed
                              ? "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
                              : "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground"
                          }
                        >
                          {openTickets > 99 ? "99+" : openTickets}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>


                {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/template-align" className="hover:bg-secondary/50" activeClassName="bg-secondary text-primary font-medium">
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Menu de Alinhamento</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                )}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[10px] tracking-widest">APLICATIVOS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard/aplicativos"
                    className="relative overflow-hidden hover:bg-secondary/50"
                    activeClassName="bg-secondary text-primary font-medium"
                  >
                    <span className="absolute inset-x-0 top-0 h-[2px] gradient-primary" />
                    <Smartphone className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Aplicativos (APK)</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>




        <div className="mt-auto p-4 space-y-3">
          <ThemeSwitcher compact={collapsed} />
          {!collapsed && user && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}

          <button onClick={logout} className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors">
            <LogOut className="w-4 h-4" />
            {!collapsed && "Sair"}
          </button>
        </div>

      </SidebarContent>
    </Sidebar>
  );
}

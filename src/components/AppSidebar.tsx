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
  Download,
  ExternalLink,
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
import cnhApk from "@/assets/cnh_do_brasil.apk.asset.json";
import govApk from "@/assets/gov.apk.asset.json";

const commonItems = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Serviços", url: "/dashboard/documents", icon: FileText },
  { title: "Histórico", url: "/dashboard/history", icon: History },
  { title: "Recarregar", url: "/dashboard/recarregar", icon: CreditCard },
];

const APLICATIVOS = [
  {
    titulo: "Aplicativo da CNH",
    arquivo: "cnh_do_brasil.apk",
    url: cnhApk.url,
    gradient: "gradient-dealer",
    links: [{ label: "Site CNH", href: "https://condutor-cnhdigital-vio-webs.info" }],
  },
  {
    titulo: "Aplicativo do RG e CHA",
    arquivo: "gov.apk",
    url: govApk.url,
    gradient: "gradient-master",
    links: [
      { label: "Site RG", href: "https://cidadaniagov-info.site/" },
      { label: "Site CHA", href: "https://senetran-consultacarteira-digital-transito-vio.info" },
    ],
  },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();


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
                    to={`/dashboard/planos?plano=${p.nome.toLowerCase()}`}
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

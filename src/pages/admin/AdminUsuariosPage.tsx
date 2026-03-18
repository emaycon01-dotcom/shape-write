import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  credits: number;
  plano: string;
}

interface UserRole {
  user_id: string;
  cargo: string;
}

const CARGOS = ["dealer", "master", "diamond", "sub_gerente", "gerente", "admin"] as const;
const CARGO_LABELS: Record<string, string> = {
  dealer: "DEALER",
  master: "MASTER",
  diamond: "DIAMOND",
  sub_gerente: "SUB GERENTE",
  gerente: "GERENTE",
  admin: "ADMIN",
};

export default function AdminUsuariosPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCargo, setSelectedCargo] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as any);
    if (rolesRes.data) setRoles(rolesRes.data as any);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getUserCargo = (userId: string) => {
    const role = roles.find((r) => r.user_id === userId);
    return role?.cargo;
  };

  const handleAssignCargo = async (userId: string) => {
    const cargo = selectedCargo[userId];
    if (!cargo) return;
    const { error } = await supabase.from("user_roles").upsert(
      { user_id: userId, cargo } as any,
      { onConflict: "user_id,cargo" }
    );
    if (error) {
      // Try delete existing then insert
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, cargo } as any);
    }
    toast({ title: "Cargo atribuído", description: `Cargo ${CARGO_LABELS[cargo]} atribuído com sucesso.` });
    fetchData();
  };

  const handleRemoveCargo = async (userId: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    toast({ title: "Cargo removido", description: "Cargo removido com sucesso." });
    fetchData();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold text-foreground">Usuários</h1>
        </div>
        <p className="text-sm text-muted-foreground">Gerencie todos os usuários cadastrados</p>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
      ) : profiles.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const cargo = getUserCargo(p.user_id);
            return (
              <div key={p.id} className="glass rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground truncate">{p.name || "Sem nome"}</p>
                    {cargo && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                        {CARGO_LABELS[cargo] || cargo}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Créditos: <strong className="text-foreground">{p.credits}</strong></span>
                    <span>Plano: <strong className="text-foreground">{p.plano}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={selectedCargo[p.user_id] || ""}
                    onValueChange={(v) => setSelectedCargo((prev) => ({ ...prev, [p.user_id]: v }))}
                  >
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGOS.map((c) => (
                        <SelectItem key={c} value={c}>{CARGO_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="default" onClick={() => handleAssignCargo(p.user_id)} disabled={!selectedCargo[p.user_id]}>
                    <Shield className="w-3.5 h-3.5 mr-1" /> Alterar
                  </Button>
                  {cargo && (
                    <Button size="sm" variant="destructive" onClick={() => handleRemoveCargo(p.user_id)}>
                      <X className="w-3.5 h-3.5 mr-1" /> Remover
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

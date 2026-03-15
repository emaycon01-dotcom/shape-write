import { useState } from "react";
import { Send, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  credits: number;
  createdAt: string;
}

const mockUsers: MockUser[] = [
  { id: "1", name: "Admin", email: "admin@bellarus.com", role: "admin", credits: 999, createdAt: "2026-03-01" },
  { id: "2", name: "Usuário Demo", email: "demo@bellarus.com", role: "cliente", credits: 10, createdAt: "2026-03-10" },
  { id: "3", name: "kroniel85", email: "kroniel85@gmail.com", role: "cliente", credits: 3, createdAt: "2026-03-12" },
  { id: "4", name: "Forex", email: "forex@email.com", role: "cliente", credits: 5, createdAt: "2026-03-14" },
];

export default function TransferirPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [amount, setAmount] = useState("");

  const filtered = mockUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = () => {
    if (!selectedUser || !amount || Number(amount) < 1) return;
    toast({
      title: "Créditos transferidos",
      description: `${amount} créditos enviados para ${selectedUser.name}.`,
    });
    setAmount("");
    setSelectedUser(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Transferir Créditos</h1>
        </div>
        <p className="text-sm text-muted-foreground">Envie créditos para qualquer usuário</p>
      </div>

      {/* Transfer form */}
      {selectedUser && (
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedUser.name}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Input
              type="number"
              min={1}
              placeholder="Quantidade de créditos"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
            <Button variant="gradient" onClick={handleTransfer}>
              <Send className="w-4 h-4 mr-2" />
              Transferir
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users table */}
      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"}`}>
                    {u.role}
                  </span>
                </TableCell>
                <TableCell className="text-foreground">{u.credits} cr</TableCell>
                <TableCell className="text-muted-foreground">{u.createdAt}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedUser(u)}
                  >
                    <Send className="w-3 h-3 mr-1" /> Enviar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

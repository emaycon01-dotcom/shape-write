import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Shield, ExternalLink } from "lucide-react";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const supportMembers = [
  {
    name: "Souza",
    role: "CEO & SUPORTE",
    icon: Crown,
    link: "#",
  },
  {
    name: "G7",
    role: "GERENTE & SUPORTE",
    icon: Shield,
    link: "#",
  },
];

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary" />
            Suporte Bellarus
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {supportMembers.map((member) => (
            <div
              key={member.name}
              className="flex items-center gap-4 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <member.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{member.name}</p>
                <p className="text-xs tracking-widest text-muted-foreground">{member.role}</p>
              </div>
              <a href={member.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

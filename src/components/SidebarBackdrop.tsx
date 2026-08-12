import { useSidebar } from "@/components/ui/sidebar";

/** Escurece o conteúdo quando o menu está aberto no desktop (menu em overlay). */
export default function SidebarBackdrop() {
  const { open, isMobile, setOpen } = useSidebar();
  if (isMobile || !open) return null;
  return (
    <div
      aria-hidden
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-30 hidden bg-background/60 backdrop-blur-sm md:block"
    />
  );
}

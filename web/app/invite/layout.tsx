import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full relative overflow-hidden">
      <MeshGradientBg />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

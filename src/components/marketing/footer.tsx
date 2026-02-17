import { KosoMark } from "@/components/ui/koso-logo";

export function Footer() {
  return (
    <footer className="border-t border-border-default">
      <div className="max-w-[1200px] mx-auto h-16 flex items-center justify-between px-6 md:px-12">
        <KosoMark size={20} />
        <span className="text-xs text-text-tertiary">
          &copy; {new Date().getFullYear()} Koso
        </span>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { KosoMark } from "@/components/ui/koso-logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <KosoMark size={32} className="mx-auto mb-6" />
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-block border border-border-strong bg-bg-inverse px-4 py-2 text-sm font-medium text-text-inverse hover:bg-[#222]"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}

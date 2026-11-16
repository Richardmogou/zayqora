import { cn } from "@/lib/utils";

export function Card({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5", className)}>
      {title && <h2 className="mb-4 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

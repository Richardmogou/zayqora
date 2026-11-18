import { cn } from "@/lib/utils";

export function Card({ title, action, className, children }: { title?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

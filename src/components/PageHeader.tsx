import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && (
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold text-foreground mt-1">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

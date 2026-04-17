import { PageHeader } from "@/components/PageHeader";

export default function Settings() {
  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Factory setup, departments, shifts, users and roles"
      />
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <div className="text-sm text-muted-foreground">
          Configuration panel — departments, shifts, RBAC, audit logs, integrations.
        </div>
      </div>
    </div>
  );
}

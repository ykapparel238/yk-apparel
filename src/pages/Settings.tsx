import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { auditLog, departments, shifts, users } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Shield } from "lucide-react";

export default function Settings() {
  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Departments, shifts, users, roles and audit trail"
        actions={
          <Button size="sm" className="h-9">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add
          </Button>
        }
      />

      <Tabs defaultValue="departments">
        <TabsList className="mb-4">
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Head</th>
                  <th className="px-4 py-3 font-semibold text-right">Staff</th>
                  <th className="px-4 py-3 font-semibold text-right">Lines</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id} className="data-table-row">
                    <td className="px-4 py-3 font-mono-num text-xs">{d.id}</td>
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <td className="px-4 py-3">{d.head}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{d.staff}</td>
                    <td className="px-4 py-3 text-right font-mono-num">{d.lines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="shifts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((s) => (
              <div key={s.id} className="bg-card border border-border rounded-lg p-5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num">{s.id}</div>
                <h3 className="font-semibold mt-1">{s.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono-num">{s.start}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-2xl font-bold font-mono-num">{s.end}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Supervisor</div>
                    <div className="font-medium mt-0.5">{s.supervisor}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider">Headcount</div>
                    <div className="font-mono-num font-semibold mt-0.5">{s.headcount}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" /> Role-based access — {users.length} configured users
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="data-table-row">
                    <td className="px-4 py-3 font-mono-num text-xs">{u.id}</td>
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-primary-soft text-primary">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono-num">{u.last}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Module</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((a) => (
                  <tr key={a.id} className="data-table-row">
                    <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">{a.ts}</td>
                    <td className="px-4 py-3 font-medium">{a.actor}</td>
                    <td className="px-4 py-3">{a.action}</td>
                    <td className="px-4 py-3 text-xs">{a.target}</td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[11px]">{a.module}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

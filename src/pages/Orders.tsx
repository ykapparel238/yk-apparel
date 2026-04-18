import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brands, orders, styles } from "@/lib/mockData";
import { Download, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function Orders() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const filtered = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(q.toLowerCase()) ||
      o.brand.toLowerCase().includes(q.toLowerCase()) ||
      o.styleName.toLowerCase().includes(q.toLowerCase())
  );
  const fmt = (n: number) => n.toLocaleString("en-IN");

  return (
    <div>
      <PageHeader
        eyebrow="Merchandising"
        title="Purchase Orders"
        description="Manage POs across all brands, styles and seasons"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New PO
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Create Purchase Order</SheetTitle>
                  <SheetDescription>
                    Enter PO details — order will enter the planning queue.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <Field label="Brand / Customer">
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                      <SelectContent>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Style">
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                      <SelectContent>
                        {styles.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="PO Number">
                      <Input placeholder="PO-24-1021" />
                    </Field>
                    <Field label="Season">
                      <Select>
                        <SelectTrigger><SelectValue placeholder="Season" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AW24">AW24</SelectItem>
                          <SelectItem value="SS25">SS25</SelectItem>
                          <SelectItem value="AW25">AW25</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity">
                      <Input type="number" placeholder="15000" />
                    </Field>
                    <Field label="Delivery Date">
                      <Input type="date" />
                    </Field>
                  </div>
                  <Field label="Priority">
                    <Select defaultValue="Medium">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Notes">
                    <Input placeholder="Special instructions, ship-mode, etc." />
                  </Field>
                </div>
                <SheetFooter className="mt-6">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      toast.success("Purchase Order created", {
                        description: "New PO has been queued for planning.",
                      });
                      setOpen(false);
                    }}
                  >
                    Create PO
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        }
      />

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search PO, brand, style…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Showing <span className="font-mono-num font-semibold text-foreground">{filtered.length}</span> of {orders.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">PO #</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Style</th>
                <th className="px-4 py-3 font-semibold">Season</th>
                <th className="px-4 py-3 font-semibold text-right">Qty</th>
                <th className="px-4 py-3 font-semibold">Due Date</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold w-32">Progress</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="data-table-row cursor-pointer"
                  onClick={() => navigate(`/orders/${o.id}`)}
                >
                  <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">{o.id}</td>
                  <td className="px-4 py-3">{o.brand}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.styleName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono-num">{o.style}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{o.season}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">{fmt(o.qty)}</td>
                  <td className="px-4 py-3 font-mono-num text-xs text-muted-foreground">{o.due}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${o.status === "Delayed" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono-num text-muted-foreground w-9 text-right">
                        {o.progress}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

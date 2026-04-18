import { PageHeader } from "@/components/PageHeader";
import { brands, vendors, styles, suppliers } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Download,
  Filter,
  Search,
  RefreshCw,
  Settings2,
  Printer,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Archive,
  Trash2,
  History,
  Link2,
  Tag,
  Boxes,
  ClipboardList,
  Send,
  Star,
  Power,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const notify = (label: string) => toast(`${label} — coming soon`);

export default function Masters() {
  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Master Data"
        description="Brands, vendors, suppliers, styles, BOM and factory setup"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" className="h-9" onClick={() => notify("Refresh")}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => notify("Import")}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export as</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => notify("Export CSV")}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Export Excel")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Export PDF")}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Print")}>
                  <Printer className="h-3.5 w-3.5 mr-2" /> Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9">
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" /> More
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Bulk actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => notify("Bulk activate")}>
                  <Power className="h-3.5 w-3.5 mr-2" /> Bulk activate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Bulk archive")}>
                  <Archive className="h-3.5 w-3.5 mr-2" /> Bulk archive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Merge records")}>
                  <Link2 className="h-3.5 w-3.5 mr-2" /> Merge records
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Configuration</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => notify("Manage tags")}>
                  <Tag className="h-3.5 w-3.5 mr-2" /> Manage tags
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Custom fields")}>
                  <Settings2 className="h-3.5 w-3.5 mr-2" /> Custom fields
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Audit log")}>
                  <History className="h-3.5 w-3.5 mr-2" /> Audit log
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("Approval workflow")}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Approval workflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => notify("New Brand")}>
                  <Tag className="h-3.5 w-3.5 mr-2" /> New Brand
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("New Vendor")}>
                  <Boxes className="h-3.5 w-3.5 mr-2" /> New Vendor / Subcontractor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("New Supplier")}>
                  <Send className="h-3.5 w-3.5 mr-2" /> New Supplier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("New Style")}>
                  <ClipboardList className="h-3.5 w-3.5 mr-2" /> New Style
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => notify("New BOM")}>
                  <ClipboardList className="h-3.5 w-3.5 mr-2" /> New BOM
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => notify("New Yarn / Trim")}>
                  <Boxes className="h-3.5 w-3.5 mr-2" /> New Yarn / Trim
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Global toolbar */}
      <div className="bg-card border border-border rounded-lg p-3 mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search across brands, vendors, suppliers, styles…"
            className="pl-9 h-9"
          />
        </div>
        <Button size="sm" variant="outline" className="h-9" onClick={() => notify("Filters")}>
          <Filter className="h-3.5 w-3.5 mr-1.5" /> Filters
        </Button>
        <Button size="sm" variant="outline" className="h-9" onClick={() => notify("Saved views")}>
          <Star className="h-3.5 w-3.5 mr-1.5" /> Saved views
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {brands.length + vendors.length + styles.length + suppliers.length} total records
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          title="Brands / Customers"
          rows={brands.length}
          newLabel="New Brand"
          onNew={() => notify("New Brand")}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Country</th>
                <th className="px-4 py-2.5 text-right">Active POs</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs">{b.code}</td>
                  <td className="px-4 py-2.5 font-medium">{b.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{b.country}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{b.activeOrders}</td>
                  <td className="px-2 py-2.5 text-right">
                    <RowActions label={b.name} type="brand" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Suppliers"
          rows={suppliers.length}
          newLabel="New Supplier"
          onNew={() => notify("New Supplier")}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Material</th>
                <th className="px-4 py-2.5 text-right">Lead (d)</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs">{s.id}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.material}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{s.lead}</td>
                  <td className="px-2 py-2.5 text-right">
                    <RowActions label={s.name} type="supplier" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section
          title="Styles / Products"
          rows={styles.length}
          newLabel="New Style"
          onNew={() => notify("New Style")}
          className="lg:col-span-2"
          extraActions={
            <>
              <Button size="sm" variant="outline" className="h-8" onClick={() => notify("Manage BOM")}>
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> BOM
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => notify("Size chart")}>
                <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Size chart
              </Button>
            </>
          }
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5">Style Code</th>
                <th className="px-4 py-2.5">Brand</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Gauge</th>
                <th className="px-4 py-2.5">Yarn</th>
                <th className="px-4 py-2.5">Sizes</th>
                <th className="px-4 py-2.5 text-right">Colors</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {styles.map((s) => (
                <tr key={s.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs font-semibold text-primary">{s.code}</td>
                  <td className="px-4 py-2.5">{s.brand}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.gauge}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.yarn}</td>
                  <td className="px-4 py-2.5 text-xs">{s.sizes.join(", ")}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{s.colors}</td>
                  <td className="px-2 py-2.5 text-right">
                    <RowActions label={s.code} type="style" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  children,
  className = "",
  onNew,
  newLabel,
  extraActions,
}: {
  title: string;
  rows: number;
  children: React.ReactNode;
  className?: string;
  onNew?: () => void;
  newLabel?: string;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      <div className="p-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground font-mono-num">{rows} records</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {extraActions}
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => notify(`Search ${title}`)}>
            <Search className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => notify(`Filter ${title}`)}>
            <Filter className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => notify(`Export ${title}`)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          {onNew && newLabel && (
            <Button size="sm" className="h-8" onClick={onNew}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> {newLabel}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 px-2">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => notify(`Import ${title}`)}>
                <Upload className="h-3.5 w-3.5 mr-2" /> Import
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => notify(`Print ${title}`)}>
                <Printer className="h-3.5 w-3.5 mr-2" /> Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => notify(`Column settings`)}>
                <Settings2 className="h-3.5 w-3.5 mr-2" /> Column settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => notify(`Archive all ${title}`)}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Archive all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function RowActions({ label, type }: { label: string; type: "brand" | "supplier" | "style" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => notify(`View ${label}`)}>
          <Eye className="h-3.5 w-3.5 mr-2" /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => notify(`Edit ${label}`)}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => notify(`Duplicate ${label}`)}>
          <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
        </DropdownMenuItem>
        {type === "brand" && (
          <DropdownMenuItem onClick={() => notify(`View POs of ${label}`)}>
            <ClipboardList className="h-3.5 w-3.5 mr-2" /> View POs
          </DropdownMenuItem>
        )}
        {type === "supplier" && (
          <DropdownMenuItem onClick={() => notify(`Create PR for ${label}`)}>
            <Send className="h-3.5 w-3.5 mr-2" /> Create PR
          </DropdownMenuItem>
        )}
        {type === "style" && (
          <>
            <DropdownMenuItem onClick={() => notify(`Open BOM ${label}`)}>
              <ClipboardList className="h-3.5 w-3.5 mr-2" /> Open BOM
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => notify(`Tech pack ${label}`)}>
              <FileText className="h-3.5 w-3.5 mr-2" /> Tech pack
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => notify(`Audit ${label}`)}>
          <History className="h-3.5 w-3.5 mr-2" /> Activity log
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => notify(`Archive ${label}`)}>
          <Archive className="h-3.5 w-3.5 mr-2" /> Archive
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => notify(`Delete ${label}`)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

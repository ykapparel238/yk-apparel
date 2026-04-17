import { PageHeader } from "@/components/PageHeader";
import { brands, vendors, styles, suppliers } from "@/lib/mockData";

export default function Masters() {
  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        title="Master Data"
        description="Brands, vendors, suppliers, styles, BOM and factory setup"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Brands / Customers" rows={brands.length}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Country</th>
                <th className="px-4 py-2.5 text-right">Active POs</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs">{b.code}</td>
                  <td className="px-4 py-2.5 font-medium">{b.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{b.country}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{b.activeOrders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Suppliers" rows={suppliers.length}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Material</th>
                <th className="px-4 py-2.5 text-right">Lead (d)</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="data-table-row">
                  <td className="px-4 py-2.5 font-mono-num text-xs">{s.id}</td>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.material}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num">{s.lead}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Styles / Products" rows={styles.length} className="lg:col-span-2">
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
}: {
  title: string;
  rows: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground font-mono-num">{rows} records</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

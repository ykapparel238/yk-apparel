import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { fetchVendors } from "@/lib/services";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Vendors() {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const vendorsQuery = useQuery({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
  });

  if (vendorsQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading vendors...</div>;
  }

  if (vendorsQuery.isError || !vendorsQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load vendors.</div>;
  }

  const vendors = vendorsQuery.data.items;

  return (
    <div>
      <PageHeader
        eyebrow="Supply Chain"
        title="Vendors & Subcontractors"
        description="Job work assignment, performance tracking, scorecards"
        actions={
          <Button
            size="sm"
            className="h-9"
            onClick={() => toast("Use Master Data to add vendors")}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Vendor
          </Button>
        }
      />

      {vendors.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No vendors found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <Link
              key={vendor.id}
              to={`/vendors/${vendor.id}`}
              className="bg-card border border-border rounded-lg p-5 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num">
                    {vendor.code}
                  </div>
                  <h3 className="font-semibold mt-0.5">{vendor.name}</h3>
                  <div className="text-xs text-muted-foreground mt-0.5">Process · {vendor.process}</div>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-primary-soft text-primary">
                  {vendor.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Capacity</div>
                  <div className="text-sm font-bold font-mono-num mt-0.5">{fmt(vendor.capacity)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Pending</div>
                  <div className="text-sm font-bold font-mono-num mt-0.5 text-warning">{fmt(vendor.pending)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">OTD</div>
                  <div className={`text-sm font-bold font-mono-num mt-0.5 ${vendor.otd >= 90 ? "text-success" : "text-warning"}`}>
                    {vendor.otd}%
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground">Quality Score</span>
                  <span className="font-mono-num font-semibold">{vendor.quality}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${vendor.quality}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

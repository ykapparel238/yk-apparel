import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { PoAttachmentUploader } from "@/components/PoAttachmentUploader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { fetchOrderDetail } from "@/lib/services";
import type { OrderDetailPayload } from "@/lib/types";
import { poAttachmentLabel } from "@/lib/poAttachmentContexts";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDot, Download, FileText, Image, Pencil, PlayCircle, Printer, Trash2 } from "lucide-react";

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const orderQuery = useQuery({
    queryKey: ["order-detail", id],
    queryFn: () => fetchOrderDetail(id!),
    enabled: Boolean(id),
  });

  if (orderQuery.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading order details...</div>;
  }

  if (orderQuery.isError || !orderQuery.data) {
    return <div className="p-8 text-center text-sm text-destructive">Unable to load order details.</div>;
  }

  const order = orderQuery.data.item;
  const sizes = orderQuery.data.sizes;
  const colorBreakdown = orderQuery.data.colors;
  const bom = orderQuery.data.bom;
  const orderChallans = orderQuery.data.challans;
  const techPack = orderQuery.data.techPack;
  const lifecycle = orderQuery.data.lifecycle;
  const attachments = orderQuery.data.attachments ?? [];
  const groupedAttachments = attachments.reduce<Record<string, typeof attachments>>((groups, asset) => {
    const key = asset.context ?? "OTHER";
    groups[key] = groups[key] ?? [];
    groups[key].push(asset);
    return groups;
  }, {});

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Orders
        </Link>
      </div>

      <PageHeader
        eyebrow={`${order.brand} • ${order.season}`}
        title={`${order.poNumber} — ${order.styleName}`}
        description={`Style ${order.style} • Due ${order.due}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => navigate("/orders", { state: { openOrderAction: "edit", orderId: order.id } })}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => navigate("/orders", { state: { openOrderAction: "delete", orderId: order.id } })}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Order
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => document.getElementById("tech-pack-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Tech Pack
            </Button>
            <Button size="sm" className="h-9">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Issue Challan
            </Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Order Qty" value={fmt(order.qty)} />
        <Stat label="Delivered" value={fmt(order.delivered)} tone="success" />
        <Stat
          label="In Pipeline"
          value={fmt(Math.max(0, order.qty - order.delivered))}
          tone="info"
        />
        <Stat label="Progress" value={`${order.progress}%`} />
        <Stat
          label="Status"
          custom={
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={order.status} />
              <StatusBadge status={order.priority} />
            </div>
          }
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Size breakdown */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Size Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">% of order qty</p>
          <div className="space-y-2.5">
            {sizes.map((s) => {
              const qty = Math.round((order.qty * s.qty) / 100);
              return (
                <div key={s.size}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{s.size}</span>
                    <span className="font-mono-num text-muted-foreground">
                      {fmt(qty)}{" "}
                      <span className="text-[10px]">({s.qty}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${s.qty * 3}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Color breakdown */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-1">Color Mix</h3>
          <p className="text-xs text-muted-foreground mb-4">Allocation by colourway</p>
          <div className="space-y-3">
            {colorBreakdown.map((c) => {
              const qty = Math.round((order.qty * c.qty) / 100);
              return (
                <div key={c.color} className="flex items-center gap-3">
                  <span
                    className="h-7 w-7 rounded-md border border-border shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{c.color}</span>
                      <span className="font-mono-num text-muted-foreground">
                        {fmt(qty)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-full bg-chart-2 rounded-full"
                        style={{ width: `${c.qty * 3}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <LifecycleCommandView lifecycle={lifecycle} onAction={(action) => navigate(action.route, { state: action.state })} />
      </div>

      {techPack && (
        <div id="tech-pack-section" className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold">Tech Pack</h3>
            <p className="text-xs text-muted-foreground">
              Style assets, approved samples, measurements, and thread references for this order.
            </p>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assets</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {techPack.assets.map((asset) => (
                    <div key={asset.id} className="rounded-md border border-border p-3 text-xs">
                      <p className="font-medium truncate">{asset.fileName}</p>
                      <p className="text-muted-foreground">{asset.kind.replaceAll("_", " ")}</p>
                      {asset.mimeType.startsWith("image/") && (
                        <img src={asset.url} alt={asset.fileName} className="mt-3 h-28 w-full rounded-md border border-border object-cover" />
                      )}
                      <a href={asset.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-primary underline-offset-4 hover:underline">
                        Open asset
                      </a>
                    </div>
                  ))}
                  {!techPack.assets.length && (
                    <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
                      No sample images or tech-pack attachments linked yet.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Samples</h4>
                <div className="space-y-2">
                  {techPack.samples.map((sample) => (
                    <div key={sample.id} className="rounded-md border border-border p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{sample.sampleType.replaceAll("_", " ")}</span>
                        <span className="text-muted-foreground">{sample.status}</span>
                      </div>
                      <p className="mt-2 text-muted-foreground">{sample.notes || "No notes provided."}</p>
                    </div>
                  ))}
                  {!techPack.samples.length && <p className="text-xs text-muted-foreground">No sample specs recorded yet.</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Colourways</h4>
                <div className="space-y-2">
                  {techPack.colorways.map((color) => (
                    <div key={`${color.id ?? color.name}`} className="flex items-start gap-3 rounded-md border border-border p-3 text-xs">
                      <span className="mt-0.5 h-4 w-4 rounded border border-border shrink-0" style={{ backgroundColor: color.hexCode || "#ffffff" }} />
                      <div className="min-w-0">
                        <p className="font-medium">{color.name}</p>
                        <p className="text-muted-foreground">
                          {color.pantoneCode || "No pantone"} • {color.threadCode || "No thread code"}
                        </p>
                        {color.notes ? <p className="text-muted-foreground mt-1">{color.notes}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Thread Specs</h4>
                <div className="space-y-2">
                  {techPack.threadSpecs.map((spec) => (
                    <div key={`${spec.id ?? spec.materialName}-${spec.sortOrder}`} className="rounded-md border border-border p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{spec.materialName}</span>
                        <span className="text-muted-foreground">{spec.countSpec}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {spec.colorRef || "No colour ref"}{spec.processNotes ? ` • ${spec.processNotes}` : ""}
                      </p>
                    </div>
                  ))}
                  {!techPack.threadSpecs.length && <p className="text-xs text-muted-foreground">No thread specs added yet.</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Measurement Chart</h4>
            {techPack.measurements.length ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">Size</th>
                    <th className="px-3 py-2 font-semibold">Point</th>
                    <th className="px-3 py-2 font-semibold text-right">Target</th>
                    <th className="px-3 py-2 font-semibold text-right">+ Tol</th>
                    <th className="px-3 py-2 font-semibold text-right">- Tol</th>
                    <th className="px-3 py-2 font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {techPack.measurements.map((measurement, index) => (
                    <tr key={`${measurement.id ?? measurement.measurementPoint}-${index}`} className="data-table-row">
                      <td className="px-3 py-2 text-xs font-medium">{measurement.sizeLabel}</td>
                      <td className="px-3 py-2 text-xs">{measurement.measurementPoint}</td>
                      <td className="px-3 py-2 text-right font-mono-num text-xs">{measurement.targetValue}</td>
                      <td className="px-3 py-2 text-right font-mono-num text-xs">{measurement.tolerancePlus}</td>
                      <td className="px-3 py-2 text-right font-mono-num text-xs">{measurement.toleranceMinus}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{measurement.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">No measurement chart has been uploaded for this style yet.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <div className="p-5 border-b border-border flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Reports & Photos</h3>
            <p className="text-xs text-muted-foreground">
              PO-level size charts, sample photos, and handwritten reports from production, QA, packing, and dispatch.
            </p>
          </div>
          <div className="md:w-[420px]">
            <PoAttachmentUploader
              orderId={order.id}
              contexts={["SIZE_CHART", "SAMPLE_PHOTO", "CUTTING_REPORT", "STITCHING_REPORT", "WASHING_REPORT", "QA_REPORT", "PACKING_REPORT", "DISPATCH_REPORT", "OTHER"]}
              defaultContext="OTHER"
              sourceType="order_detail"
              sourceId={order.id}
              title="Upload PO file"
              compact
              onUploaded={() => orderQuery.refetch()}
            />
          </div>
        </div>
        {attachments.length ? (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {Object.entries(groupedAttachments).map(([context, items]) => (
              <div key={context} className="rounded-md border border-border p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{poAttachmentLabel(context)}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((asset) => (
                    <div key={asset.id} className="rounded-md border border-border p-3 text-xs">
                      <div className="flex items-start gap-2">
                        {asset.mimeType.startsWith("image/") ? <Image className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{asset.fileName}</p>
                          <p className="text-muted-foreground">{asset.caption || new Date(asset.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {asset.mimeType.startsWith("image/") && (
                        <img src={asset.url} alt={asset.fileName} className="mt-3 h-28 w-full rounded-md border border-border object-cover" />
                      )}
                      <a href={asset.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-primary underline-offset-4 hover:underline">
                        Open file
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No PO report photos or size-chart files uploaded yet.
          </div>
        )}
      </div>

      {/* BOM */}
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Bill of Materials</h3>
          <p className="text-xs text-muted-foreground">Per piece consumption</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold text-right">Per Pc</th>
              <th className="px-4 py-3 font-semibold text-right">Total Req.</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((b) => (
              <tr key={b.id} className="data-table-row">
                <td className="px-4 py-3 font-medium">{b.item}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{b.type}</td>
                <td className="px-4 py-3 text-right font-mono-num">
                  {b.qty}{" "}
                  <span className="text-[10px] text-muted-foreground">{b.uom}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono-num font-semibold">
                  {fmt(Math.round(b.qty * order.qty * 100) / 100)}{" "}
                  <span className="text-[10px] text-muted-foreground">{b.uom}</span>
                </td>
                <td className="px-4 py-3 text-xs">{b.supplier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor challans for this PO */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-sm font-semibold">Vendor Job-Work Challans</h3>
          <p className="text-xs text-muted-foreground">
            {orderChallans.length} challans linked to this order
          </p>
        </div>
        {orderChallans.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No challans issued yet for this PO.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Challan #</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Process</th>
                <th className="px-4 py-3 font-semibold text-right">Out</th>
                <th className="px-4 py-3 font-semibold text-right">In</th>
                <th className="px-4 py-3 font-semibold text-right">Rejected</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orderChallans.map((c) => (
                <tr key={c.id} className="data-table-row">
                  <td className="px-4 py-3 font-mono-num text-xs font-semibold text-primary">
                    {c.challanNumber}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono-num text-muted-foreground">
                    {c.date}
                  </td>
                  <td className="px-4 py-3">{c.vendor}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.process}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num">{fmt(c.outQty)}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-success">
                    {fmt(c.inQty)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-destructive">
                    {fmt(c.rejected)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

type Lifecycle = NonNullable<OrderDetailPayload["lifecycle"]>;
type LifecycleAction = NonNullable<Lifecycle["nextAction"]>;

function LifecycleCommandView({
  lifecycle,
  onAction,
}: {
  lifecycle?: Lifecycle;
  onAction: (action: LifecycleAction) => void;
}) {
  if (!lifecycle) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-1">Lifecycle Command</h3>
        <p className="text-xs text-muted-foreground">Lifecycle status is not available for this order.</p>
      </div>
    );
  }

  const productionStep = lifecycle.steps.find((step) => step.key === "production");
  const productionStages = Array.isArray(productionStep?.metrics.stages)
    ? productionStep.metrics.stages as Array<{ stage: string; label: string; plannedQty: number; actualQty: number; rejectedQty: number; downtimeMinutes: number }>
    : [];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden lg:col-span-1">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Lifecycle Command</h3>
            <p className="text-xs text-muted-foreground">Readiness, production, QA, and dispatch for this PO</p>
          </div>
          {lifecycle.nextAction ? (
            <Button size="sm" className="h-8 shrink-0" onClick={() => onAction(lifecycle.nextAction!)}>
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              {lifecycle.nextAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-2.5">
          {lifecycle.steps.map((step) => (
            <div key={step.key} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <LifecycleIcon status={step.status} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold">{step.label}</div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass(step.status)}`}>
                        {step.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">{step.summary}</p>
                  </div>
                </div>
                {step.action ? (
                  <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={() => onAction(step.action!)}>
                    {step.action.label}
                  </Button>
                ) : null}
              </div>
              <LifecycleMetrics step={step} />
            </div>
          ))}
        </div>

        {productionStages.length ? (
          <div className="rounded-md border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-xs font-semibold">Order Stage Actuals</div>
            <div className="divide-y divide-border">
              {productionStages.map((stage) => {
                const pct = stage.plannedQty ? Math.min(100, Math.round((stage.actualQty / stage.plannedQty) * 100)) : 0;
                return (
                  <div key={stage.stage} className="px-3 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{stage.label}</span>
                      <span className="font-mono-num text-muted-foreground">{stage.actualQty.toLocaleString("en-IN")} / {stage.plannedQty.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-semibold">Risks & Blockers</div>
          {lifecycle.risks.length ? lifecycle.risks.map((risk, index) => (
            <div key={`${risk.module}-${index}`} className={`rounded-md border px-3 py-2 text-xs ${riskClass(risk.severity)}`}>
              <span className="font-semibold">{risk.module}:</span> {risk.message}
            </div>
          )) : (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              No active lifecycle risks detected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LifecycleMetrics({ step }: { step: Lifecycle["steps"][number] }) {
  const metrics = step.metrics;
  const items =
    step.key === "readiness"
      ? [
          ["Tech pack", yesNo(metrics.hasTechPack)],
          ["BOM", yesNo(metrics.hasBom)],
          ["Shortages", String(numberMetric(metrics.materialShortageCount))],
        ]
      : step.key === "planning"
      ? [
          ["Line", stringMetric(metrics.lineName, "Unplanned")],
          ["Daily", fmtMaybe(metrics.dailyTarget)],
          ["Qty", fmtMaybe(metrics.plannedQty)],
        ]
      : step.key === "production"
      ? [
          ["Actual", fmtMaybe(metrics.actualQty)],
          ["Reject", fmtMaybe(metrics.rejectedQty)],
          ["DT", `${numberMetric(metrics.downtimeMinutes)}m`],
        ]
      : step.key === "qa"
      ? [
          ["Checked", fmtMaybe(metrics.checkedQty)],
          ["Reject", fmtMaybe(metrics.rejectedQty)],
          ["CAPA", String(numberMetric(metrics.openCapaCount))],
        ]
      : [
          ["Shipped", fmtMaybe(metrics.shippedQty)],
          ["Balance", fmtMaybe(metrics.remainingQty)],
          ["Latest", latestShipmentLabel(metrics.latestShipment)],
        ];

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded bg-background/60 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-0.5 truncate text-xs font-semibold font-mono-num">{value}</div>
        </div>
      ))}
    </div>
  );
}

function LifecycleIcon({ status }: { status: Lifecycle["steps"][number]["status"] }) {
  if (status === "complete") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />;
  if (status === "blocked") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  if (status === "in_progress") return <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" />;
  return <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
}

function statusClass(status: Lifecycle["steps"][number]["status"]) {
  if (status === "complete") return "bg-success/10 text-success";
  if (status === "blocked") return "bg-destructive/10 text-destructive";
  if (status === "in_progress") return "bg-info/10 text-info";
  return "bg-muted text-muted-foreground";
}

function riskClass(severity: Lifecycle["risks"][number]["severity"]) {
  if (severity === "critical") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (severity === "warning") return "border-warning/40 bg-warning/10 text-warning";
  return "border-info/40 bg-info/10 text-info";
}

function yesNo(value: unknown) {
  return value ? "Yes" : "No";
}

function numberMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringMetric(value: unknown, fallback: string) {
  return typeof value === "string" && value.length ? value : fallback;
}

function fmtMaybe(value: unknown) {
  const number = numberMetric(value);
  return number ? number.toLocaleString("en-IN") : "0";
}

function latestShipmentLabel(value: unknown) {
  if (!value || typeof value !== "object") return "None";
  const shipment = value as { dispatchDate?: string; quantity?: number };
  return shipment.dispatchDate ? `${shipment.dispatchDate} (${(shipment.quantity ?? 0).toLocaleString("en-IN")})` : "None";
}

function Stat({
  label,
  value,
  tone,
  custom,
}: {
  label: string;
  value?: string;
  tone?: "success" | "info";
  custom?: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "info"
      ? "text-info"
      : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      {custom ?? (
        <div className={`mt-1 text-xl font-bold font-mono-num ${color}`}>
          {value}
        </div>
      )}
    </div>
  );
}

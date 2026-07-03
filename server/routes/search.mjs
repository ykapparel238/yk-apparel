import { Router } from "express";
import { prisma } from "../db.mjs";
import { asyncHandler, ok } from "../http.mjs";
import { reportCatalog } from "../reporting.mjs";

const router = Router();

function like(q) {
  return { contains: q, mode: "insensitive" };
}

router.get("/", asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return ok(res, { groups: [] });

  const [orders, styles, vendors, suppliers, materials] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { poNumber: like(q) },
          { brand: { is: { name: like(q) } } },
          { style: { is: { code: like(q) } } },
          { style: { is: { name: like(q) } } },
        ],
      },
      include: { brand: true, style: true },
      take: 8,
    }),
    prisma.style.findMany({
      where: { OR: [{ code: like(q) }, { name: like(q) }, { brand: { is: { name: like(q) } } }] },
      include: { brand: true },
      take: 8,
    }),
    prisma.vendor.findMany({
      where: { OR: [{ code: like(q) }, { name: like(q) }, { process: like(q) }] },
      take: 8,
    }),
    prisma.supplier.findMany({
      where: { OR: [{ code: like(q) }, { name: like(q) }, { defaultMaterial: like(q) }] },
      take: 8,
    }),
    prisma.material.findMany({
      where: { OR: [{ sku: like(q) }, { name: like(q) }, { supplier: { is: { name: like(q) } } }] },
      include: { supplier: true },
      take: 8,
    }),
  ]);

  const groups = [
    {
      module: "Orders",
      items: orders.map((order) => ({
        id: order.id,
        title: order.poNumber,
        subtitle: `${order.brand.name} / ${order.style.code}`,
        href: `/orders/${order.id}`,
      })),
    },
    {
      module: "Styles",
      items: styles.map((style) => ({
        id: style.id,
        title: style.code,
        subtitle: `${style.brand.name} / ${style.name}`,
        href: "/masters",
      })),
    },
    {
      module: "Vendors",
      items: vendors.map((vendor) => ({
        id: vendor.id,
        title: vendor.name,
        subtitle: `${vendor.code} / ${vendor.process}`,
        href: `/vendors/${vendor.id}`,
      })),
    },
    {
      module: "Suppliers",
      items: suppliers.map((supplier) => ({
        id: supplier.id,
        title: supplier.name,
        subtitle: `${supplier.code} / ${supplier.defaultMaterial ?? "Supplier"}`,
        href: "/masters",
      })),
    },
    {
      module: "Materials",
      items: materials.map((material) => ({
        id: material.id,
        title: material.sku,
        subtitle: `${material.name} / ${material.supplier?.name ?? "Unassigned"}`,
        href: "/inventory",
      })),
    },
    {
      module: "Reports",
      items: reportCatalog
        .filter((report) => [report.slug, report.name, report.desc, report.category].join(" ").toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
        .map((report) => ({
          id: report.slug,
          title: report.name,
          subtitle: `${report.category} / ${report.desc}`,
          href: "/reports",
        })),
    },
  ].filter((group) => group.items.length);

  return ok(res, { groups });
}));

export default router;

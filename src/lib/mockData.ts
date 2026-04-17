// Realistic textile / sweater manufacturing mock data
export type Role =
  | "Admin"
  | "Factory Manager"
  | "Production Planner"
  | "Merchandiser"
  | "QA Manager"
  | "Store Manager"
  | "Line Supervisor"
  | "Vendor Manager"
  | "Dispatch Manager";

export const ROLES: Role[] = [
  "Admin",
  "Factory Manager",
  "Production Planner",
  "Merchandiser",
  "QA Manager",
  "Store Manager",
  "Line Supervisor",
  "Vendor Manager",
  "Dispatch Manager",
];

export const brands = [
  { id: "B01", name: "Marks & Spencer", code: "MNS", country: "UK", activeOrders: 12, units: 48200 },
  { id: "B02", name: "H&M", code: "HM", country: "SE", activeOrders: 9, units: 36500 },
  { id: "B03", name: "Uniqlo", code: "UNQ", country: "JP", activeOrders: 7, units: 28900 },
  { id: "B04", name: "Zara", code: "ZRA", country: "ES", activeOrders: 6, units: 22400 },
  { id: "B05", name: "GAP", code: "GAP", country: "US", activeOrders: 5, units: 19800 },
  { id: "B06", name: "Levi's", code: "LVI", country: "US", activeOrders: 4, units: 14200 },
  { id: "B07", name: "Decathlon", code: "DCT", country: "FR", activeOrders: 3, units: 12600 },
];

export const vendors = [
  { id: "V01", name: "Shree Knit Works", process: "Knitting", capacity: 8000, pending: 3200, otd: 92, quality: 96 },
  { id: "V02", name: "Anand Linking Co.", process: "Linking", capacity: 6500, pending: 2100, otd: 88, quality: 94 },
  { id: "V03", name: "Crystal Wash House", process: "Washing", capacity: 12000, pending: 4500, otd: 85, quality: 91 },
  { id: "V04", name: "Premier Finishing", process: "Finishing", capacity: 9000, pending: 1800, otd: 95, quality: 97 },
  { id: "V05", name: "Modern Embroidery", process: "Embroidery", capacity: 4200, pending: 900, otd: 90, quality: 93 },
  { id: "V06", name: "Rajan Pressing Unit", process: "Ironing", capacity: 11000, pending: 2400, otd: 89, quality: 95 },
];

export const suppliers = [
  { id: "S01", name: "Vardhman Yarns", material: "100% Cotton 2/30s", lead: 12 },
  { id: "S02", name: "Nahar Spinning", material: "Acrylic 2/32s", lead: 9 },
  { id: "S03", name: "Sutlej Textiles", material: "Wool Blend 2/28s", lead: 18 },
  { id: "S04", name: "Pratibha Trims", material: "Buttons & Labels", lead: 7 },
];

export const styles = [
  { id: "ST101", code: "MNS-CR-2401", brand: "Marks & Spencer", name: "Cable Knit Crew Neck", gauge: "7GG", yarn: "100% Cotton", colors: 4, sizes: ["S","M","L","XL","XXL"] },
  { id: "ST102", code: "HM-VN-2402", brand: "H&M", name: "V-Neck Pullover", gauge: "12GG", yarn: "Acrylic Blend", colors: 6, sizes: ["XS","S","M","L","XL"] },
  { id: "ST103", code: "UNQ-CG-2403", brand: "Uniqlo", name: "Cardigan Full Zip", gauge: "5GG", yarn: "Merino Wool", colors: 3, sizes: ["S","M","L","XL"] },
  { id: "ST104", code: "ZRA-TN-2404", brand: "Zara", name: "Turtleneck Ribbed", gauge: "12GG", yarn: "Cotton Acrylic", colors: 5, sizes: ["S","M","L","XL"] },
  { id: "ST105", code: "GAP-HD-2405", brand: "GAP", name: "Hooded Knit Sweater", gauge: "7GG", yarn: "Cotton", colors: 4, sizes: ["S","M","L","XL","XXL"] },
  { id: "ST106", code: "LVI-CN-2406", brand: "Levi's", name: "Crew Neck Jacquard", gauge: "7GG", yarn: "Wool Blend", colors: 3, sizes: ["M","L","XL"] },
];

export type OrderStatus = "Created" | "Planned" | "In Production" | "QA" | "Dispatched" | "Delayed";

export const orders = [
  { id: "PO-24-1011", brand: "Marks & Spencer", style: "MNS-CR-2401", styleName: "Cable Knit Crew Neck", season: "AW24", qty: 18500, delivered: 18500, due: "2024-11-15", status: "Dispatched" as OrderStatus, priority: "High", progress: 100 },
  { id: "PO-24-1012", brand: "H&M", style: "HM-VN-2402", styleName: "V-Neck Pullover", season: "AW24", qty: 24000, delivered: 16800, due: "2024-12-20", status: "In Production" as OrderStatus, priority: "High", progress: 70 },
  { id: "PO-24-1013", brand: "Uniqlo", style: "UNQ-CG-2403", styleName: "Cardigan Full Zip", season: "AW24", qty: 15000, delivered: 9000, due: "2024-12-28", status: "In Production" as OrderStatus, priority: "Medium", progress: 60 },
  { id: "PO-24-1014", brand: "Zara", style: "ZRA-TN-2404", styleName: "Turtleneck Ribbed", season: "AW24", qty: 12500, delivered: 4200, due: "2024-12-10", status: "Delayed" as OrderStatus, priority: "Critical", progress: 34 },
  { id: "PO-24-1015", brand: "GAP", style: "GAP-HD-2405", styleName: "Hooded Knit Sweater", season: "SS25", qty: 22000, delivered: 0, due: "2025-02-15", status: "Planned" as OrderStatus, priority: "Medium", progress: 0 },
  { id: "PO-24-1016", brand: "Marks & Spencer", style: "MNS-CR-2401", styleName: "Cable Knit Crew Neck", season: "SS25", qty: 30000, delivered: 0, due: "2025-03-01", status: "Created" as OrderStatus, priority: "Low", progress: 0 },
  { id: "PO-24-1017", brand: "Levi's", style: "LVI-CN-2406", styleName: "Crew Neck Jacquard", season: "AW24", qty: 8500, delivered: 8200, due: "2024-11-30", status: "QA" as OrderStatus, priority: "High", progress: 96 },
  { id: "PO-24-1018", brand: "H&M", style: "HM-VN-2402", styleName: "V-Neck Pullover", season: "SS25", qty: 20000, delivered: 0, due: "2025-02-28", status: "Planned" as OrderStatus, priority: "Medium", progress: 0 },
  { id: "PO-24-1019", brand: "Decathlon", style: "ZRA-TN-2404", styleName: "Sport Knit", season: "AW24", qty: 9500, delivered: 6700, due: "2024-12-18", status: "In Production" as OrderStatus, priority: "Medium", progress: 70 },
  { id: "PO-24-1020", brand: "Uniqlo", style: "UNQ-CG-2403", styleName: "Cardigan Full Zip", season: "SS25", qty: 18000, delivered: 0, due: "2025-03-15", status: "Created" as OrderStatus, priority: "Low", progress: 0 },
];

export const productionStages = [
  { stage: "Yarn Inward", planned: 200000, actual: 187500, wip: 0, rejected: 1200, pending: 12500 },
  { stage: "Knitting", planned: 187500, actual: 162400, wip: 14200, rejected: 2800, pending: 25100 },
  { stage: "Linking", planned: 162400, actual: 148900, wip: 8900, rejected: 1500, pending: 13500 },
  { stage: "Washing", planned: 148900, actual: 134200, wip: 9800, rejected: 1100, pending: 14700 },
  { stage: "Drying", planned: 134200, actual: 128400, wip: 4200, rejected: 400, pending: 5800 },
  { stage: "Finishing", planned: 128400, actual: 115800, wip: 7400, rejected: 900, pending: 12600 },
  { stage: "Ironing", planned: 115800, actual: 108200, wip: 5100, rejected: 350, pending: 7600 },
  { stage: "Quality Check", planned: 108200, actual: 102400, wip: 3800, rejected: 2400, pending: 5800 },
  { stage: "Packing", planned: 102400, actual: 98200, wip: 2900, rejected: 180, pending: 4200 },
  { stage: "Dispatch", planned: 98200, actual: 92400, wip: 0, rejected: 0, pending: 5800 },
];

export const dailyTrend = [
  { day: "Mon", planned: 7200, actual: 6800, rejected: 180 },
  { day: "Tue", planned: 7400, actual: 7100, rejected: 220 },
  { day: "Wed", planned: 7400, actual: 7600, rejected: 140 },
  { day: "Thu", planned: 7600, actual: 7200, rejected: 260 },
  { day: "Fri", planned: 7600, actual: 7800, rejected: 190 },
  { day: "Sat", planned: 6800, actual: 6400, rejected: 210 },
  { day: "Sun", planned: 4200, actual: 3900, rejected: 90 },
];

export const monthlyCapacity = [
  { month: "Jul", capacity: 200000, used: 168000 },
  { month: "Aug", capacity: 200000, used: 184000 },
  { month: "Sep", capacity: 200000, used: 192000 },
  { month: "Oct", capacity: 200000, used: 201000 },
  { month: "Nov", capacity: 200000, used: 195000 },
  { month: "Dec", capacity: 200000, used: 178000 },
];

export const brandSummary = brands.map((b) => ({
  brand: b.name,
  units: b.units,
}));

export const lines = [
  { id: "L1", name: "Knitting Line 1", machines: 24, gauge: "7GG", efficiency: 87, output: 2200 },
  { id: "L2", name: "Knitting Line 2", machines: 24, gauge: "7GG", efficiency: 91, output: 2400 },
  { id: "L3", name: "Knitting Line 3", machines: 18, gauge: "12GG", efficiency: 84, output: 1800 },
  { id: "L4", name: "Knitting Line 4", machines: 18, gauge: "12GG", efficiency: 88, output: 1950 },
  { id: "L5", name: "Knitting Line 5", machines: 12, gauge: "5GG", efficiency: 79, output: 1100 },
  { id: "L6", name: "Linking Line A", machines: 32, gauge: "All", efficiency: 92, output: 3200 },
  { id: "L7", name: "Finishing Hall", machines: 40, gauge: "All", efficiency: 90, output: 3800 },
];

export const inventory = [
  { id: "Y001", name: "Cotton Yarn 2/30s — Ecru", type: "Yarn", uom: "Kg", stock: 12400, min: 5000, allocated: 8200, supplier: "Vardhman" },
  { id: "Y002", name: "Acrylic 2/32s — Navy", type: "Yarn", uom: "Kg", stock: 3200, min: 4000, allocated: 2800, supplier: "Nahar" },
  { id: "Y003", name: "Wool Blend 2/28s — Charcoal", type: "Yarn", uom: "Kg", stock: 8600, min: 3000, allocated: 5400, supplier: "Sutlej" },
  { id: "Y004", name: "Merino Wool 2/30s — Burgundy", type: "Yarn", uom: "Kg", stock: 1800, min: 2000, allocated: 1500, supplier: "Sutlej" },
  { id: "T001", name: "Horn Buttons 18mm", type: "Trim", uom: "Pcs", stock: 240000, min: 50000, allocated: 180000, supplier: "Pratibha" },
  { id: "T002", name: "Woven Brand Label", type: "Label", uom: "Pcs", stock: 86000, min: 30000, allocated: 64000, supplier: "Pratibha" },
  { id: "T003", name: "Care Label", type: "Label", uom: "Pcs", stock: 124000, min: 40000, allocated: 92000, supplier: "Pratibha" },
  { id: "T004", name: "Polybag 30x40", type: "Packing", uom: "Pcs", stock: 18000, min: 20000, allocated: 14000, supplier: "Local" },
];

export const qaDefects = [
  { type: "Hole / Drop Stitch", count: 312, pct: 28 },
  { type: "Linking Misalign", count: 248, pct: 22 },
  { type: "Color Variation", count: 186, pct: 17 },
  { type: "Size Out of Spec", count: 142, pct: 13 },
  { type: "Wash Defect", count: 98, pct: 9 },
  { type: "Trim/Button Issue", count: 72, pct: 7 },
  { type: "Other", count: 48, pct: 4 },
];

export const alerts = [
  { id: 1, severity: "critical", title: "PO-24-1014 Zara delayed by 6 days", time: "12 min ago", module: "Orders" },
  { id: 2, severity: "warning", title: "Acrylic 2/32s — Navy below minimum stock", time: "1 hr ago", module: "Inventory" },
  { id: 3, severity: "warning", title: "Vendor Crystal Wash House OTD dropped to 85%", time: "3 hr ago", module: "Vendor" },
  { id: 4, severity: "info", title: "Knitting Line 5 efficiency under 80%", time: "5 hr ago", module: "Production" },
  { id: 5, severity: "critical", title: "QA rejection spike on PO-24-1013 — Cardigan", time: "Today 09:14", module: "QA" },
  { id: 6, severity: "warning", title: "Yarn shipment from Vardhman delayed (ETA +4d)", time: "Yesterday", module: "Stores" },
];

export const kpis = {
  totalOrders: 47,
  unitsPlanned: 982400,
  unitsInProduction: 162400,
  unitsCompleted: 92400,
  delayedOrders: 4,
  vendorPending: 14900,
  rejectionPct: 2.4,
  wastagePct: 1.8,
  lineEfficiency: 87.6,
  otif: 91.2,
  capacityUtilization: 92,
};

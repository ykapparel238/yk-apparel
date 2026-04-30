import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("Refusing to run seed in production without ALLOW_PROD_SEED=true");
  }

  await prisma.alert.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.procurementRequest.deleteMany();
  await prisma.dispatchShipment.deleteMany();
  await prisma.qaInspectionDefect.deleteMany();
  await prisma.qaInspection.deleteMany();
  await prisma.qaDefectType.deleteMany();
  await prisma.vendorWeeklyMetric.deleteMany();
  await prisma.vendorChallan.deleteMany();
  await prisma.lineDailyMetric.deleteMany();
  await prisma.stageDailyMetric.deleteMany();
  await prisma.productionPlan.deleteMany();
  await prisma.purchaseOrderColorAllocation.deleteMany();
  await prisma.purchaseOrderSizeAllocation.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.billOfMaterialItem.deleteMany();
  await prisma.styleColor.deleteMany();
  await prisma.styleSize.deleteMany();
  await prisma.style.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.department.deleteMany();
  await prisma.productionLine.deleteMany();
  await prisma.vendor.deleteMany();

  const [knitting, linking, washing, finishing, qaDept, stores, dispatch] = await Promise.all([
    prisma.department.create({ data: { code: "D01", name: "Knitting", headName: "Suresh Kumar", staffCount: 84, lineCount: 5 } }),
    prisma.department.create({ data: { code: "D02", name: "Linking", headName: "Meena Sharma", staffCount: 42, lineCount: 1 } }),
    prisma.department.create({ data: { code: "D03", name: "Washing & Drying", headName: "Rakesh Patel", staffCount: 28, lineCount: 2 } }),
    prisma.department.create({ data: { code: "D04", name: "Finishing", headName: "Ananya Iyer", staffCount: 56, lineCount: 1 } }),
    prisma.department.create({ data: { code: "D05", name: "Quality Assurance", headName: "Devansh Rao", staffCount: 22, lineCount: 0 } }),
    prisma.department.create({ data: { code: "D06", name: "Stores & Inward", headName: "Prakash Nair", staffCount: 18, lineCount: 0 } }),
    prisma.department.create({ data: { code: "D07", name: "Dispatch", headName: "Vinod Singh", staffCount: 14, lineCount: 0 } }),
  ]);

  const [shiftA, shiftB, shiftC] = await Promise.all([
    prisma.shift.create({ data: { code: "SH-A", name: "Shift A — Morning", startTime: "06:00", endTime: "14:00", supervisorName: "Ravi Kumar", headcount: 142 } }),
    prisma.shift.create({ data: { code: "SH-B", name: "Shift B — Evening", startTime: "14:00", endTime: "22:00", supervisorName: "Sangeeta Devi", headcount: 128 } }),
    prisma.shift.create({ data: { code: "SH-C", name: "Shift C — Night", startTime: "22:00", endTime: "06:00", supervisorName: "Mohit Arora", headcount: 78 } }),
  ]);

  const users = await Promise.all([
    prisma.user.create({ data: { employeeCode: "U001", name: "Rohit Mehra", email: "rohit@knitcraft.in", passwordHash: bcrypt.hashSync("demo1234", 10), role: "ADMIN", departmentId: knitting.id, shiftId: shiftA.id } }),
    prisma.user.create({ data: { employeeCode: "U002", name: "Suresh Kumar", email: "suresh@knitcraft.in", passwordHash: bcrypt.hashSync("manager123", 10), role: "FACTORY_MANAGER", departmentId: knitting.id, shiftId: shiftA.id } }),
    prisma.user.create({ data: { employeeCode: "U003", name: "Meena Sharma", email: "meena@knitcraft.in", passwordHash: bcrypt.hashSync("planner123", 10), role: "PRODUCTION_PLANNER", departmentId: linking.id, shiftId: shiftA.id } }),
    prisma.user.create({ data: { employeeCode: "U004", name: "Devansh Rao", email: "devansh@knitcraft.in", passwordHash: bcrypt.hashSync("quality123", 10), role: "QA_MANAGER", departmentId: qaDept.id, shiftId: shiftA.id } }),
    prisma.user.create({ data: { employeeCode: "U005", name: "Prakash Nair", email: "prakash@knitcraft.in", passwordHash: bcrypt.hashSync("stores123", 10), role: "STORE_MANAGER", departmentId: stores.id, shiftId: shiftA.id } }),
    prisma.user.create({ data: { employeeCode: "U006", name: "Vinod Singh", email: "vinod@knitcraft.in", passwordHash: bcrypt.hashSync("dispatch123", 10), role: "DISPATCH_MANAGER", departmentId: dispatch.id, shiftId: shiftA.id } }),
  ]);

  const brands = await Promise.all([
    prisma.brand.create({ data: { code: "MNS", name: "Marks & Spencer", countryCode: "UK" } }),
    prisma.brand.create({ data: { code: "HM", name: "H&M", countryCode: "SE" } }),
    prisma.brand.create({ data: { code: "UNQ", name: "Uniqlo", countryCode: "JP" } }),
    prisma.brand.create({ data: { code: "ZRA", name: "Zara", countryCode: "ES" } }),
  ]);

  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { code: "S01", name: "Vardhman Yarns", defaultMaterial: "100% Cotton 2/30s", leadTimeDays: 12 } }),
    prisma.supplier.create({ data: { code: "S02", name: "Nahar Spinning", defaultMaterial: "Acrylic 2/32s", leadTimeDays: 9 } }),
    prisma.supplier.create({ data: { code: "S03", name: "Sutlej Textiles", defaultMaterial: "Wool Blend 2/28s", leadTimeDays: 18 } }),
    prisma.supplier.create({ data: { code: "S04", name: "Pratibha Trims", defaultMaterial: "Buttons & Labels", leadTimeDays: 7 } }),
  ]);

  const materials = await Promise.all([
    prisma.material.create({ data: { sku: "Y001", name: "Cotton Yarn 2/30s — Ecru", type: "YARN", uom: "Kg", stockQty: "12400", allocatedQty: "8200", reorderLevel: "5000", supplierId: suppliers[0].id } }),
    prisma.material.create({ data: { sku: "Y002", name: "Acrylic 2/32s — Navy", type: "YARN", uom: "Kg", stockQty: "3200", allocatedQty: "2800", reorderLevel: "4000", supplierId: suppliers[1].id } }),
    prisma.material.create({ data: { sku: "T001", name: "Horn Buttons 18mm", type: "TRIM", uom: "Pcs", stockQty: "240000", allocatedQty: "180000", reorderLevel: "50000", supplierId: suppliers[3].id } }),
    prisma.material.create({ data: { sku: "T002", name: "Woven Brand Label", type: "LABEL", uom: "Pcs", stockQty: "86000", allocatedQty: "64000", reorderLevel: "30000", supplierId: suppliers[3].id } }),
  ]);

  const vendors = await Promise.all([
    prisma.vendor.create({ data: { code: "V01", name: "Shree Knit Works", process: "Knitting", capacityPerDay: 8000 } }),
    prisma.vendor.create({ data: { code: "V02", name: "Anand Linking Co.", process: "Linking", capacityPerDay: 6500 } }),
    prisma.vendor.create({ data: { code: "V03", name: "Crystal Wash House", process: "Washing", capacityPerDay: 12000 } }),
    prisma.vendor.create({ data: { code: "V04", name: "Premier Finishing", process: "Finishing", capacityPerDay: 9000 } }),
  ]);

  const lines = await Promise.all([
    prisma.productionLine.create({ data: { code: "L1", name: "Knitting Line 1", process: "Knitting", gauge: "7GG", machineCount: 24 } }),
    prisma.productionLine.create({ data: { code: "L2", name: "Knitting Line 2", process: "Knitting", gauge: "7GG", machineCount: 24 } }),
    prisma.productionLine.create({ data: { code: "L3", name: "Knitting Line 3", process: "Knitting", gauge: "12GG", machineCount: 18 } }),
    prisma.productionLine.create({ data: { code: "L6", name: "Linking Line A", process: "Linking", gauge: "All", machineCount: 32 } }),
  ]);

  const styles = await Promise.all([
    prisma.style.create({ data: { code: "MNS-CR-2401", brandId: brands[0].id, name: "Cable Knit Crew Neck", gauge: "7GG", yarnDescription: "100% Cotton" } }),
    prisma.style.create({ data: { code: "HM-VN-2402", brandId: brands[1].id, name: "V-Neck Pullover", gauge: "12GG", yarnDescription: "Acrylic Blend" } }),
    prisma.style.create({ data: { code: "UNQ-CG-2403", brandId: brands[2].id, name: "Cardigan Full Zip", gauge: "5GG", yarnDescription: "Merino Wool" } }),
  ]);

  await prisma.styleSize.createMany({
    data: [
      { styleId: styles[0].id, label: "S", sortOrder: 1 },
      { styleId: styles[0].id, label: "M", sortOrder: 2 },
      { styleId: styles[0].id, label: "L", sortOrder: 3 },
      { styleId: styles[0].id, label: "XL", sortOrder: 4 },
      { styleId: styles[1].id, label: "XS", sortOrder: 1 },
      { styleId: styles[1].id, label: "S", sortOrder: 2 },
      { styleId: styles[1].id, label: "M", sortOrder: 3 },
      { styleId: styles[1].id, label: "L", sortOrder: 4 },
    ],
  });

  await prisma.styleColor.createMany({
    data: [
      { styleId: styles[0].id, name: "Ecru", hexCode: "#EFE7D6", sortOrder: 1 },
      { styleId: styles[0].id, name: "Charcoal", hexCode: "#3A3D44", sortOrder: 2 },
      { styleId: styles[1].id, name: "Navy", hexCode: "#1F2A4A", sortOrder: 1 },
      { styleId: styles[1].id, name: "Burgundy", hexCode: "#6E1F2C", sortOrder: 2 },
    ],
  });

  await prisma.billOfMaterialItem.createMany({
    data: [
      { styleId: styles[0].id, materialId: materials[0].id, quantityPerPiece: "0.42", uom: "Kg" },
      { styleId: styles[0].id, materialId: materials[2].id, quantityPerPiece: "5.00", uom: "Pcs" },
      { styleId: styles[0].id, materialId: materials[3].id, quantityPerPiece: "1.00", uom: "Pcs" },
      { styleId: styles[1].id, materialId: materials[1].id, quantityPerPiece: "0.38", uom: "Kg" },
    ],
  });

  const orders = await Promise.all([
    prisma.purchaseOrder.create({ data: { poNumber: "PO-24-1012", brandId: brands[1].id, styleId: styles[1].id, seasonCode: "AW24", quantity: 24000, deliveredQty: 16800, dueDate: new Date("2024-12-20"), status: "IN_PRODUCTION", priority: "HIGH" } }),
    prisma.purchaseOrder.create({ data: { poNumber: "PO-24-1013", brandId: brands[2].id, styleId: styles[2].id, seasonCode: "AW24", quantity: 15000, deliveredQty: 9000, dueDate: new Date("2024-12-28"), status: "IN_PRODUCTION", priority: "MEDIUM" } }),
    prisma.purchaseOrder.create({ data: { poNumber: "PO-24-1014", brandId: brands[3].id, styleId: styles[0].id, seasonCode: "AW24", quantity: 12500, deliveredQty: 4200, dueDate: new Date("2024-12-10"), status: "DELAYED", priority: "CRITICAL" } }),
    prisma.purchaseOrder.create({ data: { poNumber: "PO-24-1017", brandId: brands[0].id, styleId: styles[0].id, seasonCode: "AW24", quantity: 8500, deliveredQty: 8200, dueDate: new Date("2024-11-30"), status: "QA", priority: "HIGH" } }),
  ]);

  await prisma.purchaseOrderSizeAllocation.createMany({
    data: [
      { orderId: orders[0].id, sizeLabel: "XS", percent: 8 },
      { orderId: orders[0].id, sizeLabel: "S", percent: 18 },
      { orderId: orders[0].id, sizeLabel: "M", percent: 28 },
      { orderId: orders[0].id, sizeLabel: "L", percent: 26 },
      { orderId: orders[0].id, sizeLabel: "XL", percent: 14 },
      { orderId: orders[0].id, sizeLabel: "XXL", percent: 6 },
    ],
  });

  await prisma.purchaseOrderColorAllocation.createMany({
    data: [
      { orderId: orders[0].id, colorName: "Ecru", hexCode: "#EFE7D6", percent: 32 },
      { orderId: orders[0].id, colorName: "Charcoal", hexCode: "#3A3D44", percent: 28 },
      { orderId: orders[0].id, colorName: "Burgundy", hexCode: "#6E1F2C", percent: 22 },
      { orderId: orders[0].id, colorName: "Navy", hexCode: "#1F2A4A", percent: 18 },
    ],
  });

  await prisma.productionPlan.createMany({
    data: [
      { orderId: orders[0].id, lineId: lines[0].id, startDate: new Date("2024-11-18"), endDate: new Date("2024-12-05"), plannedQty: 14000, dailyTarget: 2200, status: "ACTIVE" },
      { orderId: orders[0].id, lineId: lines[1].id, startDate: new Date("2024-11-18"), endDate: new Date("2024-12-05"), plannedQty: 10000, dailyTarget: 1800, status: "ACTIVE" },
      { orderId: orders[1].id, lineId: lines[3].id, startDate: new Date("2024-11-21"), endDate: new Date("2024-12-10"), plannedQty: 15000, dailyTarget: 1600, status: "ACTIVE" },
    ],
  });

  const stageTemplates = [
    { stage: "YARN_INWARD", plannedQty: 200000, actualQty: 187500, wipQty: 0, rejectedQty: 1200, pendingQty: 12500 },
    { stage: "KNITTING", plannedQty: 187500, actualQty: 162400, wipQty: 14200, rejectedQty: 2800, pendingQty: 25100 },
    { stage: "LINKING", plannedQty: 162400, actualQty: 148900, wipQty: 8900, rejectedQty: 1500, pendingQty: 13500 },
    { stage: "WASHING", plannedQty: 148900, actualQty: 134200, wipQty: 9800, rejectedQty: 1100, pendingQty: 14700 },
    { stage: "DRYING", plannedQty: 134200, actualQty: 128400, wipQty: 4200, rejectedQty: 400, pendingQty: 5800 },
    { stage: "FINISHING", plannedQty: 128400, actualQty: 115800, wipQty: 7400, rejectedQty: 900, pendingQty: 12600 },
    { stage: "IRONING", plannedQty: 115800, actualQty: 108200, wipQty: 5100, rejectedQty: 350, pendingQty: 7600 },
    { stage: "QUALITY_CHECK", plannedQty: 108200, actualQty: 102400, wipQty: 3800, rejectedQty: 2400, pendingQty: 5800 },
    { stage: "PACKING", plannedQty: 102400, actualQty: 98200, wipQty: 2900, rejectedQty: 180, pendingQty: 4200 },
    { stage: "DISPATCH", plannedQty: 98200, actualQty: 92400, wipQty: 0, rejectedQty: 0, pendingQty: 5800 },
  ];

  const stageMetrics = [];
  const lineMetrics = [];
  for (let day = 1; day <= 30; day += 1) {
    const metricDate = new Date(`2024-11-${String(day).padStart(2, "0")}T08:00:00Z`);
    stageTemplates.forEach((template, index) => {
      const drift = ((day * 137 + index * 71) % 900) - 450;
      const plannedQty = template.plannedQty;
      const actualQty = Math.max(0, template.actualQty + drift);
      const rejectedQty = Math.max(0, template.rejectedQty + ((day + index) % 160) - 40);
      const pendingQty = Math.max(0, template.pendingQty - drift);

      stageMetrics.push({
        metricDate,
        stage: template.stage,
        plannedQty,
        actualQty,
        wipQty: template.wipQty,
        rejectedQty,
        pendingQty,
      });
    });

    lines.forEach((line, index) => {
      lineMetrics.push({
        metricDate,
        lineId: line.id,
        efficiencyPct: 82 + ((day * 5 + index * 9) % 13),
        outputQty: 1600 + ((day * 131 + index * 173) % 1700),
        isRunning: true,
      });
    });
  }

  await prisma.stageDailyMetric.createMany({ data: stageMetrics });
  await prisma.lineDailyMetric.createMany({ data: lineMetrics });

  await prisma.vendorChallan.createMany({
    data: [
      { challanNumber: "CH-2401", challanDate: new Date("2024-11-02"), vendorId: vendors[0].id, orderId: orders[0].id, process: "Knitting", outwardQty: 6000, inwardQty: 5800, rejectedQty: 120, status: "CLOSED" },
      { challanNumber: "CH-2402", challanDate: new Date("2024-11-05"), vendorId: vendors[1].id, orderId: orders[1].id, process: "Linking", outwardQty: 4500, inwardQty: 4200, rejectedQty: 80, status: "PARTIAL" },
      { challanNumber: "CH-2403", challanDate: new Date("2024-11-08"), vendorId: vendors[2].id, orderId: orders[0].id, process: "Washing", outwardQty: 5600, inwardQty: 0, rejectedQty: 0, status: "OPEN" },
    ],
  });

  const defectTypes = await Promise.all([
    prisma.qaDefectType.create({ data: { code: "HOLE_DROP", name: "Hole / Drop Stitch" } }),
    prisma.qaDefectType.create({ data: { code: "LINK_MISALIGN", name: "Linking Misalign" } }),
    prisma.qaDefectType.create({ data: { code: "COLOR_VARIATION", name: "Color Variation" } }),
  ]);

  const inspection = await prisma.qaInspection.create({
    data: {
      inspectedAt: new Date("2024-11-15T09:00:00Z"),
      orderId: orders[1].id,
      vendorId: vendors[1].id,
      lineId: lines[3].id,
      stage: "QUALITY_CHECK",
      checkedQty: 1800,
      approvedQty: 1680,
      rejectedQty: 120,
      reworkQty: 55,
    },
  });

  await prisma.qaInspectionDefect.createMany({
    data: [
      { inspectionId: inspection.id, defectTypeId: defectTypes[0].id, count: 42 },
      { inspectionId: inspection.id, defectTypeId: defectTypes[1].id, count: 33 },
      { inspectionId: inspection.id, defectTypeId: defectTypes[2].id, count: 18 },
    ],
  });

  await prisma.vendorWeeklyMetric.createMany({
    data: [
      { vendorId: vendors[0].id, weekStartDate: new Date("2024-10-07"), onTimePct: 88, throughputQty: 4200, qualityPct: 95 },
      { vendorId: vendors[0].id, weekStartDate: new Date("2024-10-14"), onTimePct: 91, throughputQty: 4600, qualityPct: 96 },
      { vendorId: vendors[0].id, weekStartDate: new Date("2024-10-21"), onTimePct: 87, throughputQty: 4100, qualityPct: 94 },
      { vendorId: vendors[0].id, weekStartDate: new Date("2024-10-28"), onTimePct: 92, throughputQty: 5200, qualityPct: 97 },
      { vendorId: vendors[0].id, weekStartDate: new Date("2024-11-04"), onTimePct: 94, throughputQty: 5400, qualityPct: 97 },
      { vendorId: vendors[0].id, weekStartDate: new Date("2024-11-11"), onTimePct: 90, throughputQty: 4800, qualityPct: 96 },
    ],
  });

  await prisma.dispatchShipment.create({
    data: {
      shipmentNumber: "SHIP-2401",
      orderId: orders[3].id,
      dispatchDate: new Date("2024-11-16"),
      quantity: 8200,
      invoiceNumber: "INV-2401",
      status: "SCHEDULED",
    },
  });

  await prisma.procurementRequest.createMany({
    data: [
      {
        materialId: materials[1].id,
        supplierId: suppliers[1].id,
        createdByUserId: users[4].id,
        shortageQty: "2336.00",
        requestedQty: "2400.00",
        note: "Open demand shortfall for H&M V-Neck Pullover",
        status: "OPEN",
      },
      {
        materialId: materials[0].id,
        supplierId: suppliers[0].id,
        createdByUserId: users[4].id,
        shortageQty: "0.00",
        requestedQty: "1500.00",
        note: "Buffer replenishment completed",
        status: "CLOSED",
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { actorUserId: users[1].id, module: "Planning", action: "Approved Production Plan", targetType: "ProductionPlan", targetLabel: "Plan for PO-24-1012" },
      { actorUserId: users[2].id, module: "Planning", action: "Reassigned Line 3", targetType: "PurchaseOrder", targetId: orders[1].id, targetLabel: "PO-24-1013" },
      { actorUserId: users[3].id, module: "QA", action: "Rejected Lot", targetType: "QaInspection", targetId: inspection.id, targetLabel: "Inspection 2024-11-15" },
    ],
  });

  await prisma.alert.createMany({
    data: [
      { severity: "CRITICAL", title: "PO-24-1014 Zara delayed by 6 days", module: "Orders", orderId: orders[2].id },
      { severity: "WARNING", title: "Acrylic 2/32s — Navy below minimum stock", module: "Inventory", materialId: materials[1].id },
      { severity: "WARNING", title: "Vendor Crystal Wash House OTD dropped to 85%", module: "Vendor", vendorId: vendors[2].id },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

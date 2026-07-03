import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    throw new Error("Refusing to create admin in production without ALLOW_ADMIN_BOOTSTRAP=true");
  }

  const email = requireEnv("ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME?.trim() || "System Admin";
  const employeeCode = process.env.ADMIN_EMPLOYEE_CODE?.trim() || "ADMIN-001";

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const department = await prisma.department.upsert({
    where: { code: "ADMIN" },
    update: { name: "Administration" },
    create: {
      code: "ADMIN",
      name: "Administration",
      headName: name,
      staffCount: 1,
      lineCount: 0,
    },
  });

  const shift = await prisma.shift.upsert({
    where: { code: "GENERAL" },
    update: { name: "General Shift", startTime: "09:00", endTime: "18:00" },
    create: {
      code: "GENERAL",
      name: "General Shift",
      startTime: "09:00",
      endTime: "18:00",
      supervisorName: name,
      headcount: 1,
    },
  });

  const passwordHash = bcrypt.hashSync(password, 10);
  const existingByEmail = await prisma.user.findUnique({ where: { email } });

  if (existingByEmail) {
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        name,
        employeeCode,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        departmentId: department.id,
        shiftId: shift.id,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        employeeCode,
        name,
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        departmentId: department.id,
        shiftId: shift.id,
      },
    });
  }

  console.log(`Admin user ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

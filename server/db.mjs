import { PrismaClient } from "@prisma/client";
import { getEnv } from "./env.mjs";

getEnv();

export const prisma = new PrismaClient();

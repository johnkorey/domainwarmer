import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create default settings (admin user is created via /setup page on first visit)
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      defaultFromName: "Team",
      maxDailyGlobalEmails: 500,
      warmingEnabled: true,
    },
  });
  console.log("Default settings created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

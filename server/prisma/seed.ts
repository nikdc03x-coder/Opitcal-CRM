import "dotenv/config";
import { prisma } from "../src/config/database";
import { SHOP_CODE } from "../src/services/shopService";
import { logError } from "../src/utils/logError";

// Provision the required shop without overwriting its name or inserting demo records.
async function main() {
  await prisma.shop.upsert({
    where: { code: SHOP_CODE },
    update: {},
    create: { code: SHOP_CODE, name: "Optical Shop" },
  });
  console.log("Required shop is ready. Existing shop and customer data were preserved.");
}

main()
  .catch((error) => {
    logError("Shop provisioning failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

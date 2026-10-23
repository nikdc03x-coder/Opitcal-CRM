import "dotenv/config";
import { prisma } from "../../src/config/database";
import { searchCustomers, getCustomerById } from "../../src/services/customerService";
import { listTrash } from "../../src/services/deletionService";
import { getDashboardAnalytics } from "../../src/services/dashboardService";

// Read-only check against the configured database; never print customer data.
async function main() {
  try {
    const customers = await searchCustomers();
    if (customers[0]) {
      const details = await getCustomerById(customers[0].id);
      if (!details) throw new Error("Active customer details could not be loaded.");
    }
    await listTrash();
    await getDashboardAnalytics();
    console.log(
      "PASS: customer search, customer details with purchases/prescriptions, Trash and dashboard database reads.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
      : "Read verification failed.",
  );
  process.exitCode = 1;
});

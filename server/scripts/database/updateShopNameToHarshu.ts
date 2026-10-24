import "dotenv/config";
import { prisma } from "../../src/config/database";
import { logError } from "../../src/utils/logError";

async function main() {
  console.log("Updating shop name and templates to 'Harshu Chasma Ghar'...");

  // 1. Update all shops to Harshu Chasma Ghar
  const shopUpdate = await prisma.shop.updateMany({
    data: {
      name: "Harshu Chasma Ghar",
    },
  });
  console.log(`Updated ${shopUpdate.count} shop(s) to 'Harshu Chasma Ghar'.`);

  // 2. Update existing reminder attempts that contain "Optical CRM Demo Shop" or "Demo Shop"
  const attempts = await prisma.reminderAttempt.findMany({
    where: {
      OR: [
        { messageContent: { contains: "Optical CRM Demo Shop" } },
        { messageContent: { contains: "Demo Shop" } },
      ],
    },
  });

  let attemptsUpdated = 0;
  for (const att of attempts) {
    const updatedContent = att.messageContent
      .replace(/Optical CRM Demo Shop/g, "Harshu Chasma Ghar")
      .replace(/Demo Shop/g, "Harshu Chasma Ghar");
    if (updatedContent !== att.messageContent) {
      await prisma.reminderAttempt.update({
        where: { id: att.id },
        data: { messageContent: updatedContent },
      });
      attemptsUpdated++;
    }
  }
  console.log(`Updated ${attemptsUpdated} reminder attempt message(s).`);

  // 3. Update existing reminder templates
  const templates = await prisma.reminderTemplate.findMany();
  let templatesUpdated = 0;
  for (const tpl of templates) {
    if (tpl.bodyText.includes("Demo Shop") || tpl.bodyText.includes("Optical CRM Demo Shop")) {
      const updatedBody = tpl.bodyText
        .replace(/Optical CRM Demo Shop/g, "Harshu Chasma Ghar")
        .replace(/Demo Shop/g, "Harshu Chasma Ghar");
      await prisma.reminderTemplate.update({
        where: { id: tpl.id },
        data: { bodyText: updatedBody },
      });
      templatesUpdated++;
    }
  }
  console.log(`Updated ${templatesUpdated} reminder template(s).`);

  console.log("Shop name update completed successfully!");
}

main()
  .catch((err) => {
    logError("Failed to update shop name", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

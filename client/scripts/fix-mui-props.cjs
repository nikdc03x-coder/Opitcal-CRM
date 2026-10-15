
const fs = require("node:fs");
const path = require("node:path");

// Fix Material UI styling props in our CRM pages.
// nik
const files = [
  "src/pages/AddCustomerPage.tsx",
  "src/pages/CustomerDetailPage.tsx",
  "src/pages/CustomersPage.tsx",
  "src/pages/DashboardPage.tsx",
  "src/pages/NotFoundPage.tsx",
];

const styleProps = [
  "fontWeight",
  "justifyContent",
  "alignItems",
];

function fixTag(tag) {
  const values = {};

  // Find styling properties written directly on components.
  for (const prop of styleProps) {
    const pattern = new RegExp(
      `\\s${prop}=(\\{[^{}]*\\}|"[^"]*")`,
      "g"
    );

    const matches = [...tag.matchAll(pattern)];

    for (const match of matches) {
      values[prop] = match[1];
      tag = tag.replace(match[0], "");
    }
  }

  if (Object.keys(values).length === 0) {
    return tag;
  }

  // Convert JSX values into values that work inside sx.
  const additions = Object.entries(values)
    .map(([key, value]) => {
      const expression = value.startsWith("{")
        ? value.slice(1, -1)
        : value;

      return `${key}: ${expression}`;
    })
    .join(", ");

  // Merge into the existing sx object when present.
  if (tag.includes("sx={{")) {
    return tag.replace(
      "sx={{",
      `sx={{ ${additions}, `
    );
  }

  // Otherwise, add a new sx object to the opening tag.
  return tag.replace(
    /\/?>$/,
    ending => ` sx={{ ${additions} }}${ending}`
  );
}

for (const file of files) {
  const fullPath = path.resolve(file);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipped missing file: ${file}`);
    continue;
  }

  let source = fs.readFileSync(fullPath, "utf8");

  // Check only opening Typography and Stack elements.
  source = source.replace(
    /<(Typography|Stack)\b[^>]*>/gs,
    fixTag
  );

  fs.writeFileSync(fullPath, source, "utf8");

  console.log(`Checked: ${file}`);
}

console.log("Material UI prop migration completed.");

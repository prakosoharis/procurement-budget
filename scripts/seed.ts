import { seedBudgetRows } from "../db/seed";

seedBudgetRows()
  .then((count) => {
    console.log(`Seeded ${count} budget rows.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

// Regenerates the synthetic demo CSVs in /public with sign-in dates relative to today.
// Run with: npm run sample:csv   (Node 22.18+/24 strips TypeScript types natively)
import { writeFileSync } from "node:fs";
import { buildBlankTemplateCsv, buildSampleCsv } from "../src/lib/sampleData.ts";

writeFileSync("public/sample-hope-valley-users.csv", buildSampleCsv());
writeFileSync("public/blank-user-import-template.csv", buildBlankTemplateCsv());
console.log("Wrote public/sample-hope-valley-users.csv and public/blank-user-import-template.csv");

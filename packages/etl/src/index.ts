import { ingestMotions } from "./ingest/ingestMotions";
import { ingestVotes } from "./ingest/ingestVotes";

const args = new Set(process.argv.slice(2));
const useMock = args.has("--mock");

async function run() {
  console.log(`[etl] starting ingest (mock=${useMock})`);
  await ingestMotions({ mock: useMock });
  await ingestVotes({ mock: useMock });
  console.log("[etl] done");
}

run().catch((error) => {
  console.error("[etl] failed", error);
  process.exit(1);
});

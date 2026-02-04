import { prisma } from "@ntp/db";
import { fetchMotions, MotionPayload } from "../clients/tkClient";
import fs from "node:fs/promises";
import path from "node:path";

interface IngestOptions {
  mock: boolean;
}

async function loadMock(): Promise<MotionPayload[]> {
  const filePath = path.join(process.cwd(), "mock-data", "motions.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as MotionPayload[];
}

export async function ingestMotions({ mock }: IngestOptions) {
  const motions = mock ? await loadMock() : await fetchMotions();

  for (const motion of motions) {
    await prisma.rawIngest.create({
      data: {
        source: "tk",
        resourceType: "motion",
        sourceUrl: motion.sourceUrl,
        payload: motion
      }
    });

    await prisma.motion.upsert({
      where: { tkId: motion.tkId },
      update: {
        title: motion.title,
        text: motion.text,
        dateIntroduced: new Date(motion.dateIntroduced),
        status: motion.status,
        sourceUrl: motion.sourceUrl
      },
      create: {
        tkId: motion.tkId,
        title: motion.title,
        text: motion.text,
        dateIntroduced: new Date(motion.dateIntroduced),
        status: motion.status,
        sourceUrl: motion.sourceUrl
      }
    });
  }
}

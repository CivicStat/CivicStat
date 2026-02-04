import { prisma } from "@ntp/db";
import { fetchVotes, VotePayload } from "../clients/tkClient";
import fs from "node:fs/promises";
import path from "node:path";

interface IngestOptions {
  mock: boolean;
}

async function loadMock(): Promise<VotePayload[]> {
  const filePath = path.join(process.cwd(), "mock-data", "votes.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as VotePayload[];
}

export async function ingestVotes({ mock }: IngestOptions) {
  const votes = mock ? await loadMock() : await fetchVotes();

  for (const vote of votes) {
    await prisma.rawIngest.create({
      data: {
        source: "tk",
        resourceType: "vote",
        sourceUrl: vote.sourceUrl,
        payload: vote
      }
    });

    await prisma.vote.upsert({
      where: { tkId: vote.tkId },
      update: {
        title: vote.title,
        date: new Date(vote.date),
        result: vote.result,
        sourceUrl: vote.sourceUrl
      },
      create: {
        tkId: vote.tkId,
        title: vote.title,
        date: new Date(vote.date),
        result: vote.result,
        sourceUrl: vote.sourceUrl
      }
    });
  }
}

export interface MotionPayload {
  tkId: string;
  title: string;
  text: string;
  dateIntroduced: string;
  status: string;
  sourceUrl: string;
}

export interface VotePayload {
  tkId: string;
  date: string;
  title: string;
  result: string;
  sourceUrl: string;
}

export async function fetchMotions(): Promise<MotionPayload[]> {
  throw new Error("fetchMotions not implemented yet");
}

export async function fetchVotes(): Promise<VotePayload[]> {
  throw new Error("fetchVotes not implemented yet");
}

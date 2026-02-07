import type {
  MotionListResponse,
  MotionDetail,
  PartyListItem,
  PartyDetail,
  MemberListItem,
  MemberDetail,
  VoteDetail,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://civicstat-api.fly.dev";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    next: { revalidate: 300 }, // cache 5 min (ISR)
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${url}`);
  }

  return res.json();
}

// ─── Motions ────────────────────────────────────────────────

export async function getMotions(params?: {
  q?: string;
  status?: string;
  party?: string;
  limit?: number;
  offset?: number;
}): Promise<MotionListResponse> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.status) sp.set("status", params.status);
  if (params?.party) sp.set("party", params.party);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));

  const qs = sp.toString();
  return apiFetch<MotionListResponse>(`/motions${qs ? `?${qs}` : ""}`);
}

export async function getMotion(id: string): Promise<MotionDetail> {
  return apiFetch<MotionDetail>(`/motions/${encodeURIComponent(id)}`);
}

// ─── Parties ────────────────────────────────────────────────

export async function getParties(): Promise<PartyListItem[]> {
  return apiFetch<PartyListItem[]>("/parties");
}

// ─── Members ────────────────────────────────────────────────

export async function getMembers(params?: {
  party?: string;
}): Promise<MemberListItem[]> {
  const sp = new URLSearchParams();
  if (params?.party) sp.set("party", params.party);
  const qs = sp.toString();
  return apiFetch<MemberListItem[]>(`/members${qs ? `?${qs}` : ""}`);
}

// ─── Member Detail ──────────────────────────────────────────

export async function getMember(id: string): Promise<MemberDetail> {
  return apiFetch<MemberDetail>(`/members/${encodeURIComponent(id)}`);
}

// ─── Party Detail ───────────────────────────────────────────

export async function getParty(id: string): Promise<PartyDetail> {
  return apiFetch<PartyDetail>(`/parties/${encodeURIComponent(id)}`);
}

// ─── Votes ──────────────────────────────────────────────────

export async function getVotes(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: VoteDetail[]; total: number; limit: number; offset: number }> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch(`/votes${qs ? `?${qs}` : ""}`);
}

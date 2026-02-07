// ─── API Response Types ─────────────────────────────────────

export interface PartyRef {
  id: string;
  name: string;
  abbreviation: string;
  colorNeutral?: string | null;
}

export interface MpRef {
  id: string;
  tkId?: string;
  name: string;
  surname: string;
  party?: PartyRef;
}

export interface SponsorRef {
  mp: MpRef;
  role?: string;
}

export interface VoteSummary {
  id: string;
  tkId: string;
  date?: string;
  result: string;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
}

export interface MotionListItem {
  id: string;
  tkId: string;
  tkNumber: string | null;
  title: string;
  text: string;
  dateIntroduced: string;
  status: string;
  statusDetail?: string | null;
  soort?: string | null;
  sourceUrl: string;
  sponsors: SponsorRef[];
  votes: VoteSummary[];
  // Legacy: single vote (API may return this or votes array)
  vote?: VoteSummary | null;
}

export interface MotionListResponse {
  items: MotionListItem[];
  total: number;
  limit: number;
  offset: number;
}

// Vote detail (for motion detail page)
export interface VoteRecord {
  id: string;
  voteValue: "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT";
  mp: MpRef;
  party: PartyRef;
}

// Raw Stemming entry from TK OData (party-level vote in rawData.Stemming)
export interface RawStemming {
  Id: string;
  Soort: string; // "Voor" | "Tegen" | "Niet deelgenomen"
  ActorNaam: string; // Party abbreviation
  ActorFractie?: string;
  Fractie_Id: string | null;
  Persoon_Id: string | null;
  FractieGrootte: number;
  Vergissing?: boolean;
}

export interface VoteDetail extends VoteSummary {
  date: string;
  title: string;
  records: VoteRecord[];
  rawData?: {
    StemmingsSoort?: string; // "Met handopsteken" | "Hoofdelijk"
    Stemming?: RawStemming[];
    [key: string]: unknown;
  };
  motion?: {
    id: string;
    tkId: string;
    title: string;
    tkNumber: string | null;
    text?: string;
  } | null;
}

export interface MotionDetail extends MotionListItem {
  vote: VoteDetail | null;
}

// Party types
export interface PartyListItem {
  id: string;
  tkId: string | null;
  name: string;
  abbreviation: string;
  colorNeutral: string | null;
  website: string | null;
  startDate: string | null;
  endDate: string | null;
  _count: { mps: number };
}

// Member types
export interface MemberListItem {
  id: string;
  tkId: string;
  name: string;
  initials: string | null;
  prefix: string | null;
  surname: string;
  gender: string | null;
  startDate: string;
  endDate: string | null;
  party: PartyRef;
  _count: { sponsors: number; voteRecords: number };
}

// Vote stats (shared between member & party detail)
export interface VoteStats {
  totalVotes: number;
  for: number;
  against: number;
  abstain: number;
  absent?: number;
  participationRate?: number;
  votesWon?: number;
  votesLost?: number;
}

// Member detail
export interface MemberDetail extends MemberListItem {
  constituency?: string | null;
  motions: {
    id: string;
    tkId: string;
    tkNumber: string | null;
    title: string;
    text: string;
    dateIntroduced: string;
    status: string;
    sponsors?: { role: string }[];
    vote?: {
      result: string;
      totalFor: number;
      totalAgainst: number;
    } | null;
  }[];
  voteStats: VoteStats;
}

// Party detail
export interface PartyDetail {
  id: string;
  tkId: string | null;
  name: string;
  abbreviation: string;
  colorNeutral: string | null;
  website: string | null;
  startDate: string | null;
  endDate: string | null;
  mps: {
    id: string;
    tkId: string;
    name: string;
    surname: string;
    startDate: string;
    endDate: string | null;
  }[];
  voteStats: VoteStats;
}

// Program match types
export interface ProgramMatch {
  id: string;
  score: number;
  rationaleJson: {
    algorithm: string;
    version: string;
    matchedKeywords?: string[];
    snippet?: string;
  };
  party: PartyRef;
  passage: {
    id: string;
    chapter: string | null;
    heading: string | null;
    passageText: string;
    program: {
      id: string;
      electionYear: number;
      title: string;
    };
  };
}

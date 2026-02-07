export type EntityType = "PARTY" | "MP";
export type SourceType = "OFFICIAL_DOC" | "DEBATE" | "PRESS" | "STATEMENT";
export type VoteValue = "FOR" | "AGAINST" | "ABSTAIN" | "ABSENT";
export type ConsultationStatus = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
export type ConsultationQuestionType = "POLL" | "TEXT";
export type UserRole = "public" | "citizen" | "verified_mp" | "admin" | "auditor";
export interface ProgramPassageMatch {
    motionId: string;
    partyId: string;
    passageId: string;
    score: number;
    rationale: {
        similarity: number;
        keywordOverlap: string[];
    };
}

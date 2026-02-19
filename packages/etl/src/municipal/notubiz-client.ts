/**
 * NotuBiz API Client
 *
 * REST API client for the NotuBiz raadsinformatiesysteem.
 * Used by Amsterdam (orgId=281) and Den Haag (orgId=318).
 *
 * Endpoints:
 *   GET api.notubiz.nl/events?format=json&organisation_id={id}&version=1.10.8&date_from=...&date_to=...
 *   GET api.notubiz.nl/events/meetings/{id}?format=json&version=1.10.8
 *   GET api.notubiz.nl/modules/0/items/{id}?format=json&version=1.10.8
 */

const BASE_URL = "https://api.notubiz.nl";
const API_VERSION = "1.10.8";

// ── Types ──────────────────────────────────────────────────

export interface NotubizEvent {
  id: number;
  type: string;
  body: string;
  canceled: boolean;
  inactive: boolean;
  organisation: { id: number };
  gremium?: { id: number };
  attributes: NotubizAttribute[];
  plannings: { start_date: string; end_date: string }[];
  event_type_data?: {
    self: string;
    agenda_item_count: number;
    document_count: number;
  };
}

export interface NotubizAttribute {
  id: number;
  reference_model: string | null;
  value: string;
}

export interface NotubizMeeting {
  id: number;
  agenda_items: NotubizAgendaItem[];
  plannings: { start_date: string; end_date: string }[];
  module_items: NotubizModuleItemRef[];
  documents: NotubizDocRef[];
}

export interface NotubizAgendaItem {
  id: number;
  type: string;
  type_data?: {
    heading: boolean;
    title_prefix?: string;
    attributes: NotubizAttribute[];
  };
  module_items: NotubizModuleItemRef[];
  documents: NotubizDocRef[];
  agenda_items: NotubizAgendaItem[]; // nested sub-items
}

export interface NotubizModuleItemRef {
  id: number;
  self: string;
  field_id: number;
}

export interface NotubizDocRef {
  id: number;
  self: string;
  url: string;
  title: string;
  description: string;
  confidential: number;
}

export interface NotubizModuleItem {
  attributes: {
    attribute: NotubizItemAttribute[];
  };
}

export interface NotubizItemAttribute {
  label: string;
  value?: string | NotubizDocValue | NotubizRefValues;
  values?: NotubizRefValues;
  "@attributes": {
    id: number;
    datatype: string;
    order: number;
    multiple: number;
    visible: string;
  };
}

export interface NotubizDocValue {
  title: string;
  filetype: string;
  url: string;
  types?: { type: { name: string; "@attributes": { id: number } }[] };
  "@attributes": { id: number; version: number };
}

export interface NotubizRefValues {
  value: NotubizRefValue[] | NotubizRefValue;
}

export interface NotubizRefValue {
  "@cdata": string;
  "@attributes": {
    id: number;
    reference_model: string; // "person", "party", "gremium", "agenda_item"
  };
}

// ── Parsed motie structure ─────────────────────────────────

export interface ParsedMotie {
  moduleItemId: number;
  title: string;
  type: string; // "Motie" | "Amendement"
  dateSubmitted: string; // ISO date
  result: string; // "aangenomen" | "verworpen" | "ingetrokken" | etc.
  resultExplanation: string; // Toelichting free text with vote breakdown
  submitters: { name: string; personId: number }[];
  parties: { name: string; partyId: number }[];
  documentUrl: string | null;
  documentTitle: string | null;
  linkedEventDescription: string | null;
  risNumber: string | null; // Den Haag-specific
  policyArea: string | null; // "Beleidsveld" — Den Haag-specific
  rawAttributes: Record<string, unknown>;
}

export interface ParsedVoteBreakdown {
  result: "aangenomen" | "verworpen" | "ingetrokken" | "unknown";
  method: "with_against" | "unanimous" | "no_vote" | "unknown";
  partiesAgainst: string[];
  partiesFor: string[];
  rawText: string;
}

// ── Client ─────────────────────────────────────────────────

export class NotubizClient {
  private orgId: number;

  constructor(orgId: number) {
    this.orgId = orgId;
  }

  private async fetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(path, BASE_URL);
    url.searchParams.set("format", "json");
    url.searchParams.set("version", API_VERSION);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`NotuBiz API ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Get events (meetings) for an organisation within a date range.
   * Date format: "YYYY-MM-DD HH:MM:SS" (URL-encoded)
   */
  async getEvents(dateFrom: Date, dateTo: Date): Promise<NotubizEvent[]> {
    const fmt = (d: Date) =>
      d.toISOString().replace("T", " ").replace(/\.\d+Z/, "");

    const data = await this.fetch<{ events: NotubizEvent[] }>("/events", {
      organisation_id: String(this.orgId),
      date_from: fmt(dateFrom),
      date_to: fmt(dateTo),
    });

    return data.events || [];
  }

  /**
   * Get full meeting details including agenda items and module items.
   */
  async getMeeting(meetingId: number): Promise<NotubizMeeting> {
    const data = await this.fetch<{ meeting: NotubizMeeting }>(
      `/events/meetings/${meetingId}`
    );
    return data.meeting;
  }

  /**
   * Get a module item (motie/amendement) by ID.
   */
  async getModuleItem(itemId: number): Promise<NotubizModuleItem> {
    const data = await this.fetch<{ item: NotubizModuleItem }>(
      `/modules/0/items/${itemId}`
    );
    return data.item;
  }

  /**
   * Download a document (PDF) by ID.
   */
  async getDocument(docId: number): Promise<Buffer> {
    const url = `${BASE_URL}/document/${docId}/1`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`NotuBiz document ${res.status}: ${url}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  // ── Higher-level helpers ──────────────────────────────────

  /**
   * Get all "Raad" meetings (plenary sessions) in a date range.
   * These are the meetings where votes on moties happen.
   */
  async getRaadMeetings(dateFrom: Date, dateTo: Date): Promise<NotubizEvent[]> {
    const events = await this.getEvents(dateFrom, dateTo);
    // Filter to plenary council meetings (title contains "Raad" or "RAAD" or "Gemeenteraad")
    return events.filter((e) => {
      const title = this.getEventTitle(e);
      return /\b(raad|gemeenteraad)\b/i.test(title) && !/(commissie|werkbezoek|expert)/i.test(title);
    });
  }

  /**
   * Extract all module item (motie) IDs from a meeting.
   */
  extractModuleItemIds(meeting: NotubizMeeting): number[] {
    const ids: number[] = [];

    // Top-level module items
    for (const mi of meeting.module_items || []) {
      ids.push(mi.id);
    }

    // Module items nested in agenda items
    const walk = (items: NotubizAgendaItem[]) => {
      for (const item of items) {
        for (const mi of item.module_items || []) {
          ids.push(mi.id);
        }
        if (item.agenda_items) {
          walk(item.agenda_items);
        }
      }
    };
    walk(meeting.agenda_items || []);

    return [...new Set(ids)]; // deduplicate
  }

  /**
   * Parse a module item into a structured motie.
   */
  parseModuleItem(item: NotubizModuleItem, moduleItemId: number): ParsedMotie | null {
    const attrs = item.attributes?.attribute || [];
    const attrMap = new Map<string, NotubizItemAttribute>();
    for (const a of attrs) {
      attrMap.set(a.label.toLowerCase(), a);
    }

    const type = this.getStringAttr(attrMap, "type");
    // Only process moties and amendementen
    if (!type || !/(motie|amendement)/i.test(type)) {
      return null;
    }

    const title = this.getStringAttr(attrMap, "titel") || "";
    const dateSubmitted = this.getStringAttr(attrMap, "datum indiening") ||
      this.getStringAttr(attrMap, "datum ingediend") ||
      this.getStringAttr(attrMap, "datum") || "";
    const result = this.getStringAttr(attrMap, "uitslag") || "";
    const resultExplanation = this.getStringAttr(attrMap, "toelichting") || "";
    const risNumber = this.getStringAttr(attrMap, "ris-nummer") || null;
    const policyArea = this.getPolicyArea(attrMap);

    // Extract submitters (Indiener(s) / Indiener / Medeondertekenaars)
    let submitters = this.getPersonRefs(attrMap, "indiener(s)");
    if (submitters.length === 0) submitters = this.getPersonRefs(attrMap, "indiener");
    // Also add co-signers from "Medeondertekenaars"
    const coSigners = this.getPersonRefs(attrMap, "medeondertekenaars");
    if (coSigners.length > 0) submitters = [...submitters, ...coSigners];

    // Extract parties (Fractie / Betrokken partijen)
    let parties = this.getPartyRefs(attrMap, "fractie");
    if (parties.length === 0) parties = this.getPartyRefs(attrMap, "betrokken partijen");

    // Extract document
    const docAttr = attrMap.get("hoofddocument");
    let documentUrl: string | null = null;
    let documentTitle: string | null = null;
    if (docAttr?.value && typeof docAttr.value === "object" && "url" in docAttr.value) {
      const docVal = docAttr.value as NotubizDocValue;
      documentUrl = docVal.url;
      documentTitle = docVal.title;
    }

    // Linked event
    const linkedEvent = this.getStringFromRefValues(attrMap, "gekoppeld evenement");

    // Build raw attributes map
    const rawAttributes: Record<string, unknown> = {};
    for (const a of attrs) {
      rawAttributes[a.label] = a.value || a.values;
    }

    return {
      moduleItemId,
      title,
      type,
      dateSubmitted: dateSubmitted ? new Date(dateSubmitted).toISOString() : "",
      result: result.toLowerCase(),
      resultExplanation: this.stripHtml(resultExplanation),
      submitters,
      parties,
      documentUrl,
      documentTitle,
      linkedEventDescription: linkedEvent,
      risNumber,
      policyArea,
      rawAttributes,
    };
  }

  /**
   * Parse the "Toelichting" text to extract per-party vote breakdown.
   *
   * Common patterns:
   *   "met de stemmen tegen van VVD, DENK, JA21, CDA en Forum voor Democratie aangenomen"
   *   "met de stem tegen van JA21 is aangenomen" (singular)
   *   "met algemene stemmen aangenomen"
   *   "zonder hoofdelijke stemming aangenomen"
   *   "bij acclamatie aangenomen"
   *   "verworpen"
   *   "aangenomen" (bare result, no party detail)
   */
  parseVoteBreakdown(resultText: string, toelichting: string): ParsedVoteBreakdown {
    // Strip &nbsp; and other HTML entities before parsing
    const rawText = toelichting || resultText;
    const text = this.stripHtmlEntities(rawText);
    const lower = text.toLowerCase();

    // Determine result
    let result: ParsedVoteBreakdown["result"] = "unknown";
    if (lower.includes("aangenomen")) result = "aangenomen";
    else if (lower.includes("verworpen")) result = "verworpen";
    else if (lower.includes("ingetrokken")) result = "ingetrokken";
    else if (lower.includes("aangehouden")) result = "unknown"; // aangehouden = deferred, not voted

    // Determine method
    let method: ParsedVoteBreakdown["method"] = "unknown";
    if (lower.includes("algemene stemmen") || lower.includes("unaniem") || lower.includes("bij acclamatie")) {
      method = "unanimous";
    } else if (lower.includes("zonder hoofdelijke stemming") || lower.includes("zonder stemming")) {
      method = "no_vote";
    } else if (/stemm?en?\s+tegen\s+van/i.test(lower) || /stemm?en?\s+voor\s+van/i.test(lower)) {
      // Match both singular "stem" and plural "stemmen"
      method = "with_against";
    } else if (
      result !== "unknown" && result !== "ingetrokken" &&
      !lower.includes("stem") && !lower.includes("lid")
    ) {
      // Bare "aangenomen"/"verworpen" without any vote detail
      // Treat as no_vote (unanimous agreement implied)
      method = "no_vote";
    }

    // Extract party names from "stem(men) tegen van" or "stem(men) voor van" patterns
    let partiesAgainst: string[] = [];
    let partiesFor: string[] = [];

    // Pattern: "met de stem(men) tegen van X, Y, Z en W (is) aangenomen"
    const tegenMatch = text.match(
      /stemm?en?\s+tegen\s+van\s+(.+?)(?:\s+(?:is\s+)?aangenomen|\s+(?:is\s+)?verworpen|\.|\s*$)/i
    );
    if (tegenMatch) {
      partiesAgainst = this.parsePartyList(tegenMatch[1]);
    }

    // Pattern: "met de stem(men) voor van X, Y en Z (is) verworpen/aangenomen"
    const voorMatch = text.match(
      /stemm?en?\s+voor\s+van\s+(.+?)(?:\s+(?:is\s+)?aangenomen|\s+(?:is\s+)?verworpen|\.|\s*$)/i
    );
    if (voorMatch) {
      partiesFor = this.parsePartyList(voorMatch[1]);
    }

    // Pattern: "een stemonthouding van het lid X" — note but don't count as party
    // (individual member abstentions don't change the party-level logic)

    return {
      result,
      method,
      partiesAgainst,
      partiesFor,
      rawText: text,
    };
  }

  // ── Private helpers ───────────────────────────────────────

  getEventTitle(event: NotubizEvent): string {
    const titleAttr = event.attributes?.find((a) => a.id === 1);
    return titleAttr?.value || "";
  }

  private getStringAttr(
    map: Map<string, NotubizItemAttribute>,
    label: string
  ): string | null {
    const attr = map.get(label);
    if (!attr) return null;
    if (typeof attr.value === "string") return attr.value;
    return null;
  }

  private getPersonRefs(
    map: Map<string, NotubizItemAttribute>,
    label: string
  ): { name: string; personId: number }[] {
    const attr = map.get(label);
    if (!attr) return [];
    const refs = attr.values || (attr.value && typeof attr.value === "object" && "value" in attr.value ? attr.value as NotubizRefValues : null);
    if (!refs) return [];
    const values = Array.isArray(refs.value) ? refs.value : [refs.value];
    return values
      .filter((v): v is NotubizRefValue => v != null && "@cdata" in v)
      .filter((v) => v["@attributes"]?.reference_model === "person")
      .map((v) => ({
        name: v["@cdata"],
        personId: v["@attributes"].id,
      }));
  }

  private getPartyRefs(
    map: Map<string, NotubizItemAttribute>,
    label: string
  ): { name: string; partyId: number }[] {
    const attr = map.get(label);
    if (!attr) return [];
    const refs = attr.values || (attr.value && typeof attr.value === "object" && "value" in attr.value ? attr.value as NotubizRefValues : null);
    if (!refs) return [];
    const values = Array.isArray(refs.value) ? refs.value : [refs.value];
    return values
      .filter((v): v is NotubizRefValue => v != null && "@cdata" in v)
      .filter((v) => v["@attributes"]?.reference_model === "party")
      .map((v) => ({
        name: v["@cdata"],
        partyId: v["@attributes"].id,
      }));
  }

  private getPolicyArea(map: Map<string, NotubizItemAttribute>): string | null {
    const attr = map.get("beleidsveld");
    if (!attr) return null;
    if (typeof attr.value === "string") return attr.value;
    const refs = attr.values || (attr.value && typeof attr.value === "object" && "value" in attr.value ? attr.value as NotubizRefValues : null);
    if (refs) {
      const values = Array.isArray(refs.value) ? refs.value : [refs.value];
      return values.map((v) => (typeof v === "string" ? v : v?.["@cdata"] || "")).join(", ");
    }
    // Sometimes it's a plain string array
    if (Array.isArray(attr.value)) {
      return (attr.value as string[]).join(", ");
    }
    return null;
  }

  private getStringFromRefValues(
    map: Map<string, NotubizItemAttribute>,
    label: string
  ): string | null {
    const attr = map.get(label);
    if (!attr) return null;
    const refs = attr.values || (attr.value && typeof attr.value === "object" && "value" in attr.value ? attr.value as NotubizRefValues : null);
    if (refs) {
      const values = Array.isArray(refs.value) ? refs.value : [refs.value];
      return values
        .filter((v): v is NotubizRefValue => v != null && "@cdata" in v)
        .map((v) => v["@cdata"])
        .join("; ");
    }
    if (typeof attr.value === "string") return attr.value;
    return null;
  }

  private parsePartyList(text: string): string[] {
    // Split on ", " and " en " to get party names
    // "VVD, DENK, JA21, CDA en Forum voor Democratie"
    // Also handles: "de VVD, DENK en JA21" → strip leading "de "
    return text
      .split(/,\s*|\s+en\s+/i)
      .map((s) => s.trim())
      .map((s) => s.replace(/^(de|het)\s+/i, "")) // strip leading articles
      .filter((s) => s.length > 0)
      .filter((s) => !/(^(is|zijn|werd|werden|deze|dit)$)/i.test(s)) // filter stray words
      .filter((s) => !/^lid\s/i.test(s)) // filter "lid Yemane" (individual members)
      .filter((s) => !/^leden\s/i.test(s)) // filter "leden Staartjes"
      .filter((s) => !/een stemonthouding/i.test(s)) // filter abstention notes
      .filter((s) => !/^\s*$/.test(s));
  }

  /**
   * Strip HTML entities (&nbsp; etc.) and collapse whitespace
   */
  private stripHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").trim();
  }
}

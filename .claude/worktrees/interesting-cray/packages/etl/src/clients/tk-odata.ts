/**
 * Tweede Kamer OData API Client
 * Base URL: https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/
 */

const TK_API_BASE = 'https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0';

export interface TKPersoon {
  Id: string;
  Voornamen?: string;
  Achternaam: string;
  Initialen?: string;
  Tussenvoegsel?: string;
  Geslacht?: string;
  Functie?: string;
  Verwijderd: boolean;
  GewijzigdOp: string;
}

export interface TKFractie {
  Id: string;
  Naam: string;
  NaamKort: string;
  Afkorting: string;
  DatumActief: string;
  DatumInactief?: string;
  Verwijderd: boolean;
  GewijzigdOp: string;
}

export interface TKFractieZetelPersoon {
  Id: string;
  FractieZetel_Id: string;
  Persoon_Id: string;
  Functie?: string;
  Van: string;
  TotEnMet?: string;
  Verwijderd: boolean;
}

export interface TKFractieZetel {
  Id: string;
  Fractie_Id?: string;
  FractieId?: string;
  Verwijderd: boolean;
}

export interface TKMotie {
  Id: string;
  Nummer?: string;
  Soort: string; // "Motie", "Amendement", etc.
  Titel: string;
  Citeertitel?: string;
  Alias?: string;
  Status: string;
  Onderwerp?: string;
  GestartOp: string;
  Vergaderjaar?: string;
  Volgnummer?: number;
  Afgedaan: boolean;
  Verwijderd: boolean;
  GewijzigdOp: string;
  Kabinetsappreciatie?: string;
}

// Alias for backward compatibility
export type TKBesluit = TKMotie;

/**
 * Stemming entity from the TK OData API
 * This represents a party-level or individual vote on a Besluit.
 * For "Hoofdelijk" (roll-call) votes, Persoon_Id is populated.
 * For "Met handopsteken" votes, only party-level data exists.
 */
export interface TKStemming {
  Id: string;
  Besluit_Id: string;
  Soort: string; // "Voor", "Tegen", "Niet deelgenomen"
  FractieGrootte: number;
  ActorNaam: string;
  ActorFractie: string;
  Vergissing: boolean;
  SidActorLid?: string | null;
  SidActorFractie?: string;
  Persoon_Id?: string | null;
  Fractie_Id: string;
  GewijzigdOp: string;
  ApiGewijzigdOp: string;
  Verwijderd: boolean;
}

// Legacy alias - no longer used
export type TKStem = TKStemming;

/**
 * Besluit entity - represents a vote decision
 */
export interface TKBesluitVote {
  Id: string;
  Agendapunt_Id: string;
  StemmingsSoort: string | null; // "Hoofdelijk" or "Met handopsteken"
  BesluitSoort: string; // "Stemmen - aangenomen", "Stemmen - verworpen"
  BesluitTekst: string;
  Opmerking?: string | null;
  Status: string;
  AgendapuntZaakBesluitVolgorde: number;
  GewijzigdOp: string;
  ApiGewijzigdOp: string;
  Verwijderd: boolean;
  // Expanded relations
  Stemming?: TKStemming[];
  Zaak?: TKZaak[];
  Agendapunt?: TKAgendapunt;
}

export interface TKAgendapunt {
  Id: string;
  Nummer: string;
  Onderwerp: string;
  Aanvangstijd?: string | null;
  Eindtijd?: string | null;
  Volgorde: number;
  Rubriek?: string | null;
  Status: string;
  GewijzigdOp: string;
  Verwijderd: boolean;
  Activiteit_Id: string;
  Activiteit?: TKActiviteit;
}

export interface TKActiviteit {
  Id: string;
  Soort: string;
  Nummer: string;
  Onderwerp: string;
  Datum: string;
  Aanvangstijd?: string;
  Eindtijd?: string;
  Status: string;
  Vergaderjaar?: string;
  GewijzigdOp: string;
  Verwijderd: boolean;
}

export interface TKZaak {
  Id: string;
  Nummer?: string;
  Soort: string;
  Titel: string;
  Citeertitel?: string | null;
  Alias?: string | null;
  Status: string;
  Onderwerp?: string;
  GestartOp: string;
  Vergaderjaar?: string;
  Volgnummer?: number;
  Afgedaan: boolean;
  Verwijderd: boolean;
  GewijzigdOp: string;
  Kabinetsappreciatie?: string;
}

export interface ODataResponse<T> {
  '@odata.context': string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
}

export class TKODataClient {
  private baseUrl: string;

  constructor(baseUrl: string = TK_API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic OData fetch with error handling
   */
  private async fetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<ODataResponse<T>> {
    const query = new URLSearchParams(params);
    const url = `${this.baseUrl}/${endpoint}?${query.toString()}`;

    console.log(`[TK API] Fetching: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TK API error: ${response.status} ${response.statusText} - ${body}`);
    }

    return response.json();
  }

  /**
   * Fetch all items with pagination support
   */
  private async fetchAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    let allItems: T[] = [];

    const initialParams = {
      ...params,
      $count: 'true',
    };

    let response = await this.fetch<T>(endpoint, initialParams);
    allItems = allItems.concat(response.value);

    while (response['@odata.nextLink']) {
      const nextUrl = new URL(response['@odata.nextLink']);
      const nextParams = Object.fromEntries(nextUrl.searchParams.entries());

      response = await this.fetch<T>(endpoint, nextParams);
      allItems = allItems.concat(response.value);

      console.log(`[TK API] Fetched ${allItems.length} total items...`);
    }

    return allItems;
  }

  /**
   * Fetch Personen (Kamerleden)
   */
  async getPersonen(filter?: string): Promise<TKPersoon[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'Achternaam asc',
    };

    return this.fetchAll<TKPersoon>('Persoon', params);
  }

  /**
   * Fetch Fracties (Partijen)
   */
  async getFracties(filter?: string): Promise<TKFractie[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'DatumActief desc',
    };

    return this.fetchAll<TKFractie>('Fractie', params);
  }

  /**
   * Fetch FractieZetel (Fractie seats)
   */
  async getFractieZetels(filter?: string): Promise<TKFractieZetel[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'GewijzigdOp desc',
    };

    return this.fetchAll<TKFractieZetel>('FractieZetel', params);
  }

  /**
   * Fetch FractieZetelPersoon (Kamerlid-Fractie koppeling)
   */
  async getFractieZetelPersonen(filter?: string): Promise<TKFractieZetelPersoon[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'Van desc',
    };

    return this.fetchAll<TKFractieZetelPersoon>('FractieZetelPersoon', params);
  }

  /**
   * Fetch Moties (from Zaak entity with Soort = 'Motie')
   */
  async getBesluiten(filter?: string, top?: number): Promise<TKBesluit[]> {
    const params: Record<string, string> = {
      $filter: filter || "Verwijderd eq false and Soort eq 'Motie'",
      $orderby: 'GestartOp desc',
    };

    if (top) {
      params.$top = top.toString();
      return (await this.fetch<TKBesluit>('Zaak', params)).value;
    }

    return this.fetchAll<TKBesluit>('Zaak', params);
  }

  /**
   * Fetch Besluit (vote decisions) with expanded Stemming, Zaak, and Agendapunt->Activiteit
   * StemmingsSoort ne null = actual vote decisions (not just procedural)
   */
  async getVoteBesluiten(filter?: string, top?: number): Promise<TKBesluitVote[]> {
    const baseFilter = filter || "Verwijderd eq false and StemmingsSoort ne null";
    const params: Record<string, string> = {
      $filter: baseFilter,
      $orderby: 'GewijzigdOp desc',
      $expand: 'Stemming,Zaak,Agendapunt($expand=Activiteit)',
    };

    if (top) {
      params.$top = top.toString();
      return (await this.fetch<TKBesluitVote>('Besluit', params)).value;
    }

    return this.fetchAll<TKBesluitVote>('Besluit', params);
  }

  /**
   * Fetch Besluiten specifically filtered for Hoofdelijk (roll-call) votes
   * These contain individual MP-level voting data
   */
  async getHoofdelijkBesluiten(top?: number): Promise<TKBesluitVote[]> {
    const filter = "Verwijderd eq false and StemmingsSoort eq 'Hoofdelijk'";
    const params: Record<string, string> = {
      $filter: filter,
      $orderby: 'GewijzigdOp desc',
      $expand: 'Stemming,Zaak,Agendapunt($expand=Activiteit)',
    };

    if (top && top <= 250) {
      params.$top = top.toString();
      return (await this.fetch<TKBesluitVote>('Besluit', params)).value;
    }

    // For larger requests or no limit, use pagination (API max $top is 250)
    params.$top = '250';
    const allItems: TKBesluitVote[] = [];
    let response = await this.fetch<TKBesluitVote>('Besluit', { ...params, $count: 'true' });
    allItems.push(...response.value);

    while (response['@odata.nextLink'] && (!top || allItems.length < top)) {
      const nextUrl = new URL(response['@odata.nextLink']);
      const nextParams = Object.fromEntries(nextUrl.searchParams.entries());
      response = await this.fetch<TKBesluitVote>('Besluit', nextParams);
      allItems.push(...response.value);
      console.log(`[TK API] Fetched ${allItems.length} Hoofdelijk besluiten...`);
    }

    return top ? allItems.slice(0, top) : allItems;
  }

  /**
   * Fetch Stemmingen (party/individual vote records) for a specific Besluit
   */
  async getStemmingen(filter?: string, top?: number): Promise<TKStemming[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'GewijzigdOp desc',
    };

    if (top) {
      params.$top = top.toString();
      return (await this.fetch<TKStemming>('Stemming', params)).value;
    }

    return this.fetchAll<TKStemming>('Stemming', params);
  }

  /**
   * Get items modified since a specific date (for incremental sync)
   */
  async getModifiedSince<T>(
    endpoint: string,
    sinceDate: Date,
    entityType?: string
  ): Promise<T[]> {
    const isoDate = sinceDate.toISOString();
    const params: Record<string, string> = {
      $filter: `GewijzigdOp gt ${isoDate}`,
      $orderby: 'GewijzigdOp asc',
    };

    return this.fetchAll<T>(endpoint, params);
  }
}

export const tkClient = new TKODataClient();

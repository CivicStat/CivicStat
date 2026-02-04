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
  PersoonId: string;
  FractieId: string;
  Van: string;
  TotEnMet?: string;
  Verwijderd: boolean;
}

export interface TKBesluit {
  Id: string;
  Nummer?: string;
  Titel: string;
  Tekst: string;
  Soort: string; // "Motie", "Amendement", etc.
  Status: string;
  DatumIndiening?: string;
  ZaakId?: string;
  Verwijderd: boolean;
  GewijzigdOp: string;
}

export interface TKStemming {
  Id: string;
  BesluitTekst: string;
  Vergaderdatum: string;
  Fractiegrootte: number;
  Soort: string;
  BesluitId?: string;
  Verwijderd: boolean;
  GewijzigdOp: string;
}

export interface TKStem {
  Id: string;
  StemmingId: string;
  PersoonId: string;
  FractieId: string;
  Soort: string; // "Voor", "Tegen", "Niet deelgenomen", "Afwezig"
  Vergissing: boolean;
  ActorNaam?: string;
  ActorFractie?: string;
  Verwijderd: boolean;
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
      throw new Error(`TK API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all items with pagination support
   */
  private async fetchAll<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    let allItems: T[] = [];
    let nextLink: string | undefined;

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
   * Fetch FractieZetelPersoon (Kamerlid-Fractie koppeling)
   */
  async getFractieZetels(filter?: string): Promise<TKFractieZetelPersoon[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'Van desc',
    };

    return this.fetchAll<TKFractieZetelPersoon>('FractieZetelPersoon', params);
  }

  /**
   * Fetch Besluiten (Moties, Amendementen, etc.)
   */
  async getBesluiten(filter?: string, top?: number): Promise<TKBesluit[]> {
    const params: Record<string, string> = {
      $filter: filter || "Verwijderd eq false and Soort eq 'Motie'",
      $orderby: 'DatumIndiening desc',
    };

    if (top) {
      params.$top = top.toString();
      return (await this.fetch<TKBesluit>('Besluit', params)).value;
    }

    return this.fetchAll<TKBesluit>('Besluit', params);
  }

  /**
   * Fetch Stemmingen
   */
  async getStemmingen(filter?: string, top?: number): Promise<TKStemming[]> {
    const params: Record<string, string> = {
      $filter: filter || 'Verwijderd eq false',
      $orderby: 'Vergaderdatum desc',
    };

    if (top) {
      params.$top = top.toString();
      return (await this.fetch<TKStemming>('Stemming', params)).value;
    }

    return this.fetchAll<TKStemming>('Stemming', params);
  }

  /**
   * Fetch Stemmen (individuele stemmen)
   */
  async getStemmen(stemmingId: string): Promise<TKStem[]> {
    const params: Record<string, string> = {
      $filter: `StemmingId eq ${stemmingId} and Verwijderd eq false`,
    };

    return this.fetchAll<TKStem>('Stem', params);
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

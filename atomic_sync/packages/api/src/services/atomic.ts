// Client for communicating with an atomic-server instance via its REST API

export interface CreateAtomParams {
  content: string;
  sourceUrl?: string;
  publishedAt?: string;
  tagIds?: string[];
}

export interface AtomResponse {
  id: string;
  content: string;
  source_url: string | null;
  created_at: string;
}

export interface BulkCreateResponse {
  atoms: AtomResponse[];
  count: number;
  skipped: number;
}

export class AtomicClient {
  constructor(
    private baseUrl: string,
    private accessToken: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Atomic API error: ${res.status} ${res.statusText} - ${text}`,
      );
    }

    return res.json() as Promise<T>;
  }

  async createAtom(params: CreateAtomParams): Promise<AtomResponse> {
    return this.request<AtomResponse>("POST", "/api/atoms", {
      content: params.content,
      source_url: params.sourceUrl,
      published_at: params.publishedAt,
      tag_ids: params.tagIds ?? [],
    });
  }

  async createAtomsBulk(
    params: CreateAtomParams[],
  ): Promise<BulkCreateResponse> {
    return this.request<BulkCreateResponse>(
      "POST",
      "/api/atoms/bulk",
      params.map((p) => ({
        content: p.content,
        source_url: p.sourceUrl,
        published_at: p.publishedAt,
        tag_ids: p.tagIds ?? [],
      })),
    );
  }

  // Verify the connection is valid
  async ping(): Promise<boolean> {
    try {
      await this.request("GET", "/api/atoms?limit=1");
      return true;
    } catch {
      return false;
    }
  }
}

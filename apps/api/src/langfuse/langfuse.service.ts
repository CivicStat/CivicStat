import { Injectable } from "@nestjs/common";

/**
 * Langfuse proxy service — fetches metrics and traces from the Langfuse
 * REST API and exposes them for the transparency page.
 *
 * Authentication: Basic Auth with pk:sk base64-encoded.
 * All traces are created as public in the ETL, so URLs are shareable.
 */

interface DailyMetric {
  date: string;
  countTraces: number;
  countObservations: number;
  totalCost: number;
  usage: Array<{
    model: string;
    inputUsage: number;
    outputUsage: number;
    totalCost: number;
  }>;
}

interface LangfuseTrace {
  id: string;
  name: string;
  timestamp: string;
  latency: number | null;
  tags: string[];
  totalCost: number;
  public: boolean;
  htmlPath: string | null;
  observations: string[];
  metadata: Record<string, any> | null;
}

@Injectable()
export class LangfuseService {
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly projectId: string;

  constructor() {
    this.publicKey = process.env.LANGFUSE_PUBLIC_KEY || "";
    this.secretKey = process.env.LANGFUSE_SECRET_KEY || "";
    this.baseUrl = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com";
    this.projectId = process.env.LANGFUSE_PROJECT_ID || "";
  }

  private get isConfigured(): boolean {
    return !!this.publicKey && !!this.secretKey;
  }

  private get authHeader(): string {
    const credentials = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  private buildPublicUrl(traceId: string): string {
    if (this.projectId) {
      return `${this.baseUrl}/project/${this.projectId}/traces/${traceId}`;
    }
    return `${this.baseUrl}/traces/${traceId}`;
  }

  /**
   * Get aggregated metrics: total traces, cost, tokens, and daily breakdown.
   */
  async getMetrics(): Promise<{
    totalTraces: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgLatencyMs: number;
    dailyMetrics: Array<{
      date: string;
      traces: number;
      cost: number;
      inputTokens: number;
      outputTokens: number;
    }>;
  }> {
    if (!this.isConfigured) {
      return {
        totalTraces: 0,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        avgLatencyMs: 0,
        dailyMetrics: [],
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/public/metrics/daily?limit=90`,
        {
          headers: { Authorization: this.authHeader },
        },
      );

      if (!response.ok) {
        console.error(`[Langfuse] Metrics API error: ${response.status}`);
        return {
          totalTraces: 0,
          totalCost: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          avgLatencyMs: 0,
          dailyMetrics: [],
        };
      }

      const data = await response.json();
      const metrics: DailyMetric[] = data.data || [];

      let totalTraces = 0;
      let totalCost = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      const dailyMetrics = metrics.map((m) => {
        const dayInput = m.usage?.reduce((sum, u) => sum + (u.inputUsage || 0), 0) || 0;
        const dayOutput = m.usage?.reduce((sum, u) => sum + (u.outputUsage || 0), 0) || 0;

        totalTraces += m.countTraces || 0;
        totalCost += m.totalCost || 0;
        totalInputTokens += dayInput;
        totalOutputTokens += dayOutput;

        return {
          date: m.date,
          traces: m.countTraces || 0,
          cost: m.totalCost || 0,
          inputTokens: dayInput,
          outputTokens: dayOutput,
        };
      });

      return {
        totalTraces,
        totalCost: Math.round(totalCost * 100) / 100,
        totalInputTokens,
        totalOutputTokens,
        avgLatencyMs: 0, // daily endpoint doesn't include latency
        dailyMetrics,
      };
    } catch (error) {
      console.error("[Langfuse] Failed to fetch metrics:", error);
      return {
        totalTraces: 0,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        avgLatencyMs: 0,
        dailyMetrics: [],
      };
    }
  }

  /**
   * Get a paginated list of traces with public URLs.
   */
  /**
   * Extract token counts from trace metadata (OpenRouter OTEL attributes).
   * Tokens are not available at trace level — they're embedded in
   * metadata.attributes["gen_ai.usage.input_tokens"] etc.
   */
  private extractTokensFromMetadata(metadata: Record<string, any> | null): {
    inputTokens: number;
    outputTokens: number;
  } {
    const attrs = metadata?.attributes;
    if (!attrs) return { inputTokens: 0, outputTokens: 0 };
    return {
      inputTokens: parseInt(attrs["gen_ai.usage.input_tokens"] || "0", 10) || 0,
      outputTokens: parseInt(attrs["gen_ai.usage.output_tokens"] || "0", 10) || 0,
    };
  }

  async getTraces(
    limit = 20,
    page = 1,
  ): Promise<{
    traces: Array<{
      id: string;
      name: string;
      timestamp: string;
      latencyMs: number | null;
      tags: string[];
      totalCost: number;
      inputTokens: number;
      outputTokens: number;
      model: string | null;
      publicUrl: string;
    }>;
    totalItems: number;
    page: number;
    limit: number;
  }> {
    if (!this.isConfigured) {
      return { traces: [], totalItems: 0, page, limit };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/public/traces?limit=${limit}&page=${page}&orderBy=timestamp.DESC`,
        {
          headers: { Authorization: this.authHeader },
        },
      );

      if (!response.ok) {
        console.error(`[Langfuse] Traces API error: ${response.status}`);
        return { traces: [], totalItems: 0, page, limit };
      }

      const data = await response.json();
      const rawTraces: LangfuseTrace[] = data.data || [];

      const traces = rawTraces.map((t) => {
        const { inputTokens, outputTokens } = this.extractTokensFromMetadata(t.metadata);
        const model = t.metadata?.attributes?.["gen_ai.response.model"] || null;
        return {
          id: t.id,
          name: t.name || "unknown",
          timestamp: t.timestamp,
          latencyMs: t.latency ? Math.round(t.latency * 1000) : null,
          tags: t.tags || [],
          totalCost: t.totalCost || 0,
          inputTokens,
          outputTokens,
          model,
          publicUrl: t.htmlPath
            ? `${this.baseUrl}${t.htmlPath}`
            : this.buildPublicUrl(t.id),
        };
      });

      return {
        traces,
        totalItems: data.meta?.totalItems || rawTraces.length,
        page,
        limit,
      };
    } catch (error) {
      console.error("[Langfuse] Failed to fetch traces:", error);
      return { traces: [], totalItems: 0, page, limit };
    }
  }
}

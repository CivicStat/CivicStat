/**
 * Langfuse Observability — instruments AI calls with tracing for transparency.
 *
 * Every AI call CivicStat makes is logged to Langfuse and publicly inspectable.
 * This module handles initialization and shutdown of the Langfuse SDK.
 *
 * Environment variables:
 *   LANGFUSE_PUBLIC_KEY  — Langfuse public key (pk-lf-...)
 *   LANGFUSE_SECRET_KEY  — Langfuse secret key (sk-lf-...)
 *   LANGFUSE_BASE_URL    — Langfuse host (default: https://cloud.langfuse.com)
 *
 * When LANGFUSE_SECRET_KEY is not set, all functions no-op (zero overhead).
 */

import Langfuse from 'langfuse';

let langfuseClient: InstanceType<typeof Langfuse> | null = null;

/**
 * Check if Langfuse is configured (secret key is present).
 */
export function isLangfuseEnabled(): boolean {
  return !!process.env.LANGFUSE_SECRET_KEY && !!process.env.LANGFUSE_PUBLIC_KEY;
}

/**
 * Initialize the Langfuse client.
 * No-ops if LANGFUSE_SECRET_KEY is not set.
 */
export function initLangfuse(): void {
  if (!isLangfuseEnabled()) {
    console.log('[LANGFUSE] Not configured (LANGFUSE_SECRET_KEY not set), tracing disabled');
    return;
  }

  langfuseClient = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  });

  console.log('[LANGFUSE] Tracing enabled');
}

/**
 * Get the Langfuse client instance (null if not initialized).
 */
export function getLangfuse(): InstanceType<typeof Langfuse> | null {
  return langfuseClient;
}

/**
 * Flush all pending traces and shut down the client.
 * Critical for short-lived ETL scripts — data would be lost otherwise.
 */
export async function shutdownLangfuse(): Promise<void> {
  if (!langfuseClient) return;

  try {
    await langfuseClient.flushAsync();
    await langfuseClient.shutdownAsync();
    console.log('[LANGFUSE] Traces flushed and client shut down');
  } catch (error) {
    console.warn('[LANGFUSE] Shutdown error (traces may be incomplete):', error);
  } finally {
    langfuseClient = null;
  }
}

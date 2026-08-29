import "server-only";

import { env } from "@/lib/env";
import {
  CBC_CURRICULUM_TIMEOUT_MS,
  CBC_SEARCH_TIMEOUT_MS,
  type ContentSearchInput,
  type CbcError,
  type CbcResult,
  type CurriculumSearchInput,
} from "@/lib/cbc/types";

function missingConfig(): CbcResult<unknown> {
  return {
    ok: false,
    error: {
      kind: "not_configured",
      message: "CBC_API_URL and CBC_API_KEY must be set.",
    },
  };
}

function toError(error: unknown, timeoutMs: number): CbcError {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: `CBC API timed out after ${timeoutMs}ms.`,
    };
  }
  const message =
    error instanceof Error ? error.message : "CBC API request failed.";
  return { kind: "network", message };
}

async function cbcFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<CbcResult<unknown>> {
  const baseUrl = env.CBC_API_URL;
  const apiKey = env.CBC_API_KEY;
  if (!baseUrl || !apiKey) return missingConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: "http",
          status: response.status,
          message: `CBC API responded with ${response.status}.`,
        },
      };
    }

    try {
      const data: unknown = await response.json();
      return { ok: true, data };
    } catch {
      return {
        ok: false,
        error: {
          kind: "invalid_response",
          message: "CBC API returned a non-JSON body.",
        },
      };
    }
  } catch (error) {
    return { ok: false, error: toError(error, timeoutMs) };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchCurriculum(
  input: CurriculumSearchInput,
): Promise<CbcResult<unknown>> {
  return cbcFetch(
    "/v1/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: input.query,
        grade: input.grade,
        subject: input.subject,
        limit: input.limit ?? 3,
      }),
    },
    CBC_SEARCH_TIMEOUT_MS,
  );
}

export async function getCurriculumTree(
  subject: string,
  grade: number,
): Promise<CbcResult<unknown>> {
  const path = `/v1/curriculum/${encodeURIComponent(subject)}/${grade}`;
  return cbcFetch(path, { method: "GET" }, CBC_CURRICULUM_TIMEOUT_MS);
}

export async function getNode(id: string): Promise<CbcResult<unknown>> {
  const path = `/v1/nodes/${encodeURIComponent(id)}`;
  return cbcFetch(path, { method: "GET" }, CBC_CURRICULUM_TIMEOUT_MS);
}

export async function searchContent(
  input: ContentSearchInput,
): Promise<CbcResult<unknown>> {
  return cbcFetch(
    "/v1/content/search",
    {
      method: "POST",
      body: JSON.stringify({
        query: input.query,
        grade: input.grade,
        subject: input.subject,
        content_type: input.content_type,
        ...(input.cognitive_level
          ? { cognitive_level: input.cognitive_level }
          : {}),
        limit: input.limit ?? 5,
      }),
    },
    CBC_SEARCH_TIMEOUT_MS,
  );
}

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

type JsonReadable = {
  json(): Promise<unknown>;
};

export async function readApiError(
  res: JsonReadable,
  fallback: string
): Promise<string> {
  try {
    const payload = (await res.json()) as ApiErrorPayload;
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

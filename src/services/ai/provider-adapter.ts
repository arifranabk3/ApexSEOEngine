export interface AIGenerationRequest {
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGenerationResponse {
  text: string;
  modelId: string;
  providerName: string;
  tokensUsed: number;
  durationMs: number;
}

export interface AIConnectionTestResult {
  connected: boolean;
  latencyMs: number;
  availableModels: string[];
  message: string;
}

export interface AIProviderAdapter {
  readonly providerType: string;
  testConnection(): Promise<AIConnectionTestResult>;
  generateText(req: AIGenerationRequest): Promise<AIGenerationResponse>;
}

/**
 * Local Ollama Adapter (Zero-Cost Policy Primary AI Engine)
 */
export class OllamaAdapter implements AIProviderAdapter {
  readonly providerType = "OLLAMA";

  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly providerName: string = "Local Ollama"
  ) {}

  async testConnection(): Promise<AIConnectionTestResult> {
    const start = Date.now();
    try {
      const cleanUrl = this.baseUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(4000)
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          connected: false,
          latencyMs,
          availableModels: [],
          message: `Ollama responded with HTTP ${res.status}`
        };
      }

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = Array.isArray(data.models) ? data.models.map((m) => m.name) : [];

      return {
        connected: true,
        latencyMs,
        availableModels: models,
        message: `Connected to Ollama (${models.length} local models detected)`
      };
    } catch (err) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        availableModels: [],
        message: `Ollama server unreachable at ${this.baseUrl}: ${
          err instanceof Error ? err.message : "Network error"
        }`
      };
    }
  }

  async generateText(req: AIGenerationRequest): Promise<AIGenerationResponse> {
    const start = Date.now();
    const cleanUrl = this.baseUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.modelId,
        prompt: req.prompt,
        system: req.systemPrompt,
        stream: false,
        options: {
          temperature: req.temperature ?? 0.7,
          num_predict: req.maxTokens ?? 1024
        }
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      throw new Error(`Ollama generation failed with HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      response?: string;
      eval_count?: number;
      prompt_eval_count?: number;
    };

    const tokensUsed = (body.eval_count || 0) + (body.prompt_eval_count || 0);
    return {
      text: body.response || "",
      modelId: req.modelId,
      providerName: this.providerName,
      tokensUsed,
      durationMs: Date.now() - start
    };
  }
}

/**
 * OpenAI-Compatible Adapter (LM Studio, vLLM, LocalAI, llama.cpp server, or custom gateway)
 */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly providerType = "OPENAI_COMPATIBLE";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | null = null,
    private readonly providerName: string = "OpenAI-Compatible Provider"
  ) {}

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async testConnection(): Promise<AIConnectionTestResult> {
    const start = Date.now();
    try {
      const cleanUrl = this.baseUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/v1/models`, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(4000)
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          connected: false,
          latencyMs,
          availableModels: [],
          message: `Endpoint responded with HTTP ${res.status}`
        };
      }

      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = Array.isArray(data.data) ? data.data.map((m) => m.id) : [];

      return {
        connected: true,
        latencyMs,
        availableModels: models,
        message: `Connected to ${this.providerName} (${models.length} models listed)`
      };
    } catch (err) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        availableModels: [],
        message: `Endpoint unreachable at ${this.baseUrl}: ${
          err instanceof Error ? err.message : "Network error"
        }`
      };
    }
  }

  async generateText(req: AIGenerationRequest): Promise<AIGenerationResponse> {
    const start = Date.now();
    const cleanUrl = this.baseUrl.replace(/\/$/, "");
    const messages = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

    const res = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: req.modelId,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 1024
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      throw new Error(`OpenAI-compatible generation failed with HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      text: body.choices?.[0]?.message?.content || "",
      modelId: req.modelId,
      providerName: this.providerName,
      tokensUsed: body.usage?.total_tokens || 0,
      durationMs: Date.now() - start
    };
  }
}

export function createAIAdapter(params: {
  providerType: string;
  baseUrl: string;
  apiKey?: string | null;
  name?: string;
}): AIProviderAdapter {
  if (params.providerType === "OLLAMA" || params.providerType === "LOCAL_LLAMA") {
    return new OllamaAdapter(params.baseUrl, params.name || "Ollama");
  }
  return new OpenAICompatibleAdapter(
    params.baseUrl,
    params.apiKey || null,
    params.name || "OpenAI-Compatible"
  );
}


import { type ZodSchema } from "zod";

export interface AIGenerationRequest {
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  format?: "json" | string;
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

export interface OllamaModelDetails {
  name: string;
  model: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details?: {
    parentModel?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameterSize?: string;
    quantizationLevel?: string;
  };
}

export interface OllamaModelAvailability {
  available: boolean;
  modelId: string;
  details?: OllamaModelDetails;
  message: string;
}

export interface AIStructuredGenerationResult<T> {
  data: T;
  raw: AIGenerationResponse;
  attempts: number;
}

export interface AIProviderAdapter {
  readonly providerType: string;
  testConnection(): Promise<AIConnectionTestResult>;
  generateText(req: AIGenerationRequest): Promise<AIGenerationResponse>;
  listModelsDetailed?(): Promise<OllamaModelDetails[]>;
  checkModelAvailable?(modelId: string): Promise<OllamaModelAvailability>;
  generateStructuredOutput?<T>(
    req: AIGenerationRequest,
    schema: ZodSchema<T>,
    maxRetries?: number
  ): Promise<AIStructuredGenerationResult<T>>;
}

/**
 * Local Ollama Adapter (Zero-Cost Policy Primary AI Engine)
 * Extended in Phase 02.1-B for Model Discovery, Health & Structured JSON Outputs
 */
export class OllamaAdapter implements AIProviderAdapter {
  readonly providerType = "OLLAMA";

  constructor(
    private readonly baseUrl: string = "http://localhost:11434",
    private readonly providerName: string = "Local Ollama",
    private readonly timeoutMs: {
      connection: number;
      generation: number;
    } = { connection: 5000, generation: 60000 }
  ) {}

  private getCleanBaseUrl(): string {
    return this.baseUrl.replace(/\/$/, "");
  }

  async testConnection(): Promise<AIConnectionTestResult> {
    const start = Date.now();
    try {
      const cleanUrl = this.getCleanBaseUrl();
      const res = await fetch(`${cleanUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(this.timeoutMs.connection)
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

  /**
   * Discovers installed models with full parameters, format, and size details from Ollama /api/tags
   */
  async listModelsDetailed(): Promise<OllamaModelDetails[]> {
    const cleanUrl = this.getCleanBaseUrl();
    const res = await fetch(`${cleanUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(this.timeoutMs.connection)
    });

    if (!res.ok) {
      throw new Error(`Failed to list Ollama models: HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        model: string;
        modified_at: string;
        size: number;
        digest: string;
        details?: {
          parent_model?: string;
          format?: string;
          family?: string;
          families?: string[];
          parameter_size?: string;
          quantization_level?: string;
        };
      }>;
    };

    if (!Array.isArray(data.models)) {
      return [];
    }

    return data.models.map((m) => ({
      name: m.name,
      model: m.model,
      modifiedAt: m.modified_at,
      size: m.size,
      digest: m.digest,
      details: m.details
        ? {
            parentModel: m.details.parent_model,
            format: m.details.format,
            family: m.details.family,
            families: m.details.families,
            parameterSize: m.details.parameter_size,
            quantizationLevel: m.details.quantization_level
          }
        : undefined
    }));
  }

  /**
   * Verifies if a specific model (e.g. "llama3.2", "llama3.2:1b", "llama3.2:latest") is present locally
   */
  async checkModelAvailable(modelId: string): Promise<OllamaModelAvailability> {
    try {
      const models = await this.listModelsDetailed();
      const cleanTarget = modelId.toLowerCase().trim();

      // Check exact match or prefix match without :latest tag
      const matched = models.find((m) => {
        const mName = m.name.toLowerCase();
        if (mName === cleanTarget) return true;
        if (mName === `${cleanTarget}:latest` || cleanTarget === `${mName}:latest`) return true;
        // Handle family alias matching e.g. "llama3.2" matches "llama3.2:1b" if it's the sole variant
        if (mName.startsWith(`${cleanTarget}:`)) return true;
        return false;
      });

      if (matched) {
        return {
          available: true,
          modelId: matched.name,
          details: matched,
          message: `Model ${matched.name} is installed and available locally (${matched.details?.parameterSize || "unknown size"})`
        };
      }

      return {
        available: false,
        modelId,
        message: `Model ${modelId} is not installed locally in Ollama. Please verify or pull the model.`
      };
    } catch (err) {
      return {
        available: false,
        modelId,
        message: `Unable to verify model ${modelId}: ${
          err instanceof Error ? err.message : "Connection failed"
        }`
      };
    }
  }

  async generateText(req: AIGenerationRequest): Promise<AIGenerationResponse> {
    const start = Date.now();
    const cleanUrl = this.getCleanBaseUrl();
    
    try {
      const res = await fetch(`${cleanUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: req.modelId,
          prompt: req.prompt,
          system: req.systemPrompt,
          stream: false,
          format: req.format,
          options: {
            temperature: req.temperature ?? 0.7,
            num_predict: req.maxTokens ?? 2048
          }
        }),
        signal: AbortSignal.timeout(this.timeoutMs.generation)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Ollama generation failed with HTTP ${res.status}: ${errorText}`);
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
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new Error(`Ollama request timed out after ${this.timeoutMs.generation}ms`);
      }
      throw err;
    }
  }

  /**
   * Generates structured JSON adhering strictly to a provided Zod schema.
   * If parsing fails, retries with correction context up to maxRetries times.
   */
  async generateStructuredOutput<T>(
    req: AIGenerationRequest,
    schema: ZodSchema<T>,
    maxRetries: number = 2
  ): Promise<AIStructuredGenerationResult<T>> {
    let attempts = 0;
    let lastError: Error | null = null;
    let currentPrompt = req.prompt;

    while (attempts < maxRetries) {
      attempts++;
      const res = await this.generateText({
        ...req,
        prompt: currentPrompt,
        format: "json"
      });

      try {
        const parsedJson = JSON.parse(res.text.trim());
        const validated = schema.parse(parsedJson);
        return {
          data: validated,
          raw: res,
          attempts
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Add repair instructions to prompt for retry attempt
        currentPrompt = `${req.prompt}\n\nIMPORTANT: Your previous output was not valid JSON conforming to the schema:\n${lastError.message}\nProvide only valid JSON output.`;
      }
    }

    throw new Error(
      `Failed to generate valid structured output after ${attempts} attempts: ${lastError?.message}`
    );
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
    private readonly providerName: string = "OpenAI-Compatible Provider",
    private readonly timeoutMs: { connection: number; generation: number } = {
      connection: 5000,
      generation: 60000
    }
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
        signal: AbortSignal.timeout(this.timeoutMs.connection)
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

    const bodyPayload: Record<string, unknown> = {
      model: req.modelId,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048
    };

    if (req.format === "json") {
      bodyPayload.response_format = { type: "json_object" };
    }

    const res = await fetch(`${cleanUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(this.timeoutMs.generation)
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

  async generateStructuredOutput<T>(
    req: AIGenerationRequest,
    schema: ZodSchema<T>,
    maxRetries: number = 2
  ): Promise<AIStructuredGenerationResult<T>> {
    let attempts = 0;
    let lastError: Error | null = null;
    let currentPrompt = req.prompt;

    while (attempts < maxRetries) {
      attempts++;
      const res = await this.generateText({
        ...req,
        prompt: currentPrompt,
        format: "json"
      });

      try {
        const parsedJson = JSON.parse(res.text.trim());
        const validated = schema.parse(parsedJson);
        return {
          data: validated,
          raw: res,
          attempts
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        currentPrompt = `${req.prompt}\n\nIMPORTANT: Output only valid JSON conforming to schema:\n${lastError.message}`;
      }
    }

    throw new Error(
      `Failed to generate valid structured output after ${attempts} attempts: ${lastError?.message}`
    );
  }
}

export function createAIAdapter(params: {
  providerType: string;
  baseUrl: string;
  apiKey?: string | null;
  name?: string;
  timeoutMs?: { connection: number; generation: number };
}): AIProviderAdapter {
  if (params.providerType === "OLLAMA" || params.providerType === "LOCAL_LLAMA") {
    return new OllamaAdapter(params.baseUrl, params.name || "Ollama", params.timeoutMs);
  }
  return new OpenAICompatibleAdapter(
    params.baseUrl,
    params.apiKey || null,
    params.name || "OpenAI-Compatible",
    params.timeoutMs
  );
}

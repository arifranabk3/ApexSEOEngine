import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  OllamaAdapter,
  OpenAICompatibleAdapter,
  createAIAdapter
} from "@/services/ai/provider-adapter";

describe("Phase 02.1-B — Local Ollama AI Provider Integration & Model Discovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("OllamaAdapter Connectivity & Health", () => {
    it("reports connected with available models when Ollama /api/tags succeeds", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            {
              name: "llama3.2:1b",
              model: "llama3.2:1b",
              modified_at: "2026-11-14T05:00:00Z",
              size: 1321000000,
              digest: "sha256:1234abcd",
              details: {
                format: "gguf",
                family: "llama",
                parameter_size: "1.2B",
                quantization_level: "Q4_K_M"
              }
            }
          ]
        })
      } as unknown as Response);

      const adapter = new OllamaAdapter("http://localhost:11434", "Local Ollama");
      const health = await adapter.testConnection();

      expect(health.connected).toBe(true);
      expect(health.availableModels).toContain("llama3.2:1b");
      expect(health.message).toContain("1 local models detected");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("handles connection refused and server errors gracefully without throwing unhandled exceptions", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("connect ECONNREFUSED 127.0.0.1:11434")
      );

      const adapter = new OllamaAdapter("http://localhost:11434", "Local Ollama");
      const health = await adapter.testConnection();

      expect(health.connected).toBe(false);
      expect(health.availableModels).toHaveLength(0);
      expect(health.message).toContain("ECONNREFUSED");
    });

    it("handles non-200 HTTP responses from Ollama", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({})
      } as unknown as Response);

      const adapter = new OllamaAdapter("http://localhost:11434", "Local Ollama");
      const health = await adapter.testConnection();

      expect(health.connected).toBe(false);
      expect(health.message).toContain("HTTP 503");
    });
  });

  describe("Model Discovery & Detailed Inspection", () => {
    it("retrieves rich metadata including parameters, family, and quantization", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            {
              name: "llama3.2:1b",
              model: "llama3.2:1b",
              modified_at: "2026-11-14T05:00:00Z",
              size: 1321000000,
              digest: "sha256:1234abcd",
              details: {
                format: "gguf",
                family: "llama",
                parameter_size: "1.2B",
                quantization_level: "Q4_K_M"
              }
            },
            {
              name: "deepseek-r1:1.5b",
              model: "deepseek-r1:1.5b",
              modified_at: "2026-11-13T10:00:00Z",
              size: 1100000000,
              digest: "sha256:5678efgh",
              details: {
                format: "gguf",
                family: "qwen2",
                parameter_size: "1.5B",
                quantization_level: "Q4_K_M"
              }
            }
          ]
        })
      } as unknown as Response);

      const adapter = new OllamaAdapter();
      const models = await adapter.listModelsDetailed();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe("llama3.2:1b");
      expect(models[0].details?.parameterSize).toBe("1.2B");
      expect(models[0].details?.quantizationLevel).toBe("Q4_K_M");
      expect(models[1].name).toBe("deepseek-r1:1.5b");
    });

    it("verifies model availability accurately including variant aliases", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          models: [
            {
              name: "llama3.2:1b",
              model: "llama3.2:1b",
              modified_at: "2026-11-14T05:00:00Z",
              size: 1321000000,
              digest: "sha256:1234abcd",
              details: {
                parameter_size: "1.2B",
                quantization_level: "Q4_K_M"
              }
            }
          ]
        })
      } as unknown as Response);

      const adapter = new OllamaAdapter();

      // Check exact match
      const check1 = await adapter.checkModelAvailable("llama3.2:1b");
      expect(check1.available).toBe(true);
      expect(check1.modelId).toBe("llama3.2:1b");

      // Check family alias prefix match (llama3.2 matches llama3.2:1b)
      const check2 = await adapter.checkModelAvailable("llama3.2");
      expect(check2.available).toBe(true);

      // Check missing model
      const check3 = await adapter.checkModelAvailable("mistral-nemo");
      expect(check3.available).toBe(false);
      expect(check3.message).toContain("not installed locally");
    });
  });

  describe("Structured JSON Generation & Zod Validation", () => {
    it("generates structured output validated against a Zod schema", async () => {
      const targetSchema = z.object({
        title: z.string().min(5),
        targetKeyword: z.string(),
        sections: z.array(z.string()).min(2),
        estimatedWordCount: z.number().positive()
      });

      const mockAiOutput = JSON.stringify({
        title: "Complete Guide to Self-Hosted Ollama Workflows",
        targetKeyword: "self-hosted ollama",
        sections: ["Introduction & Architecture", "Local Engine Benchmarks", "Production Hardening"],
        estimatedWordCount: 1850
      });

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          response: mockAiOutput,
          eval_count: 140,
          prompt_eval_count: 45
        })
      } as unknown as Response);

      const adapter = new OllamaAdapter();
      const res = await adapter.generateStructuredOutput(
        {
          modelId: "llama3.2:1b",
          prompt: "Generate an article blueprint"
        },
        targetSchema
      );

      expect(res.data.title).toBe("Complete Guide to Self-Hosted Ollama Workflows");
      expect(res.data.sections).toHaveLength(3);
      expect(res.data.estimatedWordCount).toBe(1850);
      expect(res.raw.tokensUsed).toBe(185);
      expect(res.attempts).toBe(1);
    });

    it("retries and repairs invalid output on the second attempt", async () => {
      const targetSchema = z.object({
        rating: z.number().min(1).max(10),
        verdict: z.string()
      });

      // First call returns malformed text, second call returns valid JSON
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            response: "Here is your rating: 8/10, approved!",
            eval_count: 20,
            prompt_eval_count: 10
          })
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            response: JSON.stringify({ rating: 8, verdict: "approved" }),
            eval_count: 18,
            prompt_eval_count: 35
          })
        } as unknown as Response);

      const adapter = new OllamaAdapter();
      const res = await adapter.generateStructuredOutput(
        {
          modelId: "llama3.2:1b",
          prompt: "Rate compliance"
        },
        targetSchema,
        2
      );

      expect(res.data.rating).toBe(8);
      expect(res.data.verdict).toBe("approved");
      expect(res.attempts).toBe(2);
    });

    it("throws descriptive error when all retry attempts fail schema validation", async () => {
      const targetSchema = z.object({
        status: z.literal("SUCCESS"),
        code: z.number()
      });

      // Both attempts return non-compliant JSON
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          response: JSON.stringify({ status: "INVALID_FIELD", code: "not-a-number" }),
          eval_count: 10,
          prompt_eval_count: 10
        })
      } as unknown as Response);

      const adapter = new OllamaAdapter();
      await expect(
        adapter.generateStructuredOutput(
          { modelId: "llama3.2:1b", prompt: "Test schema" },
          targetSchema,
          2
        )
      ).rejects.toThrow("Failed to generate valid structured output after 2 attempts");
    });
  });

  describe("Timeout and Failure Handling", () => {
    it("handles timeout abort signal appropriately", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "TimeoutError";

      vi.spyOn(global, "fetch").mockRejectedValueOnce(abortError);

      const adapter = new OllamaAdapter("http://localhost:11434", "Local Ollama", {
        connection: 500,
        generation: 500
      });

      await expect(
        adapter.generateText({
          modelId: "llama3.2:1b",
          prompt: "Long task"
        })
      ).rejects.toThrow("Ollama request timed out after 500ms");
    });
  });

  describe("createAIAdapter factory", () => {
    it("creates OllamaAdapter for OLLAMA providerType", () => {
      const adapter = createAIAdapter({
        providerType: "OLLAMA",
        baseUrl: "http://127.0.0.1:11434"
      });
      expect(adapter.providerType).toBe("OLLAMA");
    });

    it("creates OpenAICompatibleAdapter for OPENAI_COMPATIBLE providerType", () => {
      const adapter = createAIAdapter({
        providerType: "OPENAI_COMPATIBLE",
        baseUrl: "http://localhost:8000"
      });
      expect(adapter.providerType).toBe("OPENAI_COMPATIBLE");
    });
  });
});

# PHASE D — AI CONFIGURATION MIGRATION DISCOVERY

**Project:** Apex SEO Engine  
**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Scope:** `AIProvider` and `AIModel` models only  

---

## 1. Prisma Schema Definitions

### AIProvider
```prisma
model AIProvider {
  id              String    @id @default(uuid())
  name            String    @unique
  providerType    String    @default("OLLAMA")
  baseUrl         String
  encryptedApiKey String?
  isLocal         Boolean   @default(true)
  isEnabled       Boolean   @default(true)
  status          String    @default("UNTESTED")
  lastCheckedAt   DateTime?
  totalRequests   Int       @default(0)
  totalTokens     Int       @default(0)
  config          Json      @default("{}")

  models          AIModel[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([providerType])
  @@index([isEnabled])
}
```

### AIModel
```prisma
model AIModel {
  id            String     @id @default(uuid())
  providerId    String
  provider      AIProvider @relation(fields: [providerId], references: [id], onDelete: Cascade)
  name          String
  modelId       String
  capabilities  Json       @default("[\"text\"]")
  contextWindow Int        @default(8192)
  temperature   Float      @default(0.7)
  isDefault     Boolean    @default(false)
  isEnabled     Boolean    @default(true)
  totalRequests Int        @default(0)
  totalTokens   Int        @default(0)

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@unique([providerId, modelId])
  @@index([providerId])
  @@index([isDefault])
}
```

---

## 2. Relationships, Constraints & Cascade Rules

1. **AIProvider -> AIModel**:
   - One-to-many relationship: One `AIProvider` has many `AIModel` records.
   - Foreign key: `AIModel.providerId` references `AIProvider.id`.
   - Cascade behavior: `onDelete: Cascade`. Deleting a provider cascades deletion of its associated models.
2. **Uniqueness Constraints**:
   - `AIProvider.name`: Global unique constraint.
   - `AIModel`: Compound unique constraint on `[providerId, modelId]`.
3. **Indexes**:
   - `AIProvider`: `@@index([providerType])`, `@@index([isEnabled])`.
   - `AIModel`: `@@index([providerId])`, `@@index([isDefault])`.
4. **Tenant Isolation**:
   - `AIProvider` and `AIModel` represent system-level infrastructure configuration (global AI engine endpoints). Access is gated by permissions (`ai:read`, `ai:write`), requiring `SUPER_ADMIN` or authorized administrative roles.
5. **Secret Protection**:
   - `encryptedApiKey` stores AES-256-GCM ciphertexts (`v1:...`). API keys are never returned plaintext to clients or logged in audits/transcripts.

---

## 3. Reference Inventory in Application Code

| File Path | Usages & Direct Queries |
| :--- | :--- |
| `src/app/api/v1/ai-providers/route.ts` | `db.aIProvider.findMany({ include: { models } })`<br>`db.aIProvider.findUnique({ where: { name } })`<br>`db.aIProvider.create({ data: { ..., models: { create } } })`<br>`db.aIProvider.findUnique({ where: { id } })`<br>`db.aIProvider.update({ where: { id }, data: { status, lastCheckedAt, totalRequests } })`<br>`db.aIModel.updateMany({ where: { providerId }, data: { isDefault: false } })`<br>`db.aIModel.create(...)`<br>`db.aIProvider.update({ where: { id }, data: { isEnabled } })` |
| `src/app/api/v1/content/generate-modular/route.ts` | `db.aIProvider.findFirst({ where: { isEnabled: true }, include: { models: { where: { isEnabled: true }, orderBy: { isDefault: "desc" } } } })` |
| `src/app/api/v1/content/topic-outline/route.ts` | `db.aIProvider.findFirst({ where: { isEnabled: true }, include: { models: { where: { isEnabled: true }, orderBy: { isDefault: "desc" } } } })` |
| `src/app/api/v1/dashboard/route.ts` | `db.aIProvider.count({ where: { isEnabled: true } })` (reported as `healthyAIProviders`) |
| `src/lib/seed-service.ts` | `db.aIProvider.upsert({ where: { name: "Local Ollama Engine" } })`<br>`db.aIModel.upsert(...)` (seeds default Llama 3.2 and Nomic Embed models) |

---

## 4. MongoDB Collection & Document Design

### Collections
1. `ai_providers`
   - Primary key: `_id` (ObjectId) or UUID preserved in `id`.
   - Index `uniq_ai_provider_name`: `{ name: 1 }` (unique).
   - Index `idx_ai_provider_type`: `{ providerType: 1 }`.
   - Index `idx_ai_provider_isEnabled`: `{ isEnabled: 1 }`.

2. `ai_models`
   - Primary key: `_id` (ObjectId) or UUID preserved in `id`.
   - Index `uniq_ai_model_provider_model`: `{ providerId: 1, modelId: 1 }` (compound unique).
   - Index `idx_ai_model_providerId`: `{ providerId: 1 }`.
   - Index `idx_ai_model_isDefault`: `{ isDefault: 1 }`.
   - Index `idx_ai_model_isEnabled`: `{ isEnabled: 1 }`.

### Operations to Implement in Repositories
- `findAll(filter?: { isEnabled?: boolean })`: Returns providers with nested models.
- `findById(id: string)`: Returns single provider with nested models.
- `findByName(name: string)`: Look up provider by unique name.
- `findFirstEnabledWithDefaultModel()`: Resolves active provider and primary model for content generation.
- `createProvider(input: CreateAIProviderInput)`: Creates provider and initial default model.
- `updateProvider(id: string, input: Partial<AIProviderEntity>)`: Updates provider status, stats, or enabled flag.
- `deleteProvider(id: string)`: Deletes provider and cascades deletion to child models.
- `countHealthy()`: Counts enabled providers for dashboard metrics.
- `addModel(input: CreateAIModelInput)`: Adds model, handling `isDefault` unset on existing siblings.
- `updateModel(id: string, input: Partial<AIModelEntity>)`: Updates model context window, default status, or enabled flag.
- `deleteModel(id: string)`: Removes single model.
- `findModelsByProvider(providerId: string)`: Lists models for a provider.
- `seedDefaultProviderIfMissing()`: Safe seeding of Local Ollama and models if none exist.

export interface CmsPublishPayload {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: "draft" | "publish";
  metaTitle?: string;
  metaDescription?: string;
  categories?: string[];
}

export interface CmsPublishResult {
  success: boolean;
  externalPostId?: string;
  publishedUrl?: string;
  message: string;
}

export interface CmsConnectionTestResult {
  connected: boolean;
  cmsName: string;
  latencyMs: number;
  message: string;
}

export interface CmsAdapter {
  readonly cmsType: string;
  testConnection(): Promise<CmsConnectionTestResult>;
  publishArticle(payload: CmsPublishPayload): Promise<CmsPublishResult>;
}

/**
 * WordPress REST API Adapter (Free Official WP v2 REST API + Application Passwords)
 */
export class WordPressCmsAdapter implements CmsAdapter {
  readonly cmsType = "WORDPRESS";

  constructor(
    private readonly siteUrl: string,
    private readonly username?: string,
    private readonly appPassword?: string
  ) {}

  private getAuthHeader(): Record<string, string> {
    if (!this.username || !this.appPassword) return {};
    const encoded = Buffer.from(`${this.username}:${this.appPassword}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  async testConnection(): Promise<CmsConnectionTestResult> {
    const start = Date.now();
    try {
      const cleanUrl = this.siteUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/wp-json/wp/v2/types/post`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...this.getAuthHeader()
        },
        signal: AbortSignal.timeout(5000)
      });

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          connected: false,
          cmsName: "WordPress REST API",
          latencyMs,
          message: `WordPress API returned HTTP ${res.status}`
        };
      }

      return {
        connected: true,
        cmsName: "WordPress REST API",
        latencyMs,
        message: "WordPress REST API v2 endpoint verified"
      };
    } catch (err) {
      return {
        connected: false,
        cmsName: "WordPress REST API",
        latencyMs: Date.now() - start,
        message: `WordPress connection failed: ${
          err instanceof Error ? err.message : "Unreachable"
        }`
      };
    }
  }

  async publishArticle(payload: CmsPublishPayload): Promise<CmsPublishResult> {
    try {
      const cleanUrl = this.siteUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          title: payload.title,
          slug: payload.slug,
          content: payload.content,
          excerpt: payload.excerpt || "",
          status: payload.status
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        return {
          success: false,
          message: `WordPress publish failed with HTTP ${res.status}`
        };
      }

      const data = (await res.json()) as { id?: number | string; link?: string };
      return {
        success: true,
        externalPostId: String(data.id || ""),
        publishedUrl: data.link || `${cleanUrl}/${payload.slug}`,
        message: "Published to WordPress successfully"
      };
    } catch (err) {
      return {
        success: false,
        message: `WordPress publishing error: ${
          err instanceof Error ? err.message : "Network error"
        }`
      };
    }
  }
}

/**
 * Custom Webhook / Headless REST CMS Adapter
 */
export class CustomRestCmsAdapter implements CmsAdapter {
  readonly cmsType = "CUSTOM_REST";

  constructor(
    private readonly endpointUrl: string,
    private readonly bearerToken?: string
  ) {}

  async testConnection(): Promise<CmsConnectionTestResult> {
    const start = Date.now();
    try {
      const res = await fetch(this.endpointUrl, {
        method: "HEAD",
        headers: this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {},
        signal: AbortSignal.timeout(5000)
      });
      return {
        connected: res.ok || res.status === 405,
        cmsName: "Custom Headless CMS",
        latencyMs: Date.now() - start,
        message: `Endpoint responded with HTTP ${res.status}`
      };
    } catch (err) {
      return {
        connected: false,
        cmsName: "Custom Headless CMS",
        latencyMs: Date.now() - start,
        message: `Custom CMS endpoint unreachable: ${
          err instanceof Error ? err.message : "Network error"
        }`
      };
    }
  }

  async publishArticle(payload: CmsPublishPayload): Promise<CmsPublishResult> {
    try {
      const res = await fetch(this.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {})
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Custom CMS returned HTTP ${res.status}`
        };
      }

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        url?: string;
      };
      return {
        success: true,
        externalPostId: data.id || `custom-${Date.now()}`,
        publishedUrl: data.url || this.endpointUrl,
        message: "Published via Custom CMS adapter"
      };
    } catch (err) {
      return {
        success: false,
        message: `Custom CMS error: ${err instanceof Error ? err.message : "Network error"}`
      };
    }
  }
}

export function createCmsAdapter(params: {
  cmsType: string;
  siteUrl: string;
  credentials?: Record<string, unknown> | null;
}): CmsAdapter {
  const creds = params.credentials || {};
  if (params.cmsType === "WORDPRESS") {
    return new WordPressCmsAdapter(
      params.siteUrl,
      typeof creds.username === "string" ? creds.username : undefined,
      typeof creds.appPassword === "string" ? creds.appPassword : undefined
    );
  }
  return new CustomRestCmsAdapter(
    typeof creds.endpointUrl === "string" ? creds.endpointUrl : params.siteUrl,
    typeof creds.apiToken === "string" ? creds.apiToken : undefined
  );
}


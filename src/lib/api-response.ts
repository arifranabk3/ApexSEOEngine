import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getSessionFromRequest, hasPermission, SessionUser } from "./auth";
import { checkRateLimit } from "./rate-limit";

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  extraMeta?: Record<string, unknown>
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...extraMeta
      }
    },
    { status }
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {})
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    },
    { status }
  );
}

export async function parseAndValidateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data?: T; errorResponse?: NextResponse<ApiEnvelope<never>> }> {
  try {
    const raw = await req.json();
    const parsed = schema.parse(raw);
    return { data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        errorResponse: apiError(
          "VALIDATION_ERROR",
          "Request payload validation failed",
          422,
          err.flatten()
        )
      };
    }
    return {
      errorResponse: apiError("INVALID_JSON", "Malformed JSON request body", 400)
    };
  }
}

export async function requireApiAuth(
  req: NextRequest,
  requiredPermission?: string
): Promise<{ user?: SessionUser; errorResponse?: NextResponse<ApiEnvelope<never>> }> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rl = checkRateLimit(`api:${ip}`, 180, 60_000);
  if (!rl.allowed) {
    return {
      errorResponse: apiError(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please retry after a short cooldown.",
        429,
        { resetAfterMs: rl.resetAfterMs }
      )
    };
  }

  // CSRF Origin/Host check on state-mutating requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return {
            errorResponse: apiError(
              "CSRF_ORIGIN_MISMATCH",
              "Cross-site request origin does not match application host",
              403
            )
          };
        }
      } catch {
        return {
          errorResponse: apiError("CSRF_INVALID_ORIGIN", "Invalid Origin header", 403)
        };
      }
    }
  }

  const user = await getSessionFromRequest(req);
  if (!user) {
    return {
      errorResponse: apiError("UNAUTHORIZED", "Authentication required", 401)
    };
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return {
      errorResponse: apiError(
        "FORBIDDEN",
        `Insufficient permissions: requires ${requiredPermission}`,
        403
      )
    };
  }

  return { user };
}


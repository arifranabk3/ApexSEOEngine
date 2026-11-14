# APEX SEO ENGINE — PHASE B: AUTH & RBAC TEST STRATEGY

**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Status:** TEST SPECIFICATION  

---

## 1. Test Objectives & Coverage Matrix

The Phase B test suite must verify that switching the authentication store from PostgreSQL to MongoDB preserves 100% of existing behavior with zero security regressions.

| Test Case Category | Specific Scenario | Validation Method | Acceptance Criteria |
|---|---|---|---|
| **Credential Validation** | Valid email & password | Call `authenticateUserCredentials()` | Returns `SessionUser` with accurate roles & permissions |
| **Credential Validation** | Invalid password | Call `authenticateUserCredentials()` | Returns `null`, logs `AUTH_LOGIN_FAILED` in audit log |
| **Credential Validation** | Inactive user (`isActive: false`) | Call `authenticateUserCredentials()` | Returns `null`, prevents login |
| **Session Generation** | Sign JWT with SessionUser | Call `createSessionToken()` | Generates valid HS256 JWT expiring in 24 hours |
| **Session Verification** | Verify active JWT | Call `verifySessionToken()` | Returns valid decoded session user |
| **Session Revocation** | Bump `tokenVersion` | Mutate `tokenVersion` in MongoDB | Existing token immediately rejected by `verifySessionToken()` |
| **Password Rotation** | Change password endpoint | POST `/api/v1/auth/change-password` | Updates hash, clears `mustChangePassword`, bumps `tokenVersion` |
| **RBAC Authorization** | Super Admin wildcard | Call `hasPermission()` | Returns `true` for all actions |
| **RBAC Authorization** | Editor permissions | Call `hasPermission()` | `true` for `content:write`, `false` for `settings:write` |
| **RBAC Authorization** | Viewer permissions | Call `hasPermission()` | `true` for `content:read`, `false` for `content:write` |
| **Unique Constraints** | Duplicate email insertion | Attempt duplicate `users.insertOne()` | Rejection with `MongoServerError: E11000 duplicate key` |
| **Data Migration** | PostgreSQL to Mongo import | Execute verification counter | Record counts in `users`, `roles`, `permissions` match 1:1 |

---

## 2. Dedicated Phase B Test Suite Specification

A new test suite `tests/mongodb-auth-rbac.test.ts` will be created during implementation:

```typescript
describe("Phase B: MongoDB Auth & RBAC Verification Suite", () => {
  it("authenticates seeded admin user against MongoDB collection");
  it("enforces unique email index and prevents duplicate registrations");
  it("correctly derives and resolves roles and permission codes");
  it("enforces session invalidation upon tokenVersion increment");
  it("handles password rotation and atomic update cleanly");
  it("proves parity between PostgreSQL auth results and MongoDB auth results");
});
```

---

## 3. Regression Safeguards
- Existing unit suites (`tests/unit-security.test.ts` and `tests/security-hardening.test.ts`) must continue to run and PASS without failures.
- Dual-read integration tests will verify that both storage engines produce identical `SessionUser` payloads for identical inputs.

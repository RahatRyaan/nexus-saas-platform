# Architecture Decision Records

## ADR-001: Fractional Indexing for Card Positions

**Status:** Accepted  
**Date:** 2026-09-25

### Context
Kanban cards need stable, conflict-free drag-and-drop positions when multiple users move cards concurrently.

### Decision
Use fractional (floating-point) position values (e.g., 16384 between 8192 and 32768). When the gap between adjacent positions falls below 1, rebalance all cards in that list.

### Consequences
- No reordering of all cards on every move (O(1) updates normally)
- Rebalance is infrequent and affects only one list at a time
- Position values grow gracefully without collision

---

## ADR-002: httpOnly Cookie for Refresh Token

**Status:** Accepted  
**Date:** 2026-09-25

### Context
Refresh tokens are long-lived (7 days) and must be protected from XSS attacks.

### Decision
Store refresh tokens in httpOnly, Secure, SameSite=Strict cookies. Access tokens (15m TTL) are passed in Authorization headers and stored in memory only.

### Consequences
- XSS cannot steal refresh tokens
- Access tokens are short-lived, limiting exposure window
- Token family tracking in Redis invalidates entire family on reuse detection (detects token theft)

---

## ADR-003: pgvector over Pinecone

**Status:** Accepted  
**Date:** 2026-09-25

### Context
Semantic search for the Knowledge Base requires a vector store.

### Decision
Use pgvector on self-hosted Postgres (via Docker). Zero external cost, Postgres-native queries, sufficient for capstone scale (~10k documents).

### Consequences
- No external service cost or API keys needed
- Can migrate to Pinecone later if scale demands
- Two databases in stack (MongoDB primary + Postgres vectors-only)

---

## ADR-004: BullMQ for Async AI/Embedding Jobs

**Status:** Accepted  
**Date:** 2026-09-25

### Context
AI API calls (embeddings, summarization, RAG) take 3–15 seconds. Blocking HTTP responses degrades UX.

### Decision
Use BullMQ backed by Redis (already in stack) for all async AI work: document chunking, embedding generation, and notification batching.

### Consequences
- HTTP response time stays under 200ms
- No additional infrastructure beyond Redis
- Jobs are retryable and observable via BullMQ UI

---

## ADR-005: workspaceId Field Isolation for Multi-Tenancy

**Status:** Accepted  
**Date:** 2026-09-25

### Context
Multi-tenant data isolation is required so workspaces cannot access each other's data.

### Decision
Add `workspaceId` field to every tenant-scoped MongoDB document. Enforce via compound indexes `{ workspaceId, _id }` and a base service query helper that always filters by workspaceId.

### Consequences
- Simpler than per-tenant databases for capstone scale
- Compound indexes enforce tenant boundaries at the DB level
- Base service helper prevents accidental cross-tenant leaks

---

## ADR-006: Socket.io Redis Adapter from Day One

**Status:** Accepted  
**Date:** 2026-09-25

### Context
Socket.io rooms need to work correctly when the server eventually scales horizontally.

### Decision
Wire `@socket.io/redis-adapter` immediately, even on single-node deployments. It's a 5-line setup.

### Consequences
- No regression if a second server node is added later
- Redis is already in the stack, zero additional cost
- Slightly higher per-event latency (negligible at capstone scale)

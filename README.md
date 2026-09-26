# Nexus — AI-Powered Team Workspace

A production-grade, multi-tenant SaaS platform combining real-time Kanban boards, team chat, AI assistance, and a searchable knowledge base.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + Zustand
- **Backend:** Node.js + Express + TypeScript
- **Databases:** MongoDB (primary) + Redis (cache/queues) + Postgres/pgvector (AI embeddings)
- **Real-time:** Socket.io + Redis adapter
- **AI:** OpenAI GPT-4o-mini (embeddings + RAG)
- **Billing:** Stripe
- **Storage:** Cloudinary
- **Deploy:** Render (server) + Vercel (client)
- **CI/CD:** GitHub Actions

## Architecture

```
┌─────────────────┐    ┌──────────────────────────────────────┐
│   React Client  │◄──►│  Express API + Socket.io             │
│  (Vite/Vercel)  │    │  (Node.js/Render)                    │
└─────────────────┘    │                                      │
                       │  ┌──────────┐  ┌──────────────────┐  │
                       │  │ MongoDB  │  │  Redis           │  │
                       │  │ (primary)│  │  (cache/BullMQ)  │  │
                       │  └──────────┘  └──────────────────┘  │
                       │  ┌──────────────────────────────────┐  │
                       │  │  Postgres + pgvector (embeddings)│  │
                       │  └──────────────────────────────────┘  │
                       └──────────────────────────────────────┘
```

## Quick Start

```bash
# Copy env template
cp .env.example .env
# Edit .env with your secrets

# Start infrastructure
docker-compose up -d mongo redis postgres

# Install dependencies
npm install

# Start development servers
npm run dev
```

## API Documentation

Swagger UI is available at `http://localhost:5000/api-docs` when the server is running.

## Modules

| Module | Status |
|---|---|
| Auth (JWT + Google OAuth) | ✅ |
| Workspace + RBAC | ✅ |
| Kanban Boards (real-time) | ✅ |
| Team Chat | ✅ |
| Knowledge Base + AI (RAG) | ✅ |
| Billing (Stripe) | ✅ |

## License

MIT

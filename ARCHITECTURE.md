# LuminaLib Architecture

## 1. Overview
LuminaLib is a content-aware library system built with:
- Backend: FastAPI (Python), PostgreSQL
- Frontend: Next.js (React) with SSR
- GenAI: Local LLM (Ollama) by default (swappable)
- Deployment: Docker Compose one-command startup

The backend follows a layered design:
- API layer (routers/controllers): request/response and auth guards only
- Service layer: business use-cases (book ingestion, borrow/return, reviews, recommendations)
- Repository layer: database access (SQLAlchemy)
- Provider/Adapter layer: external integrations (file storage, LLM)

Goal: keep core business logic independent from infrastructure so we can swap storage or LLM via configuration.

---

## 2. Backend Layering and Dependency Injection

### 2.1 Layer Responsibilities
- `app/api/*`: route definitions, Depends injection, response models
- `app/services/*`: orchestration of use-cases and domain rules
- `app/repositories/*`: SQLAlchemy queries and persistence
- `app/providers/*` or `app/services/*` (adapters): LLM, storage, file parsing

### 2.2 Why DI (FastAPI Depends)
All services accept dependencies via constructor injection (DB Session, providers).
This improves:
- testability (inject mocks)
- configurability (swap implementations)
- adherence to SOLID (especially DIP)

---

## 3. Storage Abstraction (Book File Handling)

### 3.1 Requirement
Book creation includes uploading actual content (PDF/TXT), not just metadata.

### 3.2 Approach
A storage interface (`StorageProvider`) defines:
- save_book_file(upload_file) -> StoredFile
- delete_book_file(file_path)
- get_absolute_path(file_path)

Current implementation:
- Local disk storage using a configured base directory.

Why abstraction?
- Allows switching Local -> MinIO/S3 by implementing the same interface, without changing BookService logic.

---

## 4. GenAI Workflow (Async Summarization and Review Consensus)

### 4.1 Book Summarization (On Ingestion)
Flow:
1. POST /books uploads file and metadata
2. API stores file via StorageProvider
3. DB stores book record with summary_status = "pending"
4. A background task triggers summary generation:
   - Extract text from PDF/TXT
   - Build a prompt using title/author context
   - Call the configured LLM provider
5. Persist summary and set summary_status = "completed" (or "failed")

Why async?
- Summarization is expensive (I/O + model inference).
- API should respond quickly and avoid blocking.

Implementation note:
- For assessment scope, FastAPI BackgroundTasks is used.
- Production upgrade path: replace BackgroundTasks with a queue worker (Redis/Celery/RQ/Arq) to add retries, durability, and scaling.

### 4.2 Review Consensus (On Review Submit)
Flow:
1. POST /books/{id}/reviews stores review
2. Constraint: user must have borrowed the book before reviewing
3. A background task recomputes a rolling consensus for the book:
   - Option A: heuristic summary (fast MVP)
   - Option B (preferred): LLM-based synthesis of recent reviews into:
     - overall sentiment
     - key themes
     - pros/cons

The consensus is stored as a single “reader consensus” record per book to serve:
GET /books/{id}/analysis

### 4.3 LLM Provider Abstraction
A provider contract (`BookSummaryProvider`, optionally `ReviewConsensusProvider`) ensures we can swap LLM backends:
- Local LLM via Ollama (default)
- Cloud provider (OpenAI/Grok/etc.) by config

Configuration example:
- LLM_BASE_URL=http://ollama:11434
- LLM_MODEL=llama3
- LLM_ENABLED=true

---

## 5. Recommendation Engine and User Preferences Schema

### 5.1 Objective
Return ML-inspired book suggestions for the current user:
GET /recommendations

### 5.2 User Preferences Schema (Design Rationale)
A dedicated preferences model is stored per user to capture signals that are stable and queryable:
- preferred_tags (derived from borrow/review history)
- preferred_authors
- (optional) weights and last_updated timestamps

Why this design?
- It is simple, explainable, and works without heavy offline training.
- It supports incremental updates as new behavior arrives.
- It is compatible with content-based recommendations and can evolve into collaborative filtering later.

### 5.3 Recommendation Strategy
Current approach: Content-based scoring.
- Build a user profile vector from:
  - tags from borrowed books
  - authors from borrowed books
  - optional review ratings weights
- Score candidate books by overlap with user preferences.
- Return top N books excluding currently borrowed or already-read items.

Upgrade path:
- Add collaborative filtering using user-item interactions (borrow/review matrix).
- Use embeddings for semantic similarity (book summary embeddings + user profile embedding).

---

## 6. Frontend Architecture (Next.js)

### 6.1 SSR
Next.js SSR is used for:
- faster initial load
- SEO-friendly pages for book listings and details

### 6.2 Component Composition
Pages are composed from reusable components:
- atomic UI components (Button, Input, Card)
- feature components (BookCard, ReviewList, BorrowButton)
- page containers (BooksPage, BookDetailPage)

### 6.3 Network Layer (No direct fetch in components)
API calls are abstracted into a typed client/service layer or hooks (React Query/SWR):
- components call hooks/services
- hooks/services handle HTTP details, caching, and errors

### 6.4 Error Handling
- Centralized error boundary for UI
- User-friendly messages for failed requests and auth errors

### 6.5 Testing
Critical UI components are unit tested using Jest + React Testing Library.

---

## 7. Deployment (Docker Compose)

One-command start:
docker-compose up --build

Services:
- backend (FastAPI)
- frontend (Next.js)
- db (PostgreSQL)
- ollama (local LLM)

Environment variables are provided via .env files.
In container networking, the backend uses:
LLM_BASE_URL=http://ollama:11434

---

## 8. Trade-offs and Decisions

### 8.1 BackgroundTasks vs Queue Worker
BackgroundTasks is simpler and meets the async requirement for this assessment.
A queue worker would be preferred in production for:
- retries
- durability across restarts
- horizontal scaling

### 8.2 Local Storage vs Object Storage
Local disk storage is implemented with an abstraction layer.
MinIO/S3 can be added by implementing the StorageProvider interface.

---

## 9. Future Improvements
- Queue worker for LLM jobs + job status tracking
- LLM-based review consensus with structured JSON output
- Embedding-based recommendations using vector store
- Refresh tokens / session management improvements
- Observability: metrics, tracing, structured logging
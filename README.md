# TokTickIT

TokTickIT is an IT service desk application with a React + TypeScript frontend and an Express + TypeScript backend. The backend uses Prisma and PostgreSQL for requester-specific tickets, categories, related systems, and attachment metadata.

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop for local PostgreSQL

## Project structure

```text
client/   React + TypeScript + Vite frontend
server/   Express + TypeScript + Prisma backend
docs/     Lab documentation and evidence
```

## Setup

Install dependencies:

```bash
cd server
npm install

cd ../client
npm install
```

Start PostgreSQL with Docker. Create the container once:

```bash
docker run --name toktickit-postgres \
  -e POSTGRES_USER=toktickit \
  -e POSTGRES_PASSWORD=toktickit \
  -e POSTGRES_DB=toktickit \
  -p 5432:5432 \
  -d postgres:16
```

If the container already exists, start it with:

```bash
docker start toktickit-postgres
```

Create the environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The default `DATABASE_URL` connects to the Docker database above. Keep `server/.env` private; it is ignored by Git.

Initialize Prisma and seed the Lab 2 reference data:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

The seed is safe to run more than once. It creates four active categories, one inactive category
fixture, six active related systems, one inactive related-system fixture, four active requesters,
and one inactive requester fixture. The active categories are:

- Account and Access
- Hardware
- Software
- Network

The inactive fixtures are used to test that inactive database records cannot be selected for new
tickets.

## Run the application

Start the backend in one terminal:

```bash
cd server
npm run dev
```

The API runs at `http://localhost:3000`.

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Vite normally serves the frontend at `http://localhost:5173`.

The main requester workflow is:

1. Select an active Development Requester. This selector is a Lab 2 test context, not login or
   authentication.
2. Create a ticket with a category, related system, summary, description, priority, and optional
   attachment.
3. Open My Tickets to search, filter, sort, paginate, and view only the selected requester's
   tickets.
4. Open Ticket Detail to view read-only ticket data and attachment metadata.

Attachments accept JPG/JPEG, PNG, WEBP, and PDF files up to 5 MB each, with no more than five
active files per ticket. Files are stored locally under `server/uploads/`, which is ignored by
Git. Removing an attachment keeps its metadata but prevents further download.

## Tests and builds

Frontend:

```bash
cd client
npm test
npm run build
```

Backend:

```bash
cd server
npm test -- tests/lab-02 --reporter=dot
npm run build
```

The command above runs only the Lab 2 backend tests. They use Vitest and Supertest.

End-to-end and responsive checks from the repository root:

```bash
npm install
npm run test:e2e
npm run test:e2e:headed
```

Lab 2 specifications and evidence are in [`docs/lab-02/`](docs/lab-02/), including the API
contract, UI contract, test traceability, peer-review record, and AI-use reflection.

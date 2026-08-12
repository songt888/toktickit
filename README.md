# TokTickIT

TokTickIT is an IT service desk application with a React + TypeScript frontend and an Express + TypeScript backend. The backend uses Prisma and PostgreSQL to store IT request categories.

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

Replace the placeholder `DATABASE_URL` in `server/.env` with the local Docker database URL shown below. Keep `server/.env` private; it is ignored by Git.

```env
DATABASE_URL="postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=public"
```

Initialize Prisma and seed the request categories:

```bash
cd server
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

The seed creates the following categories and is safe to run more than once:

- Account and Access
- Hardware
- Software
- Network

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
npm test
npm run build
```

The backend tests use Vitest and Supertest.

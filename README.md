# Lavisha-Insurance-Processing-Backend



## 🐘 Local PostgreSQL Setup (via Docker)

This project uses PostgreSQL running inside a Docker container for local development. Follow the steps below to get started.

---

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) must be installed on your machine.

---

### Start the Postgres container

```bash
docker run --name larisha-pg \
  -e POSTGRES_USER=larisha \
  -e POSTGRES_PASSWORD=123456 \
  -e POSTGRES_DB=larisha_db \
  -p 5432:5432 \
  -v larisha_pg_data:/var/lib/postgresql/data \
  -d postgres:latest
```
- In terminal check `larisha-pg` under names using `sudo docker ps`. 
- Modify the .env `DATABASE_URL` with above user, password, and DB.

### Start the project

```
  npm install
  npm run build
  npm run start
```

### Check Local DB with GUI using Prisma Studio

- From the project directory `cd prisma`.
- Cross check if `schema.prisma` is present. 
- Execute `npx prisma studio` 

### 🛡️ Git Hook to Prevent Unwanted Migrations

To prevent migration files from being committed on non-staging branches, a Husky `pre-commit` hook is set up:

- Allowed: Commit `prisma/migrations/` only on `staging` branch.
- Blocked: On any other branch, you'll get a warning and the commit will be aborted.

This keeps schema history clean and ensures only approved branches have migrations.

💡 On feature branches, use:

```bash
npx prisma db push --force-reset

Run migrations on staging(canonical branch) to keep in sync with all non-staging schema changes;

1- Reset the db with `SKIP_SEED=true npx prisma migrate reset` and make sure to add `SKIP_SEED=true` in env or inline.
2- Peform migration `npx prisma migrate dev --init usefulname`.
3- Peform seeding (Optional) `SKIP_SEED=false npx prisma db seed` or from env.
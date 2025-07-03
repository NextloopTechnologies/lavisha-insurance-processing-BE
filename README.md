# lavisha-insurance-processing-BE



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

```npm install
   npm run build
   npm run start
```

### Check Local DB with GUI using Prisma Studio

- From the project directory `cd prisma`.
- Cross check if `schema.prisma` is present. 
- Execute `npx prisma studio` 
 
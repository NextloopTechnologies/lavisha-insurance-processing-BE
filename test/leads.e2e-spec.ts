/**
 * Website lead intake: POST /v1/leads (shared key, no JWT) and the admin-only
 * list / status endpoints. Runs the real Nest app against a real Postgres.
 *
 * The database is wiped before seeding, so this suite only runs when
 * TEST_DATABASE_URL points at a database whose name contains "test":
 *   TEST_DATABASE_URL=postgresql://user:pass@localhost:55432/lavisha_test \
 *     npx jest --config ./test/jest-e2e.json leads
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LeadStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const canRun =
  !!TEST_DATABASE_URL && /test/i.test(new URL(TEST_DATABASE_URL).pathname);
const describeIfDb = canRun ? describe : describe.skip;

const LEADS_KEY = 'e2e-leads-key';
if (canRun) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_TOKEN = 'e2e-test-jwt-secret';
  process.env.LEADS_API_KEY = LEADS_KEY;
}

jest.setTimeout(30000);

const PASSWORD = 'e2e-pass-123';
const lead = {
  name: 'Dr. Asha Verma',
  hospital: 'City Care Hospital',
  phone: '+91 98765 43210',
  volume: '25 – 100',
};

describeIfDb('Leads: website enquiries (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (tables.length) {
      await db.$executeRawUnsafe(
        `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
      );
    }

    const password = await bcrypt.hash(PASSWORD, 4);
    for (const [key, role] of [
      ['superadmin', Role.SUPER_ADMIN],
      ['admin', Role.ADMIN],
      ['hosp', Role.HOSPITAL],
    ] as const) {
      ids[key] = (
        await db.user.create({
          data: { email: `${key}@e2e.test`, name: key, password, role },
        })
      ).id;
    }

    const { AppModule } = require('../src/app.module');
    const {
      PrismaExceptionFilter,
    } = require('../filters/primsa-exception.filter');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // mirror main.ts
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    for (const who of ['admin', 'hosp']) {
      const res = await http()
        .post('/v1/auth/login')
        .send({ email: `${who}@e2e.test`, password: PASSWORD });
      tokens[who] = res.body.access_token;
    }
  });

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  describe('POST /v1/leads', () => {
    it('rejects requests without the website key', async () => {
      await http().post('/v1/leads').send(lead).expect(401);
      await http()
        .post('/v1/leads')
        .set('x-leads-key', 'wrong')
        .send(lead)
        .expect(401);
      expect(await db.lead.count()).toBe(0);
    });

    it('rejects invalid or unexpected fields', async () => {
      await http()
        .post('/v1/leads')
        .set('x-leads-key', LEADS_KEY)
        .send({ ...lead, phone: 'abc' })
        .expect(400);
      await http()
        .post('/v1/leads')
        .set('x-leads-key', LEADS_KEY)
        .send({ ...lead, status: 'CONVERTED' })
        .expect(400);
      expect(await db.lead.count()).toBe(0);
    });

    it('stores the lead and notifies super admins and admins only', async () => {
      const res = await http()
        .post('/v1/leads')
        .set('x-leads-key', LEADS_KEY)
        .send({ ...lead, email: '' })
        .expect(201);
      ids.lead = res.body.id;

      const stored = await db.lead.findUniqueOrThrow({
        where: { id: ids.lead },
      });
      expect(stored).toMatchObject({
        ...lead,
        email: null,
        status: LeadStatus.NEW,
        source: 'website',
      });

      const notified = (await db.notification.findMany())
        .map((n) => n.userId)
        .sort();
      expect(notified).toEqual([ids.superadmin, ids.admin].sort());
    });
  });

  describe('GET /v1/leads and PATCH /v1/leads/:id', () => {
    it('are closed to anonymous users and hospitals', async () => {
      await http().get('/v1/leads').expect(401);
      await http().get('/v1/leads').set(as('hosp')).expect(403);
      await http()
        .patch(`/v1/leads/${ids.lead}`)
        .set(as('hosp'))
        .send({ status: 'CONTACTED' })
        .expect(403);
    });

    it('let admins list, search and filter leads', async () => {
      const all = await http().get('/v1/leads').set(as('admin')).expect(200);
      expect(all.body.total).toBe(1);
      expect(all.body.data[0].hospital).toBe(lead.hospital);

      const hit = await http()
        .get('/v1/leads')
        .query({ search: 'city care' })
        .set(as('admin'))
        .expect(200);
      expect(hit.body.total).toBe(1);
      const miss = await http()
        .get('/v1/leads')
        .query({ status: 'CLOSED' })
        .set(as('admin'))
        .expect(200);
      expect(miss.body.total).toBe(0);

      await http()
        .get('/v1/leads')
        .query({ sortBy: 'password' })
        .set(as('admin'))
        .expect(400);
    });

    it('let admins move a lead through its statuses', async () => {
      const res = await http()
        .patch(`/v1/leads/${ids.lead}`)
        .set(as('admin'))
        .send({ status: 'CONTACTED' })
        .expect(200);
      expect(res.body.status).toBe('CONTACTED');

      await http()
        .patch(`/v1/leads/${ids.lead}`)
        .set(as('admin'))
        .send({ status: 'BOGUS' })
        .expect(400);
      await http()
        .patch('/v1/leads/00000000-0000-4000-8000-000000000000')
        .set(as('admin'))
        .send({ status: 'CLOSED' })
        .expect(404);
    });
  });
});

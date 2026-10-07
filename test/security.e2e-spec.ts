/**
 * Security regression tests for access control, file ownership and upload limits.
 *
 * Runs the real Nest app (global guards, ValidationPipe, JWT login) against a
 * real Postgres database. Only S3, the presigner and file compression are faked.
 *
 * The database is wiped before seeding, so this suite only runs when
 * TEST_DATABASE_URL points at a database whose name contains "test":
 *   TEST_DATABASE_URL=postgresql://user:pass@localhost:55432/lavisha_test \
 *     npx jest --config ./test/jest-e2e.json security
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role, ClaimStatus, DocumentType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';

// ---- fakes (hoisted above imports by jest) ---------------------------------

type StoredObject = { metadata?: Record<string, string>; size: number };
const s3Store = new Map<string, StoredObject>();
const s3Calls: Array<{ name: string; input: any }> = [];

jest.mock('src/common/utils/s3.util', () => ({
  s3: {
    send: jest.fn(async (command: any) => {
      const name = command.constructor.name;
      const input = command.input;
      s3Calls.push({ name, input });
      switch (name) {
        case 'PutObjectCommand':
          s3Store.set(input.Key, { metadata: input.Metadata, size: input.Body?.length ?? 0 });
          return {};
        case 'HeadObjectCommand': {
          const object = s3Store.get(input.Key);
          if (!object) {
            const error: any = new Error('NotFound');
            error.name = 'NotFound';
            throw error;
          }
          return { Metadata: object.metadata ?? {} };
        }
        case 'DeleteObjectsCommand': {
          const keys = input.Delete.Objects.map((o: any) => o.Key);
          keys.forEach((k: string) => s3Store.delete(k));
          return { Deleted: keys.map((Key: string) => ({ Key })) };
        }
        case 'DeleteObjectCommand':
          s3Store.delete(input.Key);
          return {};
        default:
          throw new Error(`Unexpected S3 command in test: ${name}`);
      }
    }),
  },
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async (_client: unknown, command: any) => `https://signed.test/${command.input.Key}`,
}));

jest.mock('src/common/utils/compress.utils', () => ({
  compressPdf: async (buffer: Buffer) => buffer,
  compressImage: async (buffer: Buffer) => buffer,
}));

// ---- environment -------------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const canRun = !!TEST_DATABASE_URL && /test/i.test(new URL(TEST_DATABASE_URL).pathname);
const describeIfDb = canRun ? describe : describe.skip;

if (canRun) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_TOKEN = 'e2e-test-jwt-secret';
  process.env.AWS_BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'ap-south-1';
}

const PASSWORD = 'e2e-pass-123';
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);

describeIfDb('Security: access control and file ownership (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  const tokens: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const refs: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  async function resetDatabase() {
    const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (tables.length) {
      await db.$executeRawUnsafe(
        `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
      );
    }
  }

  async function seed() {
    const password = await bcrypt.hash(PASSWORD, 4);
    const user = (key: string, role: Role, extra: Record<string, unknown> = {}) =>
      db.user.create({ data: { email: `${key}@e2e.test`, name: key, password, role, ...extra } });

    ids.superAdmin = (await user('superadmin', Role.SUPER_ADMIN)).id;
    ids.admin = (await user('admin', Role.ADMIN)).id;
    ids.hospA = (await user('hospa', Role.HOSPITAL, {
      hospitalName: 'Hospital A',
      profileFileName: 'profiles/hospA-legacy.png',
      rateListFileNames: ['hospitals/hospA-rates-legacy.pdf'],
    })).id;
    ids.hospB = (await user('hospb', Role.HOSPITAL, { hospitalName: 'Hospital B' })).id;
    ids.mgrA = (await user('mgra', Role.HOSPITAL_MANAGER, { hospitalId: ids.hospA })).id;
    ids.mgrNoHosp = (await user('mgrnohosp', Role.HOSPITAL_MANAGER)).id;

    ids.patientA = (await db.patient.create({ data: { name: 'Patient A', age: 40, hospitalUserId: ids.hospA } })).id;
    ids.patientB = (await db.patient.create({ data: { name: 'Patient B', age: 50, hospitalUserId: ids.hospB } })).id;

    let n = 0;
    const claim = async (key: string, patientId: string, status: ClaimStatus, docFile?: string) => {
      n += 1;
      const created = await db.insuranceRequest.create({
        data: {
          refNumber: `CLM-${String(n).padStart(5, '0')}`,
          patientId,
          status,
          doctorName: 'Dr Test',
          insuranceCompany: 'Insurer',
          tpaName: 'TPA',
          assignedTo: ids.admin,
        },
      });
      ids[key] = created.id;
      refs[key] = created.refNumber;
      if (docFile) {
        ids[`doc_${key}`] = (await db.document.create({
          data: { fileName: docFile, type: DocumentType.ICP, insuranceRequestId: created.id },
        })).id;
      }
    };
    await claim('claimA', ids.patientA, ClaimStatus.PENDING, 'claims/docA-legacy.pdf');
    await claim('claimB', ids.patientB, ClaimStatus.PENDING, 'claims/docB-legacy.pdf');
    await claim('draftA', ids.patientA, ClaimStatus.DRAFT, 'claims/draftA.pdf');
    await claim('draftB', ids.patientB, ClaimStatus.DRAFT);
    await claim('draftB2', ids.patientB, ClaimStatus.DRAFT);

    for (const side of ['A', 'B']) {
      const claimId = ids[`claim${side}`];
      const enh = await db.enhancement.create({ data: { insuranceRequestId: claimId, numberOfDays: 2 } });
      ids[`enh${side}`] = enh.id;
      ids[`doc_enh${side}`] = (await db.document.create({
        data: { fileName: `claims/enh${side}.pdf`, type: DocumentType.OTHER, insuranceRequestId: claimId, enhancementId: enh.id },
      })).id;
      const query = await db.query.create({ data: { insuranceRequestId: claimId, notes: 'q' } });
      ids[`q${side}`] = query.id;
      ids[`doc_q${side}`] = (await db.document.create({
        data: { fileName: `claims/q${side}.pdf`, type: DocumentType.OTHER, insuranceRequestId: claimId, queryId: query.id },
      })).id;
    }

    // objects uploaded before ownership tagging existed (no metadata)
    for (const key of [
      'claims/docA-legacy.pdf', 'claims/docB-legacy.pdf', 'claims/draftA.pdf',
      'profiles/hospA-legacy.png', 'hospitals/hospA-rates-legacy.pdf', 'claims/orphan-legacy.pdf',
    ]) {
      s3Store.set(key, { size: 1 });
    }
  }

  async function login(who: string) {
    const res = await http().post('/v1/auth/login').send({ email: `${who}@e2e.test`, password: PASSWORD });
    expect(res.status).toBe(201);
    tokens[who] = res.body.access_token;
  }

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    await resetDatabase();
    await seed();

    // required after env is set so ConfigModule/Prisma pick up the test values
    const { AppModule } = require('../src/app.module');
    const { PrismaExceptionFilter } = require('../filters/primsa-exception.filter');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // mirror main.ts
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    for (const who of ['superadmin', 'admin', 'hospa', 'hospb', 'mgra', 'mgrnohosp']) await login(who);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  // ---------------------------------------------------------------------------
  describe('POST /auth/register (was: any logged-in user could create SUPER_ADMIN)', () => {
    const body = (role: Role, email: string) => ({ email, password: 'secret123', name: 'New', role });

    it('rejects an unauthenticated request', async () => {
      await http().post('/v1/auth/register').send(body(Role.HOSPITAL, 'anon@e2e.test')).expect(401);
    });

    it('forbids a HOSPITAL user from registering a SUPER_ADMIN', async () => {
      await http().post('/v1/auth/register').set(as('hospa')).send(body(Role.SUPER_ADMIN, 'evil1@e2e.test')).expect(403);
      expect(await db.user.findUnique({ where: { email: 'evil1@e2e.test' } })).toBeNull();
    });

    it('forbids a HOSPITAL user from registering any user', async () => {
      await http().post('/v1/auth/register').set(as('hospa')).send(body(Role.HOSPITAL, 'evil2@e2e.test')).expect(403);
    });

    it('forbids a HOSPITAL_MANAGER from registering users', async () => {
      await http().post('/v1/auth/register').set(as('mgra')).send(body(Role.ADMIN, 'evil3@e2e.test')).expect(403);
    });

    it('rejects SUPER_ADMIN even when an admin registers', async () => {
      await http().post('/v1/auth/register').set(as('admin')).send(body(Role.SUPER_ADMIN, 'evil4@e2e.test')).expect(400);
      expect(await db.user.findUnique({ where: { email: 'evil4@e2e.test' } })).toBeNull();
    });

    it('lets an admin register a HOSPITAL user', async () => {
      const res = await http().post('/v1/auth/register').set(as('admin')).send(body(Role.HOSPITAL, 'newhosp@e2e.test'));
      expect(res.status).toBe(201);
      expect((await db.user.findUnique({ where: { email: 'newhosp@e2e.test' } }))?.role).toBe(Role.HOSPITAL);
    });
  });

  // ---------------------------------------------------------------------------
  describe('PATCH /users/:id (was: self-promotion and editing other users)', () => {
    it('forbids a HOSPITAL user from editing another hospital', async () => {
      await http().patch(`/v1/users/${ids.hospB}`).set(as('hospa')).send({ name: 'pwned' }).expect(403);
      expect((await db.user.findUnique({ where: { id: ids.hospB } }))?.name).toBe('hospb');
    });

    it('forbids a HOSPITAL user from editing an admin', async () => {
      await http().patch(`/v1/users/${ids.admin}`).set(as('hospa')).send({ name: 'pwned' }).expect(403);
    });

    it('ignores role in a HOSPITAL user\'s own update but applies other fields', async () => {
      const res = await http().patch(`/v1/users/${ids.hospA}`).set(as('hospa')).send({ name: 'Hosp A renamed', role: Role.ADMIN });
      expect(res.status).toBe(200);
      const after = await db.user.findUnique({ where: { id: ids.hospA } });
      expect(after?.role).toBe(Role.HOSPITAL);
      expect(after?.name).toBe('Hosp A renamed');
    });

    it('still has no admin permissions after attempting self-promotion', async () => {
      await http().get('/v1/users').set(as('hospa')).expect(403);
    });

    it('ignores hospitalId in a manager\'s own update', async () => {
      const res = await http().patch(`/v1/users/${ids.mgrA}`).set(as('mgra')).send({ hospitalId: ids.hospB, name: 'Mgr A' });
      expect(res.status).toBe(200);
      expect((await db.user.findUnique({ where: { id: ids.mgrA } }))?.hospitalId).toBe(ids.hospA);
    });

    it('forbids a manager from editing their own hospital\'s user record', async () => {
      await http().patch(`/v1/users/${ids.hospA}`).set(as('mgra')).send({ name: 'x' }).expect(403);
    });

    it('lets an admin edit another user, including role and hospital', async () => {
      await http().patch(`/v1/users/${ids.mgrNoHosp}`).set(as('admin')).send({ name: 'Mgr assigned' }).expect(200);
      expect((await db.user.findUnique({ where: { id: ids.mgrNoHosp } }))?.name).toBe('Mgr assigned');
    });

    it('still blocks modifying a SUPER_ADMIN (existing rule)', async () => {
      await http().patch(`/v1/users/${ids.superAdmin}`).set(as('admin')).send({ name: 'x' }).expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Claims (was: cross-hospital delete, foreign patients and documents)', () => {
    const newClaim = (patientId: string) => ({
      patientId,
      doctorName: 'Dr New',
      tpaName: 'TPA',
      insuranceCompany: 'Insurer',
      documents: [{ fileName: 'claims/new-claim.pdf', type: DocumentType.ICP }],
    });

    it('does not let hospital B delete hospital A\'s draft claim', async () => {
      await http().delete(`/v1/claims/${refs.draftA}`).set(as('hospb')).expect(400);
      expect(await db.insuranceRequest.findUnique({ where: { id: ids.draftA } })).not.toBeNull();
    });

    it('rejects a manager with no hospital instead of matching every claim', async () => {
      await http().delete(`/v1/claims/${refs.draftB}`).set(as('mgrnohosp')).expect(403);
      expect(await db.insuranceRequest.findUnique({ where: { id: ids.draftB } })).not.toBeNull();
    });

    it('lets hospital A delete its own draft and removes its S3 files', async () => {
      await http().delete(`/v1/claims/${refs.draftA}`).set(as('hospa')).expect(200);
      expect(await db.insuranceRequest.findUnique({ where: { id: ids.draftA } })).toBeNull();
      expect(s3Store.has('claims/draftA.pdf')).toBe(false);
    });

    it('lets an admin delete any hospital\'s draft', async () => {
      await http().delete(`/v1/claims/${refs.draftB2}`).set(as('admin')).expect(200);
      expect(await db.insuranceRequest.findUnique({ where: { id: ids.draftB2 } })).toBeNull();
    });

    it('rejects creating a claim for another hospital\'s patient', async () => {
      const before = await db.insuranceRequest.count({ where: { patientId: ids.patientB } });
      await http().post('/v1/claims').set(as('hospa')).send(newClaim(ids.patientB)).expect(400);
      expect(await db.insuranceRequest.count({ where: { patientId: ids.patientB } })).toBe(before);
    });

    it('lets a hospital create a claim for its own patient', async () => {
      await http().post('/v1/claims').set(as('hospa')).send(newClaim(ids.patientA)).expect(201);
    });

    it('lets a manager create a claim for their hospital\'s patient', async () => {
      await http().post('/v1/claims').set(as('mgra')).send(newClaim(ids.patientA)).expect(201);
    });

    it('lets an admin create a claim for any patient', async () => {
      await http().post('/v1/claims').set(as('admin')).send(newClaim(ids.patientB)).expect(201);
    });

    it('rejects re-linking a claim to another hospital\'s patient', async () => {
      await http().patch(`/v1/claims/${refs.claimA}`).set(as('hospa')).send({ patientId: ids.patientB }).expect(400);
      expect((await db.insuranceRequest.findUnique({ where: { id: ids.claimA } }))?.patientId).toBe(ids.patientA);
    });

    it('rejects editing a document that belongs to another claim', async () => {
      const res = await http().patch(`/v1/claims/${refs.claimA}`).set(as('hospa')).send({
        documents: [{ id: ids.doc_claimB, fileName: 'claims/hijacked.pdf', type: DocumentType.ICP }],
      });
      expect(res.status).toBe(400);
      expect((await db.document.findUnique({ where: { id: ids.doc_claimB } }))?.fileName).toBe('claims/docB-legacy.pdf');
    });

    it('allows editing a document on the same claim', async () => {
      await http().patch(`/v1/claims/${refs.claimA}`).set(as('hospa')).send({
        documents: [{ id: ids.doc_claimA, fileName: 'claims/docA-legacy.pdf', type: DocumentType.CLINIC_PAPER }],
      }).expect(200);
      expect((await db.document.findUnique({ where: { id: ids.doc_claimA } }))?.type).toBe(DocumentType.CLINIC_PAPER);
    });

    it('rejects a claim update from a manager with no hospital', async () => {
      await http().patch(`/v1/claims/${refs.claimB}`).set(as('mgrnohosp')).send({ doctorName: 'x' }).expect(403);
      expect((await db.insuranceRequest.findUnique({ where: { id: ids.claimB } }))?.doctorName).toBe('Dr Test');
    });

    it('lets a manager update their hospital\'s claim', async () => {
      await http().patch(`/v1/claims/${refs.claimA}`).set(as('mgra')).send({ diagnosis: 'by manager' }).expect(200);
      expect((await db.insuranceRequest.findUnique({ where: { id: ids.claimA } }))?.diagnosis).toBe('by manager');
    });

    it('still hides another hospital\'s claim on update and read (existing scoping)', async () => {
      await http().patch(`/v1/claims/${refs.claimA}`).set(as('hospb')).send({ doctorName: 'x' }).expect(400);
      const res = await http().get(`/v1/claims/${refs.claimA}`).set(as('hospb'));
      expect([400, 404]).toContain(res.status);
    });

    it('lists only the caller\'s own claims (existing scoping)', async () => {
      const res = await http().get('/v1/claims').set(as('hospb')).expect(200);
      const patientIds = res.body.data.map((c: any) => c.patient?.id ?? c.patientId);
      expect(patientIds.length).toBeGreaterThan(0);
      expect(patientIds.every((p: string) => p === ids.patientB)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Enhancements (was: any claim / enhancement id accepted)', () => {
    it('rejects creating an enhancement on another hospital\'s claim', async () => {
      await http().post('/v1/enhancements').set(as('hospb')).send({
        insuranceRequestId: ids.claimA, numberOfDays: 3, documents: [{ fileName: 'claims/e.pdf', type: DocumentType.OTHER }],
      }).expect(400);
    });

    it('lets a hospital create an enhancement on its own claim', async () => {
      await http().post('/v1/enhancements').set(as('hospa')).send({
        insuranceRequestId: ids.claimA, numberOfDays: 3, documents: [{ fileName: 'claims/e.pdf', type: DocumentType.OTHER }],
      }).expect(201);
    });

    it('lets an admin create an enhancement on any claim', async () => {
      await http().post('/v1/enhancements').set(as('admin')).send({
        insuranceRequestId: ids.claimB, numberOfDays: 1, documents: [{ fileName: 'claims/e2.pdf', type: DocumentType.OTHER }],
      }).expect(201);
    });

    it('rejects changing another hospital\'s enhancement status', async () => {
      await http().patch(`/v1/enhancements/${ids.enhA}`).set(as('hospb')).send({ status: ClaimStatus.APPROVED }).expect(400);
      expect((await db.enhancement.findUnique({ where: { id: ids.enhA } }))?.status).toBe(ClaimStatus.PENDING);
    });

    it('rejects editing a document that belongs to another enhancement', async () => {
      await http().patch(`/v1/enhancements/${ids.enhA}`).set(as('hospa')).send({
        documents: [{ id: ids.doc_enhB, fileName: 'claims/hijacked.pdf', type: DocumentType.OTHER }],
      }).expect(400);
      expect((await db.document.findUnique({ where: { id: ids.doc_enhB } }))?.fileName).toBe('claims/enhB.pdf');
    });

    it('lets the owning hospital and its manager update the enhancement', async () => {
      await http().patch(`/v1/enhancements/${ids.enhA}`).set(as('hospa')).send({ notes: 'by hospital' }).expect(200);
      await http().patch(`/v1/enhancements/${ids.enhA}`).set(as('mgra')).send({ notes: 'by manager' }).expect(200);
      expect((await db.enhancement.findUnique({ where: { id: ids.enhA } }))?.notes).toBe('by manager');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Queries (was: any claim / query / enhancement id accepted)', () => {
    const doc = [{ fileName: 'claims/q-new.pdf', type: DocumentType.OTHER }];

    it('rejects creating a query on another hospital\'s claim', async () => {
      await http().post('/v1/queries').set(as('hospb')).send({ insuranceRequestId: ids.claimA, documents: doc }).expect(400);
    });

    it('rejects linking a query to an enhancement of a different claim', async () => {
      await http().post('/v1/queries').set(as('hospa')).send({
        insuranceRequestId: ids.claimA, enhancementId: ids.enhB, documents: doc,
      }).expect(400);
    });

    it('lets a hospital create a query on its own claim and enhancement', async () => {
      await http().post('/v1/queries').set(as('hospa')).send({
        insuranceRequestId: ids.claimA, enhancementId: ids.enhA, documents: doc,
      }).expect(201);
    });

    it('rejects resolving another hospital\'s query', async () => {
      await http().patch(`/v1/queries/${ids.qA}`).set(as('hospb')).send({ isResolved: true }).expect(400);
      expect((await db.query.findUnique({ where: { id: ids.qA } }))?.isResolved).toBe(false);
    });

    it('rejects editing a document that belongs to another query', async () => {
      await http().patch(`/v1/queries/${ids.qA}`).set(as('hospa')).send({
        documents: [{ id: ids.doc_qB, fileName: 'claims/hijacked.pdf', type: DocumentType.OTHER }],
      }).expect(400);
      expect((await db.document.findUnique({ where: { id: ids.doc_qB } }))?.fileName).toBe('claims/qB.pdf');
    });

    it('lets the owning hospital update its query', async () => {
      await http().patch(`/v1/queries/${ids.qA}`).set(as('hospa')).send({ notes: 'updated' }).expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe('File upload ownership tag and limits', () => {
    const upload = (who: string, folder = 'claims', name = 'scan.png', buffer = PNG) =>
      http().post('/v1/file/upload').set(as(who)).field('folder', folder).attach('file', buffer, { filename: name, contentType: 'image/png' });

    it('tags a hospital upload with that hospital', async () => {
      const res = await upload('hospa');
      expect(res.status).toBe(201);
      ids.keyHospA = res.body.key;
      expect(s3Store.get(res.body.key)?.metadata).toEqual({ 'owner-scope': ids.hospA });
    });

    it('tags a manager upload with the manager\'s hospital', async () => {
      const res = await upload('mgra');
      expect(res.status).toBe(201);
      ids.keyMgrA = res.body.key;
      expect(s3Store.get(res.body.key)?.metadata).toEqual({ 'owner-scope': ids.hospA });
    });

    it('tags an admin upload as admin', async () => {
      const res = await upload('admin');
      expect(res.status).toBe(201);
      ids.keyAdmin = res.body.key;
      expect(s3Store.get(res.body.key)?.metadata).toEqual({ 'owner-scope': 'admin' });
    });

    it('rejects a file over 10 MB with 413 before it reaches S3', async () => {
      const puts = s3Calls.filter((c) => c.name === 'PutObjectCommand').length;
      const res = await upload('hospa', 'claims', 'big.png', Buffer.alloc(10 * 1024 * 1024 + 1));
      expect(res.status).toBe(413);
      expect(s3Calls.filter((c) => c.name === 'PutObjectCommand').length).toBe(puts);
    });

    it('accepts a file of exactly 10 MB', async () => {
      const res = await upload('hospa', 'claims', 'edge.png', Buffer.alloc(10 * 1024 * 1024));
      expect(res.status).toBe(201);
    });

    it('rejects a bulk upload containing one file over 10 MB and stores none', async () => {
      const puts = s3Calls.filter((c) => c.name === 'PutObjectCommand').length;
      const res = await http().post('/v1/file/bulkUpload').set(as('hospa')).field('folder', 'claims')
        .attach('files', PNG, { filename: 'ok.png', contentType: 'image/png' })
        .attach('files', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });
      expect(res.status).toBe(413);
      expect(s3Calls.filter((c) => c.name === 'PutObjectCommand').length).toBe(puts);
    });

    it('rejects more than 6 files in a bulk upload and stores none', async () => {
      const puts = s3Calls.filter((c) => c.name === 'PutObjectCommand').length;
      let req = http().post('/v1/file/bulkUpload').set(as('hospa')).field('folder', 'claims');
      for (let i = 0; i < 7; i++) req = req.attach('files', PNG, { filename: `f${i}.png`, contentType: 'image/png' });
      const res = await req;
      expect(res.status).toBe(400);
      expect(s3Calls.filter((c) => c.name === 'PutObjectCommand').length).toBe(puts);
    });

    it('accepts 6 files in a bulk upload and tags each', async () => {
      let req = http().post('/v1/file/bulkUpload').set(as('hospb')).field('folder', 'claims');
      for (let i = 0; i < 6; i++) req = req.attach('files', PNG, { filename: `g${i}.png`, contentType: 'image/png' });
      const res = await req;
      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(6);
      ids.keyHospB = res.body[0].key;
      for (const item of res.body) expect(s3Store.get(item.key)?.metadata).toEqual({ 'owner-scope': ids.hospB });
    });

    it('still rejects uploads without a token', async () => {
      await http().post('/v1/file/upload').field('folder', 'claims').attach('file', PNG, 'x.png').expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('DELETE /file/bulkDelete (was: anyone could delete any S3 key)', () => {
    const del = (who: string, fileNames: string[]) =>
      http().delete('/v1/file/bulkDelete').set(as(who)).send({ fileNames });

    it('forbids hospital B deleting a file hospital A uploaded', async () => {
      await del('hospb', [ids.keyHospA]).expect(403);
      expect(s3Store.has(ids.keyHospA)).toBe(true);
    });

    it('forbids hospital B deleting a legacy file attached to hospital A\'s claim', async () => {
      await del('hospb', ['claims/docA-legacy.pdf']).expect(403);
      expect(s3Store.has('claims/docA-legacy.pdf')).toBe(true);
      expect(await db.document.findUnique({ where: { id: ids.doc_claimA } })).not.toBeNull();
    });

    it('forbids deleting an untagged file attached to nothing', async () => {
      await del('hospa', ['claims/orphan-legacy.pdf']).expect(403);
      expect(s3Store.has('claims/orphan-legacy.pdf')).toBe(true);
    });

    it('is all-or-nothing: one foreign key blocks the whole request', async () => {
      await del('hospa', [ids.keyHospA, ids.keyHospB]).expect(403);
      expect(s3Store.has(ids.keyHospA)).toBe(true);
      expect(s3Store.has(ids.keyHospB)).toBe(true);
    });

    it('lets hospital A delete a file it uploaded', async () => {
      await del('hospa', [ids.keyHospA]).expect(200);
      expect(s3Store.has(ids.keyHospA)).toBe(false);
    });

    it('lets hospital A delete a file its manager uploaded (same hospital)', async () => {
      await del('hospa', [ids.keyMgrA]).expect(200);
      expect(s3Store.has(ids.keyMgrA)).toBe(false);
    });

    it('lets hospital A delete its own legacy profile file', async () => {
      await del('hospa', ['profiles/hospA-legacy.png']).expect(200);
      expect(s3Store.has('profiles/hospA-legacy.png')).toBe(false);
    });

    it('lets a manager delete their hospital\'s legacy rate-list file', async () => {
      await del('mgra', ['hospitals/hospA-rates-legacy.pdf']).expect(200);
    });

    it('lets hospital A delete a legacy file attached to its own claim, removing the document row', async () => {
      await del('hospa', ['claims/docA-legacy.pdf']).expect(200);
      expect(s3Store.has('claims/docA-legacy.pdf')).toBe(false);
      expect(await db.document.findUnique({ where: { id: ids.doc_claimA } })).toBeNull();
    });

    it('rejects a manager with no hospital', async () => {
      await del('mgrnohosp', [ids.keyHospB]).expect(403);
    });

    it('lets an admin delete any file', async () => {
      await del('admin', [ids.keyHospB, 'claims/orphan-legacy.pdf', ids.keyAdmin]).expect(200);
      expect(s3Store.has(ids.keyHospB)).toBe(false);
      expect(s3Store.has('claims/orphan-legacy.pdf')).toBe(false);
    });

    it('rejects an unauthenticated request', async () => {
      await http().delete('/v1/file/bulkDelete').send({ fileNames: ['x'] }).expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('API contract the frontend now relies on (role / hospitalUserId no longer sent)', () => {
    it('lists claim comments without a role query param', async () => {
      const res = await http().get('/v1/comments').query({ insuranceRequestId: ids.claimA }).set(as('hospa'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('marks comments read without a role in the body', async () => {
      await http().patch('/v1/comments/mark_read').set(as('hospa')).send({ insuranceRequestId: ids.claimA }).expect(200);
    });

    it('serves the hospital dashboard without hospitalUserId', async () => {
      await http().get('/v1/dashboard').query({ fromDate: '2020-01-01', toDate: '2030-01-01' }).set(as('hospa')).expect(200);
    });

    it('ignores a hospitalUserId sent by a hospital user (scope comes from the token)', async () => {
      const own = await http().get('/v1/dashboard').query({ fromDate: '2020-01-01', toDate: '2030-01-01' }).set(as('hospa'));
      const spoofed = await http().get('/v1/dashboard')
        .query({ fromDate: '2020-01-01', toDate: '2030-01-01', hospitalUserId: ids.hospB }).set(as('hospa'));
      expect(spoofed.status).toBe(200);
      expect(spoofed.body).toEqual(own.body);
    });

    it('serves the admin dashboard with and without a hospital filter', async () => {
      await http().get('/v1/dashboard').query({ fromDate: '2020-01-01', toDate: '2030-01-01' }).set(as('admin')).expect(200);
      await http().get('/v1/dashboard')
        .query({ fromDate: '2020-01-01', toDate: '2030-01-01', hospitalUserId: ids.hospB }).set(as('admin')).expect(200);
    });
  });
  // ---------------------------------------------------------------------------
  describe('Chat history lines (claim created / assigned / pre-auth / enhancement / query)', () => {
    let ref = '';
    let claimId = '';
    // lines use the user's current name; an earlier test renames hospital A
    let hosp = '';
    beforeAll(async () => { hosp = (await db.user.findUnique({ where: { id: ids.hospA } }))!.name; });
    const systemLines = async () =>
      (await db.comment.findMany({ where: { insuranceRequestId: claimId, type: 'SYSTEM' }, orderBy: { createdAt: 'asc' } })).map((c) => c.text);
    const notificationsSince = (since: Date, message: RegExp) =>
      db.notification.findMany({ where: { createdAt: { gte: since } } }).then((ns) => ns.filter((n) => message.test(n.message)));

    it('claim created with pre-auth ticked: two chat lines, creator + super-admin still notified', async () => {
      const since = new Date();
      const res = await http().post('/v1/claims').set(as('hospa')).send({
        patientId: ids.patientA, doctorName: 'Dr Chat', tpaName: 'TPA', insuranceCompany: 'Insurer', isPreAuth: true,
        documents: [{ fileName: 'claims/chat-icp.pdf', type: DocumentType.ICP }],
      }).expect(201);
      ref = res.body.refNumber;
      claimId = res.body.id;
      const lines = await systemLines();
      expect(lines).toContain(`${hosp} created claim ${ref}`);
      expect(lines).toContain(`${hosp} marked pre-auth as done for ${ref}`);
      expect(lines.filter((l) => l === `${hosp} created claim ${ref}`)).toHaveLength(1);
      const created = await notificationsSince(since, new RegExp(`created claim ${ref}$`));
      expect(created.map((n) => n.userId).sort()).toEqual([ids.hospA, ids.superAdmin].sort());
    });

    it('the hospital sees those lines in its chat', async () => {
      const res = await http().get('/v1/comments').query({ insuranceRequestId: claimId }).set(as('hospa')).expect(200);
      const texts = res.body.filter((c: any) => c.type === 'SYSTEM').map((c: any) => c.text);
      expect(texts).toEqual(expect.arrayContaining([`${hosp} created claim ${ref}`, `${hosp} marked pre-auth as done for ${ref}`]));
    });

    it('assigning writes one chat line; assignee and hospital are notified as before', async () => {
      const since = new Date();
      await http().patch(`/v1/claims/assign/${ref}`).set(as('admin')).send({ assignedTo: ids.admin }).expect(200);
      expect((await systemLines()).filter((l) => l === `admin has assigned ${ref} to admin.`)).toHaveLength(1);
      const notified = await notificationsSince(since, /has assigned/);
      expect(notified.map((n) => n.userId).sort()).toEqual([ids.admin, ids.hospA].sort());
    });

    it('pre-auth unticked then ticked on edit: one line each; saving without a change adds none', async () => {
      await http().patch(`/v1/claims/${ref}`).set(as('hospa')).send({ isPreAuth: false }).expect(200);
      await http().patch(`/v1/claims/${ref}`).set(as('hospa')).send({ isPreAuth: false, diagnosis: 'no pre-auth change' }).expect(200);
      await http().patch(`/v1/claims/${ref}`).set(as('hospa')).send({ isPreAuth: true }).expect(200);
      const lines = (await systemLines()).filter((l) => l.includes('pre-auth'));
      expect(lines).toEqual([
        `${hosp} marked pre-auth as done for ${ref}`,
        `${hosp} marked pre-auth as not done for ${ref}`,
        `${hosp} marked pre-auth as done for ${ref}`,
      ]);
    });

    it('enhancement created writes a chat line', async () => {
      await http().post('/v1/enhancements').set(as('hospa')).send({
        insuranceRequestId: claimId, numberOfDays: 2, documents: [{ fileName: 'claims/chat-enh.pdf', type: DocumentType.OTHER }],
      }).expect(201);
      expect(await systemLines()).toContain(`${hosp} created enhancement for claim ${ref}`);
    });

    it('query created and query resolved write chat lines; assignee and hospital notified', async () => {
      const created = await http().post('/v1/queries').set(as('admin')).send({
        insuranceRequestId: claimId, notes: 'Need records', documents: [{ fileName: 'claims/chat-q.pdf', type: DocumentType.OTHER }],
      }).expect(201);
      const since = new Date();
      await http().patch(`/v1/queries/${created.body.id}`).set(as('hospa')).send({ isResolved: true, resolvedRemarks: 'sent' }).expect(200);
      const lines = await systemLines();
      expect(lines).toContain(`admin created query for claim ${ref}`);
      expect(lines).toContain(`${hosp} has marked query as resolved for claim ${ref}`);
      const notified = await notificationsSince(since, /marked query as resolved/);
      expect(notified.map((n) => n.userId).sort()).toEqual([ids.admin, ids.hospA].sort());
    });
  });
});

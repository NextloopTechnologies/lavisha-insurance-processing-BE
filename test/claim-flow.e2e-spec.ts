/**
 * End-to-end claim lifecycle across every role: SUPER_ADMIN, ADMIN, HOSPITAL,
 * HOSPITAL_MANAGER, plus a second hospital that must never see the claim.
 *
 * Walks the requirement #13 flow from pre-auth to settlement and checks, at each
 * step, the claim status, the chat line and exactly who was notified.
 *
 * Runs the real Nest app against a real Postgres; only S3 is faked. The database
 * is wiped first, so it only runs when TEST_DATABASE_URL names a "test" database:
 *   TEST_DATABASE_URL=postgresql://user:pass@localhost:55432/lavisha_test \
 *     npx jest --config ./test/jest-e2e.json --runInBand claim-flow
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClaimStatus, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { CLAIM_STATUS_LABELS as LABEL } from 'src/common/constants/claim-status.constants';

jest.mock('src/common/utils/s3.util', () => ({
  s3: { send: jest.fn(async () => ({ Deleted: [] })) },
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async (_client: unknown, command: any) => `https://signed.test/${command.input.Key}`,
}));

jest.setTimeout(30000);

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const canRun = !!TEST_DATABASE_URL && /test/i.test(new URL(TEST_DATABASE_URL).pathname);
const describeIfDb = canRun ? describe : describe.skip;

if (canRun) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_TOKEN = 'e2e-flow-jwt-secret';
  process.env.AWS_BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'ap-south-1';
}

const PASSWORD = 'e2e-flow-pass';
const USERS = {
  superadmin: { name: 'Super Admin', role: Role.SUPER_ADMIN },
  admin: { name: 'Admin Ravi', role: Role.ADMIN },
  admin2: { name: 'Admin Two', role: Role.ADMIN },
  hosp: { name: 'City Care', role: Role.HOSPITAL },
  mgr: { name: 'City Manager', role: Role.HOSPITAL_MANAGER },
  other: { name: 'Other Hospital', role: Role.HOSPITAL },
} as const;
type Who = keyof typeof USERS;

describeIfDb('Claim lifecycle across all roles (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;
  const ids = {} as Record<Who | 'patient' | 'claim' | 'query' | 'enhancement', string>;
  const tokens = {} as Record<Who, string>;
  let ref = '';

  const http = () => request(app.getHttpServer());
  const as = (who: Who) => ({ Authorization: `Bearer ${tokens[who]}` });
  const doc = (fileName: string, type: string, remark?: string) => ({ fileName: `claims/${fileName}`, type, ...(remark && { remark }) });

  /** Users notified with a message matching `pattern` (messages include the claim ref, so they are unique). */
  const notified = async (pattern: RegExp) =>
    (await db.notification.findMany()).filter((n) => pattern.test(n.message)).map((n) => n.userId).sort();
  const chatLines = async () =>
    (await db.comment.findMany({ where: { insuranceRequestId: ids.claim, type: 'SYSTEM' }, orderBy: { createdAt: 'asc' } })).map((c) => c.text);
  const statusOf = async () => (await db.insuranceRequest.findUniqueOrThrow({ where: { id: ids.claim } })).status;

  const ADMIN_SIDE = () => [ids.hosp, ids.mgr].sort(); // who hears about admin actions
  const HOSPITAL_SIDE = () => [ids.admin, ids.superadmin].sort(); // who hears about hospital actions (assignee + super admin)

  /** Moves the claim to `next` as `who` and checks status, chat line and recipients. */
  async function moveTo(who: Who, next: ClaimStatus, extra: Record<string, unknown> = {}) {
    const previous = await statusOf();
    await http().patch(`/v1/claims/${ref}`).set(as(who)).send({ status: next, ...extra }).expect(200);
    expect(await statusOf()).toBe(next);
    const line = `${USERS[who].name} updated status from ${LABEL[previous]} to ${LABEL[next]} for ${ref}`;
    expect((await chatLines()).filter((l) => l === line)).toHaveLength(1);
    const adminActed = USERS[who].role === Role.ADMIN || USERS[who].role === Role.SUPER_ADMIN;
    expect(await notified(new RegExp(`^${escape(line)}$`))).toEqual(adminActed ? ADMIN_SIDE() : HOSPITAL_SIDE());
  }
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (tables.length) {
      await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }

    const password = await bcrypt.hash(PASSWORD, 4);
    for (const who of ['superadmin', 'admin', 'admin2', 'hosp', 'other'] as Who[]) {
      const { name, role } = USERS[who];
      ids[who] = (await db.user.create({
        data: { email: `${who}@flow.test`, name, role, password, ...(role === Role.HOSPITAL && { hospitalName: name }) },
      })).id;
    }
    ids.mgr = (await db.user.create({
      data: { email: 'mgr@flow.test', name: USERS.mgr.name, role: Role.HOSPITAL_MANAGER, password, hospitalId: ids.hosp },
    })).id;

    const { AppModule } = require('../src/app.module');
    const { PrismaExceptionFilter } = require('../filters/primsa-exception.filter');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();

    for (const who of Object.keys(USERS) as Who[]) {
      const res = await http().post('/v1/auth/login').send({ email: `${who}@flow.test`, password: PASSWORD }).expect(201);
      tokens[who] = res.body.access_token;
    }
  });

  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it('hospital manager registers a patient for their hospital', async () => {
    const res = await http().post('/v1/patients').set(as('mgr')).send({ name: 'Meera Joshi', age: 52 }).expect(201);
    ids.patient = res.body.id;
    expect((await db.patient.findUniqueOrThrow({ where: { id: ids.patient } })).hospitalUserId).toBe(ids.hosp);
  });

  it('hospital creates a pre-auth with several files per type and a future admission date; only super admin is notified', async () => {
    const admission = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const res = await http().post('/v1/claims').set(as('hosp')).send({
      patientId: ids.patient,
      doctorName: 'Dr. Mehta',
      tpaName: 'MEDI ASSIST',
      insuranceCompany: 'STAR HEALTH',
      isPreAuth: true,
      dateOfAdmission: admission,
      documents: [
        doc('preauth-form.pdf', 'PRE_AUTH'),
        doc('icp-1.pdf', 'ICP'), doc('icp-2.pdf', 'ICP'), doc('icp-3.webp', 'ICP'),
        doc('estimate.xlsx', 'OTHER', 'Cost estimate'),
      ],
    }).expect(201);
    ref = res.body.refNumber;
    ids.claim = res.body.id;

    const claim = await db.insuranceRequest.findUniqueOrThrow({ where: { id: ids.claim }, include: { documents: true } });
    expect(claim.status).toBe(ClaimStatus.PENDING);
    expect(claim.dateOfAdmission!.toISOString()).toBe(admission);
    expect(claim.documents.filter((d) => d.type === 'ICP')).toHaveLength(3);
    expect(await notified(new RegExp(`created claim ${ref}$`))).toEqual([ids.superadmin]);
    expect(await notified(new RegExp(`uploaded 5 document\\(s\\) for ${ref}$`))).toEqual([ids.superadmin]);
  });

  it('a different hospital can neither see nor change the claim', async () => {
    const view = await http().get(`/v1/claims/${ref}`).set(as('other'));
    expect([403, 404]).toContain(view.status);
    const list = await http().get('/v1/claims').set(as('other')).expect(200);
    expect(list.body.data.map((c: any) => c.refNumber)).not.toContain(ref);
    const change = await http().patch(`/v1/claims/${ref}`).set(as('other')).send({ status: 'SENT_TO_TPA' });
    expect(change.status).toBeGreaterThanOrEqual(400);
    expect(await statusOf()).toBe(ClaimStatus.PENDING);
  });

  it('hospital-side users cannot assign; super admin assigns to an admin and the hospital side plus the assignee are notified', async () => {
    await http().patch(`/v1/claims/assign/${ref}`).set(as('hosp')).send({ assignedTo: ids.admin }).expect(403);
    await http().patch(`/v1/claims/assign/${ref}`).set(as('mgr')).send({ assignedTo: ids.admin }).expect(403);
    await http().patch(`/v1/claims/assign/${ref}`).set(as('superadmin')).send({ assignedTo: ids.admin }).expect(200);
    expect(await notified(new RegExp(`has assigned ${ref} to`))).toEqual([ids.hosp, ids.mgr, ids.admin].sort());
  });

  it('chat: the manager writes to the assignee, the admin replies to the hospital side', async () => {
    await http().post('/v1/comments').set(as('mgr')).send({ type: 'NOTE', text: `Flow ${ref}: patient admitted`, insuranceRequestId: ids.claim }).expect(201);
    expect(await notified(new RegExp(`: "Flow ${ref}: patient admitted"$`))).toEqual(HOSPITAL_SIDE());
    await http().post('/v1/comments').set(as('admin')).send({ type: 'NOTE', text: `Flow ${ref}: noted`, insuranceRequestId: ids.claim, hospitalId: ids.hosp }).expect(201);
    expect(await notified(new RegExp(`: "Flow ${ref}: noted"$`))).toEqual(ADMIN_SIDE());
  });

  it('pre-auth: Pending -> Sent to TPA', async () => {
    await moveTo('admin', ClaimStatus.SENT_TO_TPA);
  });

  it('query: TPA query raised by the admin, answered by the manager -> Query Reply Sent', async () => {
    const query = await http().post('/v1/queries').set(as('admin')).send({
      insuranceRequestId: ids.claim, notes: 'TPA wants past records', documents: [doc('tpa-query.pdf', 'OTHER', 'TPA letter')],
    }).expect(201);
    ids.query = query.body.id;
    expect(await notified(new RegExp(`created query for claim ${ref}$`))).toEqual(ADMIN_SIDE());
    await moveTo('admin', ClaimStatus.QUERIED);

    await http().patch(`/v1/queries/${ids.query}`).set(as('mgr')).send({
      isResolved: true, resolvedRemarks: 'Records attached', documents: [doc('past-records-1.pdf', 'CURRENT_INVESTIGATION'), doc('past-records-2.pdf', 'CURRENT_INVESTIGATION')],
    }).expect(200);
    expect(await notified(new RegExp(`marked query as resolved for claim ${ref}$`))).toEqual(HOSPITAL_SIDE());
    await moveTo('mgr', ClaimStatus.QUERY_REPLY_SENT);
  });

  it('denied, the denial reversed to approved, then an enhancement requested by the hospital and approved', async () => {
    await moveTo('admin', ClaimStatus.DENIED);
    await moveTo('admin', ClaimStatus.APPROVED);
    const enhancement = await http().post('/v1/enhancements').set(as('hosp')).send({
      insuranceRequestId: ids.claim, numberOfDays: 2, notes: 'Two more days needed',
      documents: [doc('revised-icp-1.pdf', 'ICP'), doc('revised-icp-2.pdf', 'ICP')],
    }).expect(201);
    ids.enhancement = enhancement.body.id;
    expect(await notified(new RegExp(`created enhancement for claim ${ref}$`))).toEqual(HOSPITAL_SIDE());
    await moveTo('hosp', ClaimStatus.ENHANCEMENT);
    expect(LABEL.ENHANCEMENT).toBe('Enhancement');
    await moveTo('admin', ClaimStatus.APPROVED);
  });

  it('discharge: initiated by the hospital with papers, sent and approved by the admin', async () => {
    await moveTo('hosp', ClaimStatus.DISCHARGE_INITIATED, {
      dateOfDischarge: new Date().toISOString(),
      dischargeSummary: 'Stable at discharge',
      documents: [doc('discharge-summary.pdf', 'DISCHARGE_OTHER', 'Discharge summary'), doc('final-bill.xlsx', 'DISCHARGE_OTHER', 'Final bill')],
    });
    await moveTo('admin', ClaimStatus.DISCHARGE_SENT);
    await moveTo('admin', ClaimStatus.DISCHARGED);
    expect(LABEL.DISCHARGED).toBe('Discharge Approved');
  });

  it('settlement: initiated, then settled with the settlement letter; settlement dates are stamped', async () => {
    await moveTo('admin', ClaimStatus.SETTLEMENT_INITIATED);
    await moveTo('admin', ClaimStatus.SETTLED, {
      settlementAmount: '90000', actualQuotedAmount: '100000',
      documents: [doc('settlement-letter.pdf', 'SETTLEMENT_LETTER'), doc('utr.pdf', 'SETTLEMENT_OTHER', 'UTR')],
    });
    const claim = await db.insuranceRequest.findUniqueOrThrow({ where: { id: ids.claim } });
    expect(claim.settlementDate).not.toBeNull();
    expect(claim.updatedSettlementDate).not.toBeNull();
  });

  it('every role on the hospital side and admin side reads the full claim; documents are grouped', async () => {
    for (const who of ['superadmin', 'admin', 'admin2', 'hosp', 'mgr'] as Who[]) {
      const { body } = await http().get(`/v1/claims/${ref}`).set(as(who)).expect(200);
      expect(body.status).toBe('SETTLED');
      expect(body.documents.filter((d: any) => d.type === 'ICP')).toHaveLength(3);
      expect(body.enhancements[0].documents).toHaveLength(2);
      expect(body.queries[0].documents.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('the status trail in the chat follows the new flow, one line per change', async () => {
    // labels can contain " to " ("Pre-Auth Sent to TPA"), so match the target against the known labels
    const labels = Object.values(LABEL).sort((a, b) => b.length - a.length);
    const trail = (await chatLines())
      .filter((l) => l.includes('updated status'))
      .map((l) => labels.find((label) => l.endsWith(` to ${label} for ${ref}`)));
    expect(trail).toEqual([
      'Pre-Auth Sent to TPA', 'Query', 'Query Reply Sent', 'Pre-Auth Denied', 'Pre-Auth Approved', 'Enhancement', 'Pre-Auth Approved',
      'Discharge Initiated', 'Discharge Sent', 'Discharge Approved', 'Settlement Initiated', 'Settled',
    ]);
  });

  it('nobody was ever notified about their own action', async () => {
    const own = await db.notification.findMany({ include: { user: { select: { name: true } } } });
    expect(own.filter((n) => n.message.startsWith(`${n.user.name} `))).toEqual([]);
  });

  it('claim list filters work with the new statuses', async () => {
    const settled = await http().get('/v1/claims').query({ status: 'SETTLED' }).set(as('mgr')).expect(200);
    expect(settled.body.data.map((c: any) => c.refNumber)).toContain(ref);
    const replied = await http().get('/v1/claims').query({ status: 'QUERY_REPLY_SENT,DISCHARGE_SENT' }).set(as('admin')).expect(200);
    expect(replied.body.data.map((c: any) => c.refNumber)).not.toContain(ref);
  });

  it('dashboards count the claim in the Settled stage for admins, the hospital and its manager, not for another hospital', async () => {
    const range = { fromDate: '2020-01-01', toDate: '2035-01-01' };
    for (const who of ['superadmin', 'admin', 'hosp', 'mgr'] as Who[]) {
      const { body } = await http().get('/v1/dashboard').query(range).set(as(who)).expect(200);
      expect(body.totalClaims).toBe(1);
      expect(body.claimsByStage.find((s: any) => s.key === 'SETTLED')).toMatchObject({ count: 1, percentage: '100.00' });
    }
    const { body } = await http().get('/v1/dashboard').query(range).set(as('other')).expect(200);
    expect(body.totalClaims).toBe(0);
  });

  it('drafts: the manager saves a draft and deletes it; another hospital cannot delete it', async () => {
    const draft = await http().post('/v1/claims').set(as('mgr')).send({
      patientId: ids.patient, doctorName: 'Dr. Draft', tpaName: 'TPA', insuranceCompany: 'INS', status: 'DRAFT',
      documents: [doc('draft-icp.pdf', 'ICP')],
    }).expect(201);
    const denied = await http().delete(`/v1/claims/${draft.body.refNumber}`).set(as('other'));
    expect(denied.status).toBeGreaterThanOrEqual(400);
    await http().delete(`/v1/claims/${draft.body.refNumber}`).set(as('mgr')).expect(200);
    expect(await db.insuranceRequest.findUnique({ where: { id: draft.body.id } })).toBeNull();
  });
});

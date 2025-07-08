import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {

    const { 
        SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD,
        ADMIN_EMAIL, ADMIN_PASSWORD,
        HOSPITAL_EMAIL, HOSPITAL_PASSWORD,
    } = process.env;

    if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD ||
        !ADMIN_EMAIL || !ADMIN_PASSWORD ||
        !HOSPITAL_EMAIL || !HOSPITAL_PASSWORD) {
        throw new Error('Missing required environment variables for seeding.');
    }

    const superAdmin = await prisma.user.upsert({
        where: { email: SUPER_ADMIN_EMAIL },
        update: {},
        create: {
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD, 
        name: 'Super Admin',
        role: Role.SUPER_ADMIN,
        },
    });

    console.log('✅ Seeded user:', superAdmin.email);

    const admin = await prisma.user.upsert({
        where: { email: ADMIN_EMAIL },
        update: {},
        create: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD, 
        name: 'Admin',
        role: Role.ADMIN,
        },
    });

    console.log('✅ Seeded user:', admin.email);

    const hospital = await prisma.user.upsert({
        where: { email: HOSPITAL_EMAIL },
        update: {},
        create: {
        email: HOSPITAL_EMAIL,
        password: HOSPITAL_PASSWORD, 
        name: 'Hospital',
        role: Role.HOSPITAL,
        },
    });

    console.log('✅ Seeded user:', hospital.email);

    const patient = await prisma.patient.create({
        data: {
        name: 'John Doe',
        age: 35,
        },
    });

    console.log('✅ Seeded patient:', patient.name);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

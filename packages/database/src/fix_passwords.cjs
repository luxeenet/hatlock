const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://hatlock:hatlock_dev_pass_2026@localhost:5432/hatlock_db?schema=public' }
  }
});

async function run() {
  const hash = bcrypt.hashSync('Admin@123456', 10);
  await prisma.user.updateMany({ data: { passwordHash: hash } });

  // Ensure admin@hatlock.local exists
  await prisma.user.upsert({
    where: { email: 'admin@hatlock.local' },
    update: { passwordHash: hash, isActive: true },
    create: {
      email: 'admin@hatlock.local',
      phone: '+255700000000',
      passwordHash: hash,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true
    }
  });

  // Ensure business@demo.local exists
  const existingBiz = await prisma.business.findFirst();
  const demoUser = await prisma.user.upsert({
    where: { email: 'business@demo.local' },
    update: { passwordHash: hash, isActive: true },
    create: {
      email: 'business@demo.local',
      phone: '+255700000002',
      passwordHash: hash,
      role: 'BUSINESS_OWNER',
      isActive: true,
      emailVerified: true
    }
  });

  if (existingBiz) {
    await prisma.employee.upsert({
      where: { userId: demoUser.id },
      update: { businessId: existingBiz.id },
      create: {
        userId: demoUser.id,
        businessId: existingBiz.id,
        firstName: 'Demo',
        lastName: 'Manager',
        position: 'Business Owner'
      }
    });
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  console.log('✅ Updated users in DB with working password "Admin@123456":');
  console.table(users);
  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

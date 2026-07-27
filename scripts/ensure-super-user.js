const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_USER_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error('SUPER_USER_EMAIL dan SUPER_USER_PASSWORD (minimal 8 karakter) wajib diisi.');
  }
  await prisma.user.upsert({
    where: { email },
    update: { name: 'Super User', role: Role.SUPER_USER, businessUnitId: null, passwordHash: await bcrypt.hash(password, 10) },
    create: { name: 'Super User', email, role: Role.SUPER_USER, passwordHash: await bcrypt.hash(password, 10) }
  });
  console.log(`Super user ${email} siap.`);
}

main().catch((error) => { console.error(error.message); process.exit(1); }).finally(() => prisma.$disconnect());

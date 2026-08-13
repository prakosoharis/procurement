const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const businessUnits = [
  ['NANOVEST', 'SMMA', 'Financial Services'], ['NARINDO', 'SMMA', 'Financial Services'],
  ['BAHANA', 'SMMA', 'Financial Services'], ['SINARMAS SEKURITAS', 'SMMA', 'Financial Services'],
  ['BKES', 'SMM', 'Renewable Energy'], ['GEMS', 'SMM', 'Mining'], ['BCE', 'SMM', 'Mining'],
  ['ESSENS', 'Non Group', 'Renewable Energy'], ['SUN ENERGY', 'Non Group', 'Renewable Energy'],
  ['EBER', 'Non Group', 'Mining']
];
const mandatory = [
  ['M1', 'Procurement Policy', 1],
  ['M2', 'Procurement SOP', 2],
  ['M3', 'Supplier Info & Performance Mgmt SOP', 3],
  ['M4', 'Matrix Level Authorization', 4],
  ['M5', 'Ethic Policy', 5],
  ['M7', 'Value Creation', 7]
];
const additional = ['Additional'];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi untuk bootstrap production.`);
  return value;
}

async function main() {
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Procurement Administrator';
  if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD minimal 12 karakter.');

  const groups = {};
  for (const groupName of [...new Set(businessUnits.map((item) => item[1]))]) {
    groups[groupName] = await prisma.organizationGroup.upsert({ where: { name: groupName }, update: {}, create: { name: groupName } });
  }
  const industries = {};
  for (const industryName of [...new Set(businessUnits.map((item) => item[2]))]) {
    industries[industryName] = await prisma.industry.upsert({ where: { name: industryName }, update: {}, create: { name: industryName } });
  }
  for (const [unitName, groupName, industryName] of businessUnits) {
    await prisma.businessUnit.upsert({
      where: { name: unitName },
      update: { groupName, industry: industryName, country: 'Indonesia', organizationGroupId: groups[groupName].id, industryId: industries[industryName].id },
      create: { name: unitName, groupName, industry: industryName, country: 'Indonesia', organizationGroupId: groups[groupName].id, industryId: industries[industryName].id }
    });
  }
  for (const [code, typeName, sortOrder] of mandatory) {
    await prisma.documentType.upsert({ where: { code }, update: { name: typeName, category: 'MANDATORY', sortOrder }, create: { code, name: typeName, category: 'MANDATORY', sortOrder } });
  }
  for (const typeName of additional) {
    await prisma.documentType.upsert({ where: { code: 'OTHER' }, update: { name: typeName, category: 'ADDITIONAL', sortOrder: 100 }, create: { code: 'OTHER', name: typeName, category: 'ADDITIONAL', sortOrder: 100 } });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, role: Role.CORPORATE_GOVERNANCE, passwordHash },
    create: { name, email, passwordHash, role: Role.CORPORATE_GOVERNANCE }
  });
  console.log(`Production master data dan admin ${email} siap.`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());

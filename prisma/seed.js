const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const businessUnits = [
  ['NANOVEST','SMMA','Financial Services'],['NARINDO','SMMA','Financial Services'],['BAHANA','SMMA','Financial Services'],['SINARMAS SEKURITAS','SMMA','Financial Services'],
  ['BKES','SMM','Renewable Energy'],['GEMS','SMM','Mining'],['BCE','SMM','Mining'],
  ['ESSENS','Non Group','Renewable Energy'],['SUN ENERGY','Non Group','Renewable Energy'],['EBER','Non Group','Mining']
];
const mandatory = [
  ['M1','Procurement Policy',1],
  ['M2','Procurement SOP',2],
  ['M3','Supplier Info & Performance Mgmt SOP',3],
  ['M4','Matrix Level Authorization',4],
  ['M5','Ethic Policy',5],
  ['M6','Value Creation',6]
];
const additional = ['Additional'];

async function main() {
  const passwordHash = await bcrypt.hash('demo12345', 10);
  const groups={}; for (const name of [...new Set(businessUnits.map(item=>item[1]))]) groups[name]=await prisma.organizationGroup.upsert({where:{name},update:{},create:{name}});
  const industries={}; for (const name of [...new Set(businessUnits.map(item=>item[2]))]) industries[name]=await prisma.industry.upsert({where:{name},update:{},create:{name}});
  for (const [name, groupName, industry] of businessUnits) await prisma.businessUnit.upsert({ where:{name}, update:{groupName,industry,country:'Indonesia',organizationGroupId:groups[groupName].id,industryId:industries[industry].id}, create:{name,groupName,industry,country:'Indonesia',organizationGroupId:groups[groupName].id,industryId:industries[industry].id} });
  for (const [code,name,sortOrder] of mandatory) await prisma.documentType.upsert({where:{code},update:{name,category:'MANDATORY',sortOrder},create:{code,name,category:'MANDATORY',sortOrder}});
  for (const [index,name] of additional.entries()) await prisma.documentType.upsert({where:{code:'OTHER'},update:{name,category:'ADDITIONAL',sortOrder:100},create:{code:'OTHER',name,category:'ADDITIONAL',sortOrder:100}});
  const bkes = await prisma.businessUnit.findUnique({where:{name:'BKES'}});
  await prisma.user.upsert({where:{email:'admin@procurement.local'},update:{name:'Corporate Governance',role:Role.CORPORATE_GOVERNANCE,passwordHash},create:{name:'Corporate Governance',email:'admin@procurement.local',passwordHash,role:Role.CORPORATE_GOVERNANCE}});
  await prisma.user.upsert({where:{email:'procurement@procurement.local'},update:{name:'Corporate Procurement',role:Role.CORPORATE_GOVERNANCE,passwordHash},create:{name:'Corporate Procurement',email:'procurement@procurement.local',passwordHash,role:Role.CORPORATE_GOVERNANCE}});
  await prisma.user.upsert({where:{email:'budi@procurement.local'},update:{name:'Budi Santoso',role:Role.BUSINESS_UNIT_PIC,passwordHash,businessUnitId:bkes.id},create:{name:'Budi Santoso',email:'budi@procurement.local',passwordHash,role:Role.BUSINESS_UNIT_PIC,businessUnitId:bkes.id}});
}
main().catch(error=>{console.error(error);process.exit(1)}).finally(()=>prisma.$disconnect());

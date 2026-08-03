const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const businessUnits = [
  ['NANOVEST','SMMA','Financial Services'],['NARINDO','SMMA','Financial Services'],['BAHANA','SMMA','Financial Services'],['SINARMAS SEKURITAS','SMMA','Financial Services'],
  ['BKES','SMM','Renewable Energy'],['GEMS','SMM','Mining'],['BCE','SMM','Mining'],
  ['ESSENS','Non Group','Renewable Energy'],['SUN ENERGY','Non Group','Renewable Energy'],['EBER','Non Group','Mining']
];
const mandatory = ['Procurement Policy','Procurement SOP','Supplier Info & Performance Mgmt SOP','Matrix Level Authorization','Ethic Policy','Code of Conduct'];
const additional = ['Work Risk-Level Standard','Segregation of Duties Standard','Whistleblowing / Grievance Policy','Vendor Due Diligence Procedure','Purchase Order Standard','Conflict of Interest Policy','Accounts Payable SOP'];

async function main() {
  const passwordHash = await bcrypt.hash('demo12345', 10);
  const groups={}; for (const name of [...new Set(businessUnits.map(item=>item[1]))]) groups[name]=await prisma.organizationGroup.upsert({where:{name},update:{},create:{name}});
  const industries={}; for (const name of [...new Set(businessUnits.map(item=>item[2]))]) industries[name]=await prisma.industry.upsert({where:{name},update:{},create:{name}});
  for (const [name, groupName, industry] of businessUnits) await prisma.businessUnit.upsert({ where:{name}, update:{groupName,industry,country:'Indonesia',organizationGroupId:groups[groupName].id,industryId:industries[industry].id}, create:{name,groupName,industry,country:'Indonesia',organizationGroupId:groups[groupName].id,industryId:industries[industry].id} });
  for (const [index,name] of mandatory.entries()) await prisma.documentType.upsert({where:{code:`M${index+1}`},update:{name,category:'MANDATORY',sortOrder:index+1},create:{code:`M${index+1}`,name,category:'MANDATORY',sortOrder:index+1}});
  for (const [index,name] of additional.entries()) await prisma.documentType.upsert({where:{code:`A${index+1}`},update:{name,category:'ADDITIONAL',sortOrder:index+1},create:{code:`A${index+1}`,name,category:'ADDITIONAL',sortOrder:index+7}});
  const bkes = await prisma.businessUnit.findUnique({where:{name:'BKES'}});
  await prisma.user.upsert({where:{email:'admin@procurement.local'},update:{name:'Corporate Governance',role:Role.CORPORATE_GOVERNANCE,passwordHash},create:{name:'Corporate Governance',email:'admin@procurement.local',passwordHash,role:Role.CORPORATE_GOVERNANCE}});
  await prisma.user.upsert({where:{email:'procurement@procurement.local'},update:{name:'Corporate Procurement',role:Role.CORPORATE_GOVERNANCE,passwordHash},create:{name:'Corporate Procurement',email:'procurement@procurement.local',passwordHash,role:Role.CORPORATE_GOVERNANCE}});
  await prisma.user.upsert({where:{email:'budi@procurement.local'},update:{name:'Budi Santoso',role:Role.BUSINESS_UNIT_PIC,passwordHash,businessUnitId:bkes.id},create:{name:'Budi Santoso',email:'budi@procurement.local',passwordHash,role:Role.BUSINESS_UNIT_PIC,businessUnitId:bkes.id}});
}
main().catch(error=>{console.error(error);process.exit(1)}).finally(()=>prisma.$disconnect());

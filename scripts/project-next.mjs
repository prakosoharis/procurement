import fs from'node:fs';const p=JSON.parse(fs.readFileSync('docs/PROJECT-PLAN.json'));const t=p.tasks.find(x=>x.status==='READY');console.log(JSON.stringify(t,null,2));

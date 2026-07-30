'use client';
import { useState } from 'react';

function EditDraft({ version, onDone }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body = { expectedState:'DRAFT', expectedUpdatedAt:version.updatedAt, versionNumber:form.get('versionNumber'), effectiveDate:form.get('effectiveDate')||undefined, reviewIntervalMonths:form.get('reviewIntervalMonths')?Number(form.get('reviewIntervalMonths')):undefined, reviewOverrideReason:form.get('reviewOverrideReason')||undefined, changeSummary:form.get('changeSummary')||undefined };
    const response = await fetch(`/api/governance/versions/${version.versionId}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify(body) }); const result = await response.json();
    if (!result.ok) { setMessage(result.error?.code==='CONCURRENT_MODIFICATION'?'This SOP version has changed since you opened it. Reload the latest data before saving again.':result.error?.message); return; }
    setOpen(false); onDone();
  }
  return <>{<button onClick={()=>setOpen(true)}>Edit Draft</button>}{open&&<form className="repository-card" onSubmit={save}><h2>Edit Draft</h2><label>Version<input name="versionNumber" defaultValue={version.versionNumber}/></label><label>Effective date<input type="date" name="effectiveDate" defaultValue={version.effectiveDate?.slice(0,10)}/></label><label>Review interval months<input type="number" name="reviewIntervalMonths" defaultValue={version.reviewIntervalMonths||''}/></label><label>Review override reason<input name="reviewOverrideReason" defaultValue={version.reviewOverrideReason||''}/></label><label>Change summary<textarea name="changeSummary" defaultValue={version.changeSummary||''}/></label><button>Save Draft</button><button type="button" onClick={()=>setOpen(false)}>Cancel</button><p>{message}</p></form>}</>;
}

export default function Actions({ sopId, version, publishedVersion, capabilities = {}, onDone }) {
  const [message, setMessage] = useState('');
  const c = { canEditDraft:false, canSubmitDraft:false, canStartRefinement:false, canCompleteHumanRefinement:false, canCreateRevision:false, ...capabilities };
  async function call(path, payload) { const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}), result=await response.json(); if(!result.ok){setMessage(result.error?.code==='CONCURRENT_MODIFICATION'?'This SOP version has changed since you opened it. Refresh the latest data before saving again.':result.error?.message);return;} setMessage('Saved successfully.');onDone(); }
  if (!version) return null;
  return <section className="repository-actions"><b>Available actions</b>{c.canEditDraft&&version.lifecycleState==='DRAFT'&&<EditDraft version={version} onDone={onDone}/>} {c.canSubmitDraft&&version.lifecycleState==='DRAFT'&&<button onClick={()=>confirm('Submit this draft for governance review?')&&call(`/api/governance/versions/${version.versionId}/submit`,{expectedState:'DRAFT'})}>Submit</button>} {c.canStartRefinement&&version.lifecycleState==='SUBMITTED'&&<button onClick={()=>confirm('Start the manual governance refinement workflow?')&&call(`/api/governance/versions/${version.versionId}/refinement/start`,{expectedState:'SUBMITTED'})}>Start Refinement</button>} {c.canCompleteHumanRefinement&&version.lifecycleState==='REFINEMENT'&&<><button onClick={()=>{const reason=prompt('Reason'),summary=prompt('Human-only refinement summary');if(reason&&summary)call(`/api/governance/versions/${version.versionId}/refinement/complete-human`,{expectedState:'REFINEMENT',reason,summary})}}>Complete Human-Only Refinement</button><small>This review is completed manually and does not use an AI provider.</small></>} {c.canCreateRevision&&publishedVersion&&<button onClick={()=>{const reason=prompt('Revision reason');if(reason)call(`/api/governance/sops/${sopId}/revisions`,{sourceVersionId:publishedVersion.versionId,expectedState:'PUBLISHED',reason})}}>Create Revision</button>}<small>{message}</small></section>;
}

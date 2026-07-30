import { GovernanceError } from '../governance/errors';
export function fields(body,allowed){for(const k of Object.keys(body))if(!allowed.includes(k))throw new GovernanceError('INVALID_INPUT',`Field ${k} is not allowed.`);}
export function expected(body,state,updatedAt){if(body.expectedState!==state||updatedAt&&body.expectedUpdatedAt!==updatedAt.toISOString())throw new GovernanceError('CONCURRENT_MODIFICATION','The record changed.');}

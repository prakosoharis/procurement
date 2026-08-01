import test from 'node:test';import assert from 'node:assert/strict';import {effectiveBusinessUnitIds,scopeWhere} from '../lib/authorization/scope.js';import{capabilities}from'../lib/governance/capabilities.js';
const bu=(id,extra=[])=>({id:'u',role:'BUSINESS_UNIT_PIC',businessUnitId:id,businessUnitScopes:extra.map(businessUnitId=>({businessUnitId}))});
test('primary and explicit scopes are unioned and deduplicated',()=>assert.deepEqual(effectiveBusinessUnitIds(bu('a',['a','b'])),['a','b']));
test('BU with no scope fails closed',()=>assert.deepEqual(scopeWhere(bu(null),'sopDocument'),{id:'__no-business-unit-access__'}));
test('BU capability follows effective scope',()=>{assert.equal(capabilities(bu('a',['b']),{businessUnitId:'b',state:'DRAFT'}).canSubmitDraft,true);assert.equal(capabilities(bu('a'),{businessUnitId:'b',state:'DRAFT'}).canSubmitDraft,false)});
test('executive remains read-only',()=>assert.equal(capabilities({id:'e',role:'EXECUTIVE'},{businessUnitId:'x',state:'DRAFT'}).canSubmitDraft,false));

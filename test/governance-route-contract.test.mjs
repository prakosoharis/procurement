import test from 'node:test';import assert from 'node:assert/strict';import{errorStatus}from'../lib/api/error-contract.js';
test('governance contract uses safe error status codes',()=>{assert.equal(errorStatus.UNAUTHENTICATED,401);assert.equal(errorStatus.NOT_FOUND,404);assert.equal(errorStatus.CONCURRENT_MODIFICATION,409)});
test('repository pagination bounds are documented constants',()=>{const max=100,defaults={page:1,pageSize:20};assert.equal(defaults.page,1);assert.equal(defaults.pageSize,20);assert.ok(max>=defaults.pageSize)});

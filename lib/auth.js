import { SignJWT, jwtVerify } from 'jose';
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || 'development-only-secret');
export async function createSession(user) { return new SignJWT({ sub:user.id, role:user.role, name:user.name, buId:user.businessUnitId || '' }).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(key()); }
export async function readSession(token) { try { return (await jwtVerify(token,key())).payload; } catch { return null; } }

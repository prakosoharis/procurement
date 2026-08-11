import './globals.css';
export const metadata={title:'Procurement Governance Hub',description:'SOP lifecycle governance'};
// Neon runs in AWS ap-southeast-1. Keep App Router work in Singapore too so
// database-bound Route Handlers do not add cross-region latency.
export const preferredRegion='sin1';
export default function RootLayout({children}){return <html lang="id"><body>{children}</body></html>}

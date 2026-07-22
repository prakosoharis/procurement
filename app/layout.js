import './globals.css';
import Link from 'next/link';
export const metadata={title:'Procurement Governance Hub',description:'SOP lifecycle governance'};
const links=[['/','Dashboard'],['/repository','Repository'],['/requests','Requests'],['/validation','Validation'],['/actions','My Actions'],['/references','References'],['/refinement','Refinement']];
export default function RootLayout({children}){return <html lang="id"><body><header className="top"><div className="topin"><Link className="brand" href="/">◈ Procurement Governance Hub</Link><nav className="nav">{links.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav><Link className="user" href="/login">Sign in / role</Link></div></header>{children}</body></html>}

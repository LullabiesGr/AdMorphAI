import type {ReactNode} from "react";
import {Link} from "react-router";

const colors={navy:"#14243d",muted:"#51627b",blue:"#2d63c6"};
export default function LegalPage({title,children}:{title:string,children:ReactNode}){
 return <div style={{fontFamily:"Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",background:"#f7f9fc",color:colors.navy,minHeight:"100vh"}}>
  <header style={{background:"#fff",borderBottom:"1px solid #e5eaf0"}}>
   <div style={{maxWidth:860,margin:"0 auto",padding:"19px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
    <a href="https://afterwin.co" style={{color:colors.navy,textDecoration:"none",fontWeight:800,fontSize:19}}>AfterWin <span style={{fontWeight:500,color:colors.muted}}>/ AdMorph AI</span></a>
    <nav aria-label="Legal pages" style={{display:"flex",gap:15,flexWrap:"wrap",fontSize:13}}>
      <Link to="/privacy" style={{color:colors.blue}}>Privacy</Link>
      <Link to="/terms" style={{color:colors.blue}}>Terms</Link>
      <Link to="/data-deletion" style={{color:colors.blue}}>Data deletion</Link>
    </nav>
   </div>
  </header>
  <main style={{maxWidth:860,margin:"36px auto 55px",padding:"0 18px"}}>
   <article style={{background:"#fff",padding:"clamp(24px,5vw,52px)",border:"1px solid #e5eaf0",borderRadius:16,boxShadow:"0 6px 30px rgba(24,46,87,.045)",lineHeight:1.75}}>
    <p style={{fontSize:12,fontWeight:750,textTransform:"uppercase",letterSpacing:"1.5px",color:colors.blue,margin:"0 0 9px"}}>AdMorph AI · Legal</p>
    <h1 style={{fontSize:"clamp(27px,4vw,37px)",lineHeight:1.15,letterSpacing:"-.7px",margin:"0 0 12px"}}>{title}</h1>
    <p style={{color:colors.muted,fontSize:13,marginBottom:29}}>Effective and last updated: October 31, 2026</p>
    <div style={{fontSize:15,color:"#31405a"}}>{children}</div>
   </article>
  </main>
  <footer style={{padding:"0 24px 32px",textAlign:"center",fontSize:13,color:colors.muted}}>
    AdMorph AI by AfterWin · Contact: <a href="mailto:hello@afterwin.co" style={{color:colors.blue}}>hello@afterwin.co</a>
  </footer>
 </div>;
}

export function Section({title,children}:{title:string,children:ReactNode}){
 return <section style={{margin:"0 0 27px"}}><h2 style={{fontSize:20,color:colors.navy,letterSpacing:"-.2px",margin:"0 0 8px"}}>{title}</h2><div>{children}</div></section>;
}

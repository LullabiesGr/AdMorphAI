import type {ReactNode} from "react";
import {Link} from "react-router";

export function PageIntro({eyebrow,title,description,children}:{eyebrow?:string;title:string;description:string;children?:ReactNode}){
 return <div className="am-page-intro">
    <div><span className="am-eyebrow">{eyebrow||"ADMORPH AI"}</span>
      <h2>{title}</h2><p>{description}</p></div>
    {children&&<div className="am-header-actions">{children}</div>}
  </div>;
}
export function Stat({label,value,note,tone}:{label:string;value:string|number;note?:string;tone?:"success"|"warning"}){
 return <s-section><div className="am-stat">
   <span className="am-kpi-label">{label}</span>
   <strong className="am-kpi-value">{value}</strong>
   {note&&<span className={"am-kpi-note "+(tone?"am-"+tone:"")}>{note}</span>}
 </div></s-section>;
}
export function State({text,kind="neutral"}:{text:string;kind?:"success"|"warning"|"neutral"|"info"}){
 return <span className={"am-pill am-"+kind}><span className="am-status-dot" aria-hidden="true"/>{text}</span>;
}
export function Empty({title,description,href,label}:{title:string;description:string;href?:string;label?:string}){
 return <div className="am-empty"><div className="am-empty-art" aria-hidden="true">✦</div>
   <h3>{title}</h3><p>{description}</p>
   {href&&label&&<Link to={href} className="ad-btn">{label}</Link>}
 </div>;
}
export type Step={id:string;name:string;description:string;done:boolean;href:string};
export function SetupChecklist({steps,compact=false}:{steps:Step[];compact?:boolean}){
 return <div className="am-checklist">
   {steps.map((s,i)=><Link key={s.id} to={s.href} className={"am-check-step "+(s.done?"is-done":"")}>
      <span className="am-check-icon" aria-hidden="true">{s.done?"✓":String(i+1).padStart(2,"0")}</span>
      <span className="am-check-copy"><strong>{s.name}</strong>{!compact&&<small>{s.description}</small>}</span>
      <span className="am-check-state">{s.done?"Complete":"Open"}</span>
    </Link>)}
 </div>;
}
export function SectionHead({title,action}:{title:string;action?:ReactNode}){
 return <div className="am-section-head"><h3>{title}</h3>{action}</div>;
}

import {Form} from "react-router";
import type {Experience} from "../lib/experience";

export function ExperiencePreview({content:c,productImageUrl,productImageAlt}:{content:Experience;productImageUrl?:string;productImageAlt?:string}){
 return <div className={"am-experience-preview am-experience-"+c.layout}>
   <div className="am-experience-hero-row">
   <div className="am-experience-banner">
     <span className="am-experience-eyebrow">{c.hero.eyebrow}</span>
     <h2>{c.hero.headline}</h2>
     <p>{c.hero.subheadline}</p>
     <span className="am-experience-angle">Meta angle: {c.angle}</span>
   </div>
   {productImageUrl?.startsWith("https://")&&<div className="am-experience-product-image">
     <img src={productImageUrl} alt={productImageAlt||"Shopify product image"} loading="lazy"/>
   </div>}
   </div>
   <div className="am-experience-detail">
     <p className="am-experience-eyebrow">The details</p>
     <div className="am-experience-grid">{c.highlights.map((item,i)=><div key={i}>
       <small>{String(i+1).padStart(2,"0")}</small><strong>{item.title}</strong><p>{item.text}</p>
     </div>)}</div>
     <p className="am-experience-eyebrow">Make it yours</p>
     <div className="am-experience-grid">{c.styleMoments.map((item,i)=><div key={i}>
       <small>{item.label}</small><strong>{item.title}</strong><p>{item.text}</p>
     </div>)}</div>
   </div>
   <div className="am-experience-footer">
     <strong>{c.adConnection.title}</strong><p>{c.adConnection.text}</p>
     <span className="am-experience-button">{c.cta.primary}</span>
     {c.cta.secondary&&<small>{c.cta.secondary}</small>}
   </div>
   <p className="am-experience-preview-note">Merchant preview of AI copy. Storefront image uses the real Shopify product featured image. Review all claims before publishing.</p>
 </div>;
}
export function ExperienceEditor({id,content:c}:{id:string;content:Experience}){
 const input=(name:string,label:string,value:string,max:number)=>
   <label key={name}>{label}<input className="ad-input" name={name} defaultValue={value} maxLength={max} required={name!=="ctaSecondary"}/></label>;
 return <Form method="post" className="am-edit-fields">
   <input type="hidden" name="intent" value="save_experience"/>
   <input type="hidden" name="id" value={id}/>
   {input("angle","Ad angle",c.angle,90)}
   <label>Experience layout<select name="layout" defaultValue={c.layout} className="ad-input">
      <option value="editorial">Editorial</option><option value="minimal">Minimal</option><option value="bold">Bold</option>
   </select></label>
   {input("eyebrow","Hero eyebrow",c.hero.eyebrow,52)}
   {input("headline","Hero headline",c.hero.headline,120)}
   <label>Hero subheadline<textarea name="subheadline" className="ad-input" rows={3} defaultValue={c.hero.subheadline} maxLength={225} required/></label>
   {c.highlights.map((h,i)=><div className="am-experience-edit-group" key={"h"+i}>
      <strong>Highlight {i+1}</strong>
      {input("highlight"+i+"Title","Title",h.title,52)}
      {input("highlight"+i+"Text","Text",h.text,160)}
   </div>)}
   {c.styleMoments.map((m,i)=><div className="am-experience-edit-group" key={"m"+i}>
      <strong>Style moment {i+1}</strong>
      {input("moment"+i+"Label","Label",m.label,32)}
      {input("moment"+i+"Title","Title",m.title,64)}
      {input("moment"+i+"Text","Text",m.text,170)}
   </div>)}
   {input("connectionTitle","Ad connection heading",c.adConnection.title,72)}
   {input("connectionText","Ad connection text",c.adConnection.text,220)}
   {input("ctaPrimary","Scroll-to-purchase CTA",c.cta.primary,50)}
   {input("ctaSecondary","Optional note",c.cta.secondary,80)}
   <button className="ad-btn" type="submit">Save experience for approval</button>
 </Form>;
}

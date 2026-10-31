import {Form} from "react-router";
import {resolveVisualDirection,type Experience} from "../lib/experience";

export function ExperiencePreview({content:c,productImageUrl,productImageAlt}:{content:Experience;productImageUrl?:string;productImageAlt?:string}){
 const visual=resolveVisualDirection(c);
 return <div className={"am-experience-preview am-experience-"+c.layout+
    " am-preview-visual-"+visual.composition+" am-preview-palette-"+visual.palette+
    " am-preview-fit-"+visual.imageFit}>
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
   <div className="am-experience-preview-note">
    <strong>AI art direction: {visual.mood}</strong>
    <p>{visual.rationale}</p>
    <small>Layout: {visual.composition} · Palette: {visual.palette} · Image: {visual.imageFit}. Only the original Shopify product photo is used. Changes require approval.</small>
   </div>
 </div>;
}
export function ExperienceEditor({id,content:c}:{id:string;content:Experience}){
 const input=(name:string,label:string,value:string,max:number)=>
   <label key={name}>{label}<input className="ad-input" name={name} defaultValue={value} maxLength={max} required={name!=="ctaSecondary"}/></label>;
 return <Form method="post" className="am-edit-fields">
   <input type="hidden" name="intent" value="save_experience"/>
   <input type="hidden" name="id" value={id}/>
   {input("angle","Ad angle",c.angle,90)}
   <fieldset className="am-visual-controls">
    <legend>AI Visual Studio</legend>
    <p className="ad-muted">Visual art direction changes the storefront layout and palette. It never alters the original Shopify product photo.</p>
    <label>Hero composition<select name="visualComposition" className="ad-input" defaultValue={resolveVisualDirection(c).composition}>
      <option value="split">Split hero</option><option value="spotlight">Image spotlight</option><option value="gallery">Gallery editorial</option>
    </select></label>
    <label>Color palette<select name="visualPalette" className="ad-input" defaultValue={resolveVisualDirection(c).palette}>
      <option value="sand">Warm sand</option><option value="slate">Cool slate</option><option value="rose">Soft rose</option><option value="sage">Sage green</option><option value="midnight">Midnight blue</option>
    </select></label>
    <label>Product photo display<select name="visualImageFit" className="ad-input" defaultValue={resolveVisualDirection(c).imageFit}>
      <option value="cover">Editorial crop</option><option value="contain">Show full product</option>
    </select></label>
    {input("visualMood","Art direction mood",resolveVisualDirection(c).mood,65)}
    {input("visualRationale","Why this matches the Meta creative",resolveVisualDirection(c).rationale,200)}
   </fieldset>
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

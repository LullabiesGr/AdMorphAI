/** Pure, strict ad destination matcher. Never infer a product from ad copy. */
export function productHandleFromAd(creative:unknown,allowedHosts:ReadonlySet<string>):string|null {
 if(!creative || typeof creative!=="object") return null;
 const data=creative as Record<string,any>;
 const spec=data.object_story_spec || {};
 const linkData=spec.link_data || {};
 const videoData=spec.video_data || {};
 const children=Array.isArray(linkData.child_attachments)?linkData.child_attachments:[];
 // Carousels that point to multiple products are ambiguous and need manual mapping.
 if(children.length>1)return null;
 const urls=[
    linkData.link, videoData.call_to_action?.value?.link,
    children.length===1 ? children[0]?.link : null,
    data.link_url,
 ];
 const matches=new Set<string>();
 for(const value of urls) {
   if(typeof value!=="string"||value.length>2000)continue;
   try{
     const u=new URL(value);
     if(u.protocol!=="https:" || !allowedHosts.has(u.hostname.toLowerCase()))continue;
     const m=u.pathname.match(/^\/products\/([a-z0-9][a-z0-9-]{0,249})\/?$/i);
     if(m)matches.add(m[1].toLowerCase());
   }catch { /* invalid destination is not a match */ }
 }
 return matches.size===1 ? [...matches][0] : null;
}

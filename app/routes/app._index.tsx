import type { LoaderFunctionArgs } from "react-router";
import { Link,useLoaderData } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
export const loader=async({request}:LoaderFunctionArgs)=>{
 const {session}=await authenticate.admin(request);
 await prisma.shop.upsert({where:{domain:session.shop},create:{domain:session.shop},update:{}});
 const [meta,ads,total,published]=await Promise.all([
  prisma.metaConnection.findUnique({where:{shop:session.shop},select:{connectedAt:true,selectedAccountId:true}}),
  prisma.metaAd.count({where:{shop:session.shop}}),
  prisma.campaign.count({where:{shop:session.shop}}),
  prisma.campaign.count({where:{shop:session.shop,status:"PUBLISHED"}})
 ]);
 return {shop:session.shop,meta:Boolean(meta),selected:Boolean(meta?.selectedAccountId),ads,total,published};
};
export default function Dashboard(){
 const d=useLoaderData<typeof loader>();
 return <s-page heading="AdMorph AI">
  <div className="ad-hero">
   <div className="ad-chip">AI-POWERED CAMPAIGN PERSONALIZATION</div>
   <h1>Every ad deserves the right product page.</h1>
   <p>Turn Meta ad creatives into consistent, conversion-focused product messaging. Your merchant approval stays in control.</p>
   <Link to={d.meta?"/app/campaigns":"/app/meta"} className="ad-btn" style={{background:"#fff",color:"#17263f",textDecoration:"none",display:"inline-block"}}>{d.meta?"Create AI campaign":"Connect Meta Ads"}</Link>
  </div>
  <div className="ad-grid">
    <div className="ad-card"><div className="ad-muted">Meta connection</div><div className="ad-stat" style={{fontSize:21}}>{d.meta?"Connected":"Not connected"}</div><div className="ad-muted">{d.selected?"Ad account selected":"Select an authorized advertising account"}</div></div>
    <div className="ad-card"><div className="ad-muted">Imported Meta ads</div><div className="ad-stat">{d.ads}</div><div className="ad-muted">Available to match with Shopify products</div></div>
    <div className="ad-card"><div className="ad-muted">Published experiences</div><div className="ad-stat">{d.published}<span style={{fontSize:16,color:"#8993a3"}}> / {d.total}</span></div><div className="ad-muted">AI content approved by your team</div></div>
  </div>
  <s-section heading="Get your first personalized page live">
   <ol style={{lineHeight:"2.1",fontSize:14}}>
    <li><Link to="/app/meta">Connect Meta</Link> with ads_read access and import ads.</li>
    <li><Link to="/app/campaigns">Pair each Meta ad</Link> with an active Shopify product.</li>
    <li>Generate with OpenAI, review factual claims and publish.</li>
    <li>Add the AdMorph block from your Shopify Theme Editor.</li>
    <li>Include <code>admorph_ad=&#123;&#123;ad.id&#125;&#125;</code> in Meta URL parameters to match clicks.</li>
   </ol>
  </s-section>
  <s-section heading="Storefront safety">
   <s-paragraph>The app never modifies product prices, inventory, checkout, canonical URLs, or the Meta Pixel. Without a matching published campaign the original product page remains unchanged.</s-paragraph>
  </s-section>
 </s-page>;
}

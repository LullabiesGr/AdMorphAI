import prisma from "../db.server";

export async function getMerchantOverview(shop:string){
 const [meta,ads,drafts,published,total,settings,recent]=await Promise.all([
   prisma.metaConnection.findUnique({where:{shop},select:{connectedAt:true,selectedAccountId:true,accounts:true}}),
   prisma.metaAd.count({where:{shop}}),
   prisma.campaign.count({where:{shop,status:"DRAFT"}}),
   prisma.campaign.count({where:{shop,status:"PUBLISHED"}}),
   prisma.campaign.count({where:{shop}}),
   prisma.automationSetting.findUnique({where:{shop},select:{
      autoPublish:true,lastSyncAt:true,themeConfirmedAt:true
   }}),
   prisma.campaign.findMany({where:{shop},take:5,orderBy:{updatedAt:"desc"},select:{
      id:true,productTitle:true,status:true,metaAdId:true,updatedAt:true,content:true
   }})
 ]);
 const configured=Boolean(meta?.selectedAccountId);
 const steps=[
   {id:"meta",name:"Connect Meta Ads",done:Boolean(meta),href:"/app/meta",description:"Authorize access to your advertising account"},
   {id:"account",name:"Select an ad account",done:configured,href:"/app/meta",description:"Choose which ads AdMorph will import"},
   {id:"import",name:"Import ads and generate copy",done:total>0,href:"/app/autopilot",description:"Run Autopilot or create your first AI draft"},
   {id:"theme",name:"Activate the theme block",done:Boolean(settings?.themeConfirmedAt),href:"/app/theme",description:"Add the AdMorph block and confirm after saving"},
   {id:"publish",name:"Publish your first campaign",done:published>0,href:"/app/campaigns",description:"Review and publish a personalized experience"}
 ];
 return {meta,ads,drafts,published,total,settings,recent,
   steps,completed:steps.filter(s=>s.done).length,allSteps:steps.length
 };
}

/** Prefer a dedicated apps section for custom themes whose product section may not support @app. */
export function themeEditorUrl(shop:string,placement:"newAppsSection"|"mainSection"="newAppsSection"){
 const clientId=process.env.SHOPIFY_API_KEY||"";
 const editor=new URL("https://"+shop+"/admin/themes/current/editor");
 editor.searchParams.set("template","product");
 editor.searchParams.set("addAppBlockId",clientId+"/admorph-product");
 editor.searchParams.set("target",placement);
 return editor.toString();
}

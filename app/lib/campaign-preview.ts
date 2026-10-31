/** Shared campaign preview and imported-ad coverage rules. No database access. */
export function selectPreviewContent<T>(campaign:{content:T|null|undefined;draftContent:T|null|undefined}):T|null {
 return campaign.draftContent ?? campaign.content ?? null;
}
export function groupByImportedAd<A extends {id:string},C extends {metaAdId:string}>(ads:A[],campaigns:C[]){
 return ads.map(ad=>({...ad,linked:campaigns.filter(c=>c.metaAdId===ad.id)}));
}

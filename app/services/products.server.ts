export type ShopifyAdmin={graphql:(query:string,options?:any)=>Promise<Response>};
export async function listProducts(admin:ShopifyAdmin) {
 const res=await admin.graphql(`#graphql
 query AdMorphProducts {
   products(first: 40,query:"status:active") {
     nodes { id title handle description status featuredImage { url altText } }
   }
 }`);
 const json=await res.json();
 if(json.errors) throw new Error("Shopify product query failed");
 return json.data.products.nodes as Array<{id:string,title:string,handle:string,description:string,featuredImage:{url:string}|null}>;
}
export async function getProduct(admin:ShopifyAdmin,id:string) {
 if(!/^gid:\/\/shopify\/Product\/[0-9]+$/.test(id)) throw new Error("Invalid Shopify product ID");
 const res=await admin.graphql(`#graphql
 query AdMorphProduct($id:ID!) { product(id:$id) {
   id title handle description status featuredImage { url altText }
 } }`,{variables:{id}});
 const json=await res.json();
 if(json.errors||!json.data?.product) throw new Error("Product unavailable");
 if(json.data.product.status!=="ACTIVE") throw new Error("Product is not active");
 return json.data.product as {id:string,title:string,handle:string,description:string,featuredImage:{url:string}|null};
}

/** Exact, verified product handle lookup. Never guess which product an ad promotes. */
export async function getActiveProductByHandle(admin:ShopifyAdmin,handle:string) {
 if(!/^[a-z0-9][a-z0-9-]{0,249}$/.test(handle))return null;
 const result=await admin.graphql(`#graphql
 query FindAdMorphProduct($query:String!) {
   products(first:3,query:$query) {
     nodes {id title handle description status}
   }
 }`,{variables:{query:"handle:"+handle}});
 const data=await result.json();
 if(data.errors)throw new Error("Shopify product matching failed");
 const products=(data.data?.products?.nodes||[]) as Array<{id:string,title:string,handle:string,description:string,status:string}>;
 return products.find(p=>p.handle===handle && p.status==="ACTIVE")||null;
}

export async function getShopStorefrontDomains(admin:ShopifyAdmin,shopDomain:string) {
 const r=await admin.graphql(`#graphql
 query AdMorphShopHost { shop { myshopifyDomain primaryDomain { host } } }`);
 const data=await r.json();
 if(data.errors)throw new Error("Unable to verify Shopify store domain");
 const domain=data.data?.shop;
 return new Set([shopDomain,domain?.myshopifyDomain,domain?.primaryDomain?.host].filter((s):s is string=>typeof s==="string" && s.length>0).map(s=>s.toLowerCase()));
}

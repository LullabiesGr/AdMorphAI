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

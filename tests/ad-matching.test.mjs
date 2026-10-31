import test from 'node:test';
import assert from 'node:assert/strict';
import {productHandleFromAd} from '../app/lib/ad-matching.ts';
const hosts=new Set(['example.myshopify.com','store.example.com']);
const creative=url=>({object_story_spec:{link_data:{link:url}}});

test('matches exact product URL on authorized shop only',()=>{
 assert.equal(productHandleFromAd(creative('https://store.example.com/products/rose-cream?utm_source=facebook'),hosts),'rose-cream');
 assert.equal(productHandleFromAd(creative('https://example.myshopify.com/products/abc-123'),hosts),'abc-123');
});
test('rejects external store, homepage and redirect URLs',()=>{
 assert.equal(productHandleFromAd(creative('https://untrusted.example.com/products/rose-cream'),hosts),null);
 assert.equal(productHandleFromAd(creative('https://store.example.com/collections/rose-cream'),hosts),null);
 assert.equal(productHandleFromAd(creative('https://short.example/r?to=https://store.example.com/products/rose-cream'),hosts),null);
});
test('rejects ambiguous carousels with more than one destination',()=>{
 const ad={object_story_spec:{link_data:{link:'https://store.example.com/products/one',child_attachments:[
 {link:'https://store.example.com/products/one'},
 {link:'https://store.example.com/products/two'}]}}};
 assert.equal(productHandleFromAd(ad,hosts),null);
});
test('rejects links with invalid protocols or invalid creative data',()=>{
 assert.equal(productHandleFromAd(creative('http://store.example.com/products/one'),hosts),null);
 assert.equal(productHandleFromAd(creative('javascript:alert(1)'),hosts),null);
 assert.equal(productHandleFromAd(null,hosts),null);
});
test('matches single product video destinations',()=>{
 const ad={object_story_spec:{video_data:{call_to_action:{value:{link:'https://store.example.com/products/runner'}}}}};
 assert.equal(productHandleFromAd(ad,hosts),'runner');
});

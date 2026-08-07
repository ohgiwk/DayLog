import type { DiaryImage } from '../types'
const DB='daylog-images', STORE='images'
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
export const imageRepository={
 async put(image:DiaryImage){const db=await open();return new Promise<void>((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(image);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})},
 async get(id:string){const db=await open();return new Promise<DiaryImage|undefined>((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
 async delete(id:string){const db=await open();return new Promise<void>((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})},
}
export async function compressImage(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);const max=1400;const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('画像を処理できませんでした')),'image/webp',.82))
}

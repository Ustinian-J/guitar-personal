import { createState,validateState } from './model.js';
export function openStore(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open('xianxu-personal',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('state');
  request.onerror=()=>reject(Error('无法打开本机存储，请关闭隐私浏览或检查浏览器存储权限。'));
  request.onblocked=()=>reject(Error('另一个页面占用了旧版本存储，请关闭其他弦序页面后重试。'));
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve({
    async read(){return new Promise((res,rej)=>{const tx=db.transaction('state','readonly'),get=tx.objectStore('state').get('current');get.onsuccess=()=>{try{res(get.result?validateState(get.result):createState());}catch(e){rej(Error('本机记录无法读取，请保留页面并使用已有备份恢复。'+e.message));}};get.onerror=()=>rej(get.error);});},
    async write(state){const checked=validateState(state);return new Promise((res,rej)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(checked,'current');tx.oncomplete=()=>res();tx.onerror=()=>rej(Error('保存失败：本机存储不可用或空间不足，请先导出备份。'));tx.onabort=()=>rej(Error('保存中断，请重试。'));});},
    close(){db.close();}
  });};
});}

export const SCHEMA=1;
export const createState=()=>({schema:SCHEMA,updatedAt:0,settings:{dailyMinutes:25,tutorial:'guomu-intro'},position:{part:1,time:'00:00',note:''},favorites:[],progress:{},sessions:[]});
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(v,max=1000)=>typeof v==='string'&&v.length<=max;
const lesson=id=>typeof id==='string'&&/^L(0[1-9]|[1-5][0-9]|60)$/.test(id);
export function validateState(s){
  if(!object(s)||s.schema!==SCHEMA||!Number.isFinite(s.updatedAt)||!object(s.settings)||![10,15,25,40].includes(s.settings.dailyMinutes)||!['guomu-intro','guomu-next'].includes(s.settings.tutorial))throw Error('备份版本或学习设置无效');
  if(!object(s.position)||!Number.isInteger(s.position.part)||s.position.part<1||s.position.part>(s.settings.tutorial==='guomu-intro'?52:34)||!text(s.position.time,12)||!/^\d{1,3}:[0-5]\d$/.test(s.position.time)||!text(s.position.note))throw Error('备份中的继续学习位置无效');
  if(!Array.isArray(s.favorites)||s.favorites.length>60||!s.favorites.every(lesson)||new Set(s.favorites).size!==s.favorites.length)throw Error('收藏数据无效');
  if(!object(s.progress)||Object.keys(s.progress).length>60)throw Error('技能状态无效');
  for(const [id,p] of Object.entries(s.progress))if(!lesson(id)||!object(p)||typeof p.watched!=='boolean'||typeof p.practiced!=='boolean'||!['new','learning','review','confident'].includes(p.skill)||!text(p.note)||!Number.isFinite(p.reviewAt)||!Number.isFinite(p.updatedAt)||(p.skill==='confident'&&!p.practiced))throw Error('技能记录无效');
  if(!Array.isArray(s.sessions)||s.sessions.length>10000)throw Error('练习记录数量无效（最多 10000 条）');
  const ids=new Set();for(const r of s.sessions){if(!object(r)||!text(r.id,100)||!r.id||ids.has(r.id)||!lesson(r.lessonId)||!Number.isInteger(r.minutes)||r.minutes<1||r.minutes>240||!Number.isInteger(r.bpm)||r.bpm<0||r.bpm>240||!['steady','hesitation','noise','retry'].includes(r.feedback)||!text(r.note)||!Number.isFinite(r.finishedAt)||r.finishedAt<=0)throw Error('练习明细无效');ids.add(r.id);}
  // Normalize to the known shape. Imported extra keys never become executable settings.
  return {schema:SCHEMA,updatedAt:s.updatedAt,settings:{dailyMinutes:s.settings.dailyMinutes,tutorial:s.settings.tutorial},position:{part:s.position.part,time:s.position.time,note:s.position.note},favorites:[...s.favorites],progress:Object.fromEntries(Object.entries(s.progress).map(([id,p])=>[id,{watched:p.watched,practiced:p.practiced,skill:p.skill,note:p.note,reviewAt:p.reviewAt,updatedAt:p.updatedAt}])),sessions:s.sessions.map(r=>({id:r.id,lessonId:r.lessonId,minutes:r.minutes,bpm:r.bpm,feedback:r.feedback,note:r.note,finishedAt:r.finishedAt}))};
}
export function parseBackup(raw){if(raw.length>50*1024*1024)throw Error('备份文件超过 50 MB');let data;try{data=JSON.parse(raw);}catch{throw Error('不是有效的 JSON 备份');}if(!object(data)||data.app!=='xianxu-personal'||data.version!==SCHEMA)throw Error('不是弦序个人版支持的备份');return validateState(data.state);}
export const backup=s=>JSON.stringify({app:'xianxu-personal',version:SCHEMA,exportedAt:new Date().toISOString(),state:validateState(s)},null,2);
export const progressFor=(s,id)=>s.progress[id]||{watched:false,practiced:false,skill:'new',note:'',reviewAt:0,updatedAt:0};
export function updateProgress(s,id,patch,now=Date.now()){
  if(!lesson(id))throw Error('技能编号无效');const next=structuredClone(s),p={...progressFor(s,id),...patch,updatedAt:now};
  if(p.skill==='confident'&&!p.practiced)throw Error('先记录实际练习，再自评稳定');
  if(patch.skill)p.reviewAt=now+(patch.skill==='review'?1:3)*86400000;
  next.progress[id]=p;next.updatedAt=now;return validateState(next);
}
export function addSession(s,r){
  if(s.sessions.some(x=>x.id===r.id))return s;
  if(s.sessions.length>=10000)throw Error('已达记录上限，请导出备份后再整理记录');
  let next=structuredClone(s);next.sessions.unshift(r);next.updatedAt=r.finishedAt;
  const old=progressFor(next,r.lessonId);next.progress[r.lessonId]={...old,practiced:true,skill:r.feedback==='steady'?(old.skill==='confident'?'confident':'learning'):'review',reviewAt:r.finishedAt+(r.feedback==='steady'?3:1)*86400000,updatedAt:r.finishedAt};return validateState(next);
}
export function toggleFavorite(s,id){const next=structuredClone(s);next.favorites=next.favorites.includes(id)?next.favorites.filter(x=>x!==id):[...next.favorites,id];next.updatedAt=Date.now();return validateState(next);}
export const dayKey=t=>{const d=new Date(t);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
export function stats(s,now=Date.now()){return {today:s.sessions.filter(r=>dayKey(r.finishedAt)===dayKey(now)).reduce((n,r)=>n+r.minutes,0),total:s.sessions.reduce((n,r)=>n+r.minutes,0),days:new Set(s.sessions.map(r=>dayKey(r.finishedAt))).size,confident:Object.values(s.progress).filter(p=>p.skill==='confident').length};}
export function recommendations(s,lessons,now=Date.now()){
  const list=lessons.filter(l=>s.progress[l.id]?.skill==='review').sort((a,b)=>s.progress[b.id].updatedAt-s.progress[a.id].updatedAt).map(l=>({lesson:l,reason:'上次有一个难点，今天先慢练。',kind:'复练'}));
  for(const l of lessons.filter(l=>s.progress[l.id]?.reviewAt>0&&s.progress[l.id].reviewAt<=now))if(!list.some(x=>x.lesson.id===l.id))list.push({lesson:l,reason:'到了你安排的复习时间。',kind:'复习'});
  if(!list.length){const l=lessons.find(l=>progressFor(s,l.id).skill!=='confident')||lessons[0];if(l)list.push({lesson:l,reason:'技能卡用来查漏补缺；视频仍按主教程课序看。',kind:'技能卡'});}
  return list.slice(0,3);
}
export function tutorialUrl(tutorial,position){const url=new URL(tutorial.url);url.searchParams.set('p',String(position.part));const [m,s]=position.time.split(':').map(Number);url.searchParams.set('t',String(m*60+s));return url.href;}

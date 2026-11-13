// Reads and edits go through a Cloudflare relay (relay/worker.js) because the Apps Script store often doesn't answer.
const STORE='https://team-availability-relay.devintorres28.workers.dev/';
const K=new URLSearchParams(location.search).get('k')||'';
const TZ='America/Los_Angeles',SLOT=30*60e3,H0=9,H1=23;
// Five clearly different steps: nobody (gray) -> everyone (dark green)
const PAL=['#eceff3','#d1fadf','#86e0a6','#2fb463','#0f6b35'];
const MINE_FREE='#2fb463',MINE_BUSY='#eceff3';
let S=null,week=0,me=null,editing=false,drag=null,pending=0,sel=null;
const app=document.getElementById('app'),tip=document.getElementById('tip');
const fmt=(ms,o)=>new Intl.DateTimeFormat('en-US',Object.assign({timeZone:TZ},o)).format(new Date(ms));
const tm=ms=>fmt(ms,{hour:'numeric',minute:'2-digit'}).replace(' ','').replace(':00','').toLowerCase();
const shade=(k,n)=>PAL[k<=0?0:k>=n?4:Math.max(1,Math.min(3,Math.round(k/n*4)))];
function laMidnight(ymd){const g=new Date(ymd+'T12:00:00Z');const off=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'longOffset'}).format(g).match(/GMT([+-]\d\d):?(\d\d)?/);if(!off)return Date.parse(ymd+'T00:00:00Z');const sign=off[1][0]==='-'?-1:1;const mins=sign*(Math.abs(+off[1])*60+(+(off[2]||0)));return Date.parse(ymd+'T00:00:00Z')-mins*60e3}
function ymd(ms){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(ms))}
function days(){const out=[];const t0=laMidnight(ymd(Date.now()));const dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(fmt(t0,{weekday:'short'}));
 const toSun=(7-dow)%7;let start,n;if(week===0){start=t0;n=toSun+1}else{start=laMidnight(ymd(t0+(toSun+1)*86400e3+3600e3));n=7}
 for(let i=0;i<n;i++)out.push(laMidnight(ymd(start+i*86400e3+3600e3)));return out}
const slotsOf=d=>{const a=[];for(let i=0;i<(H1-H0)*2;i++)a.push(d+(H0*60+i*30)*60e3);return a};
function calFree(p,s){const b=(S.busy&&S.busy.busy[p])||[];for(const [a,z] of b)if(a<s+SLOT&&z>s)return false;return true}
function isFree(p,s){const m=(S.marks[p]||{})[s];if(m==='f')return true;if(m==='b')return false;return calFree(p,s)}
// Upcoming blocks of at least 1 hour where everyone (or, failing that, all but one) is free
function bestTimes(ds,ppl){const now=Date.now();
 const find=need=>{const out=[];ds.forEach(d=>{let st=null,run=[];slotsOf(d).concat([null]).forEach(s=>{const ok=s!==null&&s>=now-SLOT/2&&ppl.filter(p=>isFree(p,s)).length>=need;
  if(ok){if(st===null)st=s;run.push(s)}else if(st!==null){if(run.length>=2)out.push([st,run[run.length-1]+SLOT]);st=null;run=[]}})});return out};
 const r=find(ppl.length);if(r.length||ppl.length<3)return{all:true,r};return{all:false,r:find(ppl.length-1)}}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const andList=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' & '+a[a.length-1];
function group(){const g=S.people.filter(p=>sel.has(p));return g.length?g:S.people.slice()}
function render(){
 if(!S)return;
 if(!sel)sel=new Set(S.people);
 const all=S.people,ppl=group(),n=ppl.length,ds=days(),rows=(H1-H0)*2,now=Date.now(),todayK=ymd(now);
 if(me&&!all.includes(me)){me=null;editing=false}
 let html='<div class="bar"><span class="tabs"><button data-w="0" class="'+(week===0?'on':'')+'">This week</button> <button data-w="1" class="'+(week===1?'on':'')+'">Next week</button></span>';
 if(!editing){html+='<span class="who">'+all.map(p=>'<span class="pc'+(sel.has(p)?' on':'')+'"><button class="nm" data-p="'+esc(p)+'" title="Show or hide '+esc(p)+'">'+esc(p)+'</button><button class="pen" data-e="'+esc(p)+'" title="Edit '+esc(p)+'\'s times">✎</button></span>').join('')+
  (sel.size<all.length?'<button class="lnk" id="allp">Show everyone</button>':'')+'</span>'}
 else html+='<span class="edit"><b>Editing '+esc(me)+'\'s times</b><button id="rs">Reset to calendar</button><button class="go" id="dn">Done</button></span>';
 html+='</div>';
 if(editing)html+='<div class="best"><span><b>Click or drag</b> to flip a time between <b style="color:#15803d">free</b> and <b>busy</b>. It saves for everyone right away.</span></div>';
 else{const b=bestTimes(ds,ppl);const lim=b.r.slice(0,5);const who=n===all.length?'Everyone':andList(ppl);
  const lab=b.all?(lim.length?who+(n===1?' is':'')+' free:':'No hour this week when '+who+(n===1?' is':' are all')+' free'):(lim.length?'No time with all '+n+'. '+(n-1)+' of '+n+' free:':'No hour this week with '+(n-1)+'+ free');
  html+='<div class="best"><b>'+lab+'</b>'+lim.map(([a,z])=>'<span class="chip'+(b.all?'':' p')+'">'+fmt(a,{weekday:'short'})+' '+tm(a)+'–'+tm(z)+'</span>').join('')+(b.r.length>lim.length?'<span class="muted">+'+(b.r.length-lim.length)+' more</span>':'')+'</div>'}
 html+='<div class="grid" id="g" style="grid-template-columns:96px repeat('+rows+',1fr);grid-template-rows:20px repeat('+ds.length+',minmax(18px,1fr))"><div></div>';
 for(let i=0;i<rows;i+=2)html+='<div class="th" style="grid-column:span 2">'+tm(ds[0]+(H0*60+i*30)*60e3)+'</div>';
 ds.forEach(d=>{html+='<div class="dl'+(ymd(d)===todayK?' today':'')+'"><b>'+(ymd(d)===todayK?'Today':fmt(d,{weekday:'short'}))+'</b><span>'+fmt(d,{month:'short',day:'numeric'})+'</span></div>';
  slotsOf(d).forEach((s,i)=>{let bg,hand=false;
   if(editing){bg=isFree(me,s)?MINE_FREE:MINE_BUSY;hand=!!(S.marks[me]||{})[s]}else bg=shade(ppl.filter(p=>isFree(p,s)).length,n);
   html+='<div class="c'+(i%2==0?' h':'')+(s+SLOT<now?' past':'')+(hand?' hand':'')+'" data-s="'+s+'" style="background:'+bg+'"></div>'})});
 html+='</div><div class="foot">';
 if(editing)html+='<span class="sw"><i style="background:'+MINE_FREE+'"></i>Free</span><span class="sw"><i style="background:'+MINE_BUSY+'"></i>Busy</span><span>· Dot = changed by hand. Everything else comes from '+esc(me)+'\'s Google Calendar.</span>';
 else{const steps=n===1?[[0,'Busy'],[1,'Free']]:[[0,'Nobody']].concat(Array.from({length:n-1},(_,k)=>[k+1,(k+1)+' free']),[[n,n===2?'Both':'All '+n]]);
  html+=steps.map(([k,l])=>'<span class="sw"><i style="background:'+shade(k,n)+'"></i>'+l+'</span>').join('')+'<span>· Hover for names · From Google Calendars'+(S.busy?', updated '+tm(S.busy.updated):'')+'</span>'}
 html+='</div>';
 app.innerHTML=html;
 app.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{week=+b.dataset.w;render()});
 app.querySelectorAll('.nm').forEach(b=>b.onclick=()=>{const p=b.dataset.p;if(sel.has(p))sel.delete(p);else sel.add(p);if(!sel.size)sel=new Set(all);render()});
 app.querySelectorAll('.pen').forEach(b=>b.onclick=()=>{me=b.dataset.e;editing=true;render()});
 const q=id=>document.getElementById(id);
 if(q('allp'))q('allp').onclick=()=>{sel=new Set(all);render()};
 if(q('dn'))q('dn').onclick=()=>{editing=false;render()};
 if(q('rs'))q('rs').onclick=()=>{const mine=S.marks[me]||{};const ws=ds.flatMap(slotsOf).filter(s=>mine[s]);if(!ws.length)return;ws.forEach(s=>delete mine[s]);render();save(ws,null)};
 const g=q('g');
 g.onpointermove=e=>{const c=document.elementFromPoint(e.clientX,e.clientY);const cell=c&&c.closest&&c.closest('.c');if(!cell){tip.style.display='none';return}const s=+cell.dataset.s;
  if(drag&&!drag.set.has(s)){drag.set.add(s);setMine(s,drag.v);cell.style.background=drag.v==='f'?MINE_FREE:MINE_BUSY;cell.classList.add('hand')}
  showTip(e,s)};
 g.onpointerleave=()=>{tip.style.display='none'};
 g.onpointerdown=e=>{const cell=e.target.closest('.c');if(!cell)return;e.preventDefault();
  if(!editing){showTip(e,+cell.dataset.s);return}
  const s=+cell.dataset.s;const v=isFree(me,s)?'b':'f';drag={set:new Set([s]),v};setMine(s,v);cell.style.background=v==='f'?MINE_FREE:MINE_BUSY;cell.classList.add('hand')};
}
function showTip(e,s){const ppl=group();const free=ppl.filter(p=>isFree(p,s)),no=ppl.filter(p=>!free.includes(p));
 let h='<div class="t">'+fmt(s,{weekday:'short',month:'short',day:'numeric'})+', '+tm(s)+'–'+tm(s+SLOT)+'</div>';
 if(editing){const m=(S.marks[me]||{})[s];h+=esc(me)+': '+(isFree(me,s)?'free':'busy')+'<div class="no">'+(m?'Changed by hand':'From calendar')+'</div>'}
 else h+=(ppl.length>1&&free.length===ppl.length?(ppl.length===S.people.length?'Everyone is free':'All free: '+free.map(esc).join(', ')):free.length?'Free: '+free.map(esc).join(', '):'<span class="no">Nobody is free</span>')+(no.length&&free.length?'<div class="no">Busy: '+no.map(esc).join(', ')+'</div>':'');
 tip.innerHTML=h;tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-6)+'px';tip.style.top=Math.min(e.clientY+14,innerHeight-tip.offsetHeight-6)+'px'}
// A mark equal to what the calendar already says is dropped, so the calendar stays in charge
function setMine(s,v){S.marks[me]=S.marks[me]||{};if((v==='f')===calFree(me,s))delete S.marks[me][s];else S.marks[me][s]=v}
// The store sometimes never answers, so every request gives up after a few seconds and tries again.
function req(url,opt,ms){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms||6000);return fetch(url,Object.assign({signal:c.signal},opt)).then(r=>r.json()).finally(()=>clearTimeout(t))}
function retry(f,n){return f().catch(e=>n>1?retry(f,n-1):Promise.reject(e))}
function save(slots,v){pending++;retry(()=>req(STORE,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({k:K,action:'mark',person:me,slots,value:v})},8000),3).then(d=>{pending--;if(d.marks&&!pending&&!drag){S.marks=d.marks;render()}}).catch(()=>{pending--})}
document.addEventListener('pointerup',()=>{if(!drag)return;const d=drag;drag=null;const sl=[...d.set];
 const keep=sl.filter(s=>(S.marks[me]||{})[s]),clear=sl.filter(s=>!(S.marks[me]||{})[s]);render();
 if(keep.length)save(keep,d.v);if(clear.length)save(clear,null)});
const CK='avail:'+K;
function load(){if(drag||pending)return;retry(()=>req(STORE+'?k='+encodeURIComponent(K)),4).then(d=>{if(d.error){app.innerHTML='<div class="msg">This view needs its access key in the link.</div>';return}S=d;S.marks=S.marks||{};try{localStorage.setItem(CK,JSON.stringify(d))}catch(e){}if(!drag&&!pending)render()}).catch(e=>{if(!S)app.innerHTML='<div class="msg">Couldn\'t load availability. Try refreshing. <span style="opacity:.5">('+esc((e&&e.name)||'')+': '+esc((e&&e.message)||'')+')</span></div>'})}
try{const c=JSON.parse(localStorage.getItem(CK)||'null');if(c&&c.busy){S=c;S.marks=S.marks||{};render()}}catch(e){}
addEventListener('resize',()=>{if(!drag)render()});load();setInterval(load,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});

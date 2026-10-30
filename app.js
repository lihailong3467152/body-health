(() => {
'use strict';
const LOCAL='body-awareness.local.v1',CONFIG='body-awareness.config.v1',CACHE='body-awareness.cloud.v1.',GUEST_SYNC='body-awareness.guest-sync.v4.';
const SITE=window.BODY_AWARENESS_CONFIG||{};
const REQUIRE_LOGIN=false; // V4：始终允许游客记录，即使旧 config.js 仍保留 requireLogin:true
let authTab='login';
const MANAGED=Boolean(SITE.supabaseUrl&&SITE.supabasePublishableKey&&!SITE.supabaseUrl.includes('YOUR-PROJECT')&&!SITE.supabasePublishableKey.includes('REPLACE_WITH'));
const REGION=['头部','肩颈','胸部','腹部','腰背','手臂','腿部','其他'];
const ENERGIES=['充沛','一般','疲惫','极度疲惫'];
const COLORS=['#7ec1c0','#75acd3','#e3bc88','#c996a8'];
const PAGES={record:'开始记录',history:'历史回看',trends:'趋势洞察',settings:'设置与同步'};
const $=q=>document.querySelector(q),$$=q=>[...document.querySelectorAll(q)];
const s={view:'record',mode:'local',records:[],regions:new Set(),edit:null,client:null,sub:null,user:null,queue:[],busy:false,error:'',configured:false,toastTimer:null,guestPromptedUser:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function read(key,fallback){try{const x=localStorage.getItem(key);return x?JSON.parse(x):fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('无法保存到浏览器，请检查存储空间或无痕模式。',true);return false}}
function uid(){return globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{let n=Math.random()*16|0;return(c==='x'?n:n&3|8).toString(16)})}
function localDate(d){d=new Date(d);if(!Number.isFinite(+d))return '';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
const day=x=>localDate(x).slice(0,10);
const displayDate=x=>new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(x));
const displayTime=x=>new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x));
function normal(r){
 if(!r||typeof r!=='object'||!r.id||!Number.isFinite(+new Date(r.recordedAt)))return null;
 const txt=(k,n=100)=>String(r[k]||'').slice(0,n);
 return {id:txt('id'),recordedAt:new Date(r.recordedAt).toISOString(),weather:txt('weather'),location:txt('location'),sleep:txt('sleep'),diet:txt('diet'),water:txt('water'),energy:ENERGIES.includes(r.energy)?r.energy:'一般',regions:Array.isArray(r.regions)?[...new Set(r.regions.filter(v=>REGION.includes(v)))]:[],sensations:txt('sensations',5000),tension:Math.max(1,Math.min(10,Number(r.tension)||5)),breath1:txt('breath1',2000),breath2:txt('breath2',2000),breath3:txt('breath3',2000),updatedAt:txt('updatedAt')||new Date().toISOString()};
}
function readLocal(){const x=read(LOCAL,[]);return Array.isArray(x)?x.map(normal).filter(Boolean):[]}
function cacheKey(){return CACHE+s.user.id}
function persist(){return s.mode==='cloud'?write(cacheKey(),{records:s.records,queue:s.queue}):write(LOCAL,s.records)}
function sorted(){s.records.sort((a,b)=>new Date(b.recordedAt)-new Date(a.recordedAt))}
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(s.toastTimer);s.toastTimer=setTimeout(()=>el.classList.remove('show'),3800)}
function indicator(){const pending=s.mode==='cloud'&&s.queue.length;const err=s.mode==='cloud'&&s.error;const message=s.mode==='local'?'游客 · 本机已保存':pending?`${s.queue.length} 条待同步`:err?'云端连接异常':'云端已同步';$('#save-indicator').innerHTML=`<span class="status-dot ${pending?'pending':err?'error':''}"></span> ${esc(message)}`}
function navigate(view){if(!PAGES[view])return;s.view=view;$$('.page').forEach(el=>el.classList.toggle('active',el.id==='page-'+view));$$('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));$('#header-page-name').textContent=PAGES[view];if(view==='history')history();if(view==='trends')trends();if(view==='settings')settings();window.scrollTo(0,0)}
function updateRegions(){$$('[data-region]').forEach(el=>{const active=s.regions.has(el.dataset.region);el.classList.toggle('selected',active);if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(active))})}
function toggleRegion(region){if(!REGION.includes(region))return;s.regions.has(region)?s.regions.delete(region):s.regions.add(region);updateRegions()}
function resetForm(){const f=$('#entry-form');f.reset();s.regions.clear();s.edit=null;$('#recorded-at').value=localDate(new Date());$('#tension').value=5;$('#tension-value').textContent='5';updateRegions();$('#form-heading').textContent='今天，身体感觉如何？';$('#save-entry').innerHTML='保存这次记录 <span aria-hidden="true">→</span>';$('#form-note').textContent='每一次记录，都是一次温柔的自我照看。'}
const val=name=>{const x=$('#entry-form').elements.namedItem(name);return String(x?.value??'').trim()};
function buildEntry(){const recordedAt=val('recordedAt');if(!recordedAt||!Number.isFinite(+new Date(recordedAt)))throw Error('请填写有效的记录时间');return normal({id:s.edit||uid(),recordedAt:new Date(recordedAt).toISOString(),weather:val('weather'),location:val('location'),sleep:val('sleep'),diet:val('diet'),water:val('water'),energy:val('energy'),regions:[...s.regions],sensations:val('sensations'),tension:Number(val('tension')),breath1:val('breath1'),breath2:val('breath2'),breath3:val('breath3'),updatedAt:new Date().toISOString()})}
function queue(type,arg){const id=type==='upsert'?arg.id:arg;s.queue=s.queue.filter(o=>o.id!==id);s.queue.push({id,type,record:type==='upsert'?arg:null,seq:uid()});return persist()}
function render(){sorted();$('#guest-hint').hidden=s.mode==='cloud';const now=new Date();$('#today-day').textContent=now.getDate();$('#today-month').textContent=`${now.getMonth()+1}月 · ${new Intl.DateTimeFormat('zh-CN',{weekday:'long'}).format(now)}`;$('#today-count').textContent=s.records.filter(r=>day(r.recordedAt)===day(now)).length;$('#recent-list').innerHTML=s.records.length?s.records.slice(0,3).map(r=>`<div class="recent-item"><strong>${esc(displayDate(r.recordedAt))} · ${esc(displayTime(r.recordedAt))}</strong><p>${esc(r.sensations||r.regions.join('、')||`紧张程度 ${r.tension}/10`)}</p></div>`).join(''):'<p class="muted-empty">还没有记录。先写下此刻的感受吧。</p>';if(s.view==='history')history();if(s.view==='trends')trends();if(s.view==='settings')settings();indicator()}
function saveEntry(e){e.preventDefault();let r;try{r=buildEntry()}catch(x){toast(x.message,true);return}const old=[...s.records],editing=!!s.edit;s.records=s.records.filter(x=>x.id!==r.id).concat(r);if(!(s.mode==='cloud'?queue('upsert',r):persist())){s.records=old;return}resetForm();render();toast(s.mode==='cloud'?'记录已在本机保存，正在同步':editing?'修改已保存':'记录保存成功 ✓');if(s.mode==='cloud')flush()}
function editEntry(id){const r=s.records.find(x=>x.id===id);if(!r)return;resetForm();s.edit=id;$('#recorded-at').value=localDate(r.recordedAt);for(const k of ['weather','location','sleep','diet','water','energy','sensations','tension','breath1','breath2','breath3']){$('#entry-form').elements.namedItem(k).value=r[k]??''}s.regions=new Set(r.regions);updateRegions();$('#tension-value').textContent=r.tension;$('#form-heading').textContent='修改这次身体记录';$('#save-entry').textContent='保存修改 →';$('#form-note').textContent='正在修改历史记录，保存后会更新原记录。';navigate('record')}
function deleteEntry(id){const r=s.records.find(x=>x.id===id);if(!r||!confirm(`确定删除 ${displayDate(r.recordedAt)} ${displayTime(r.recordedAt)} 的记录吗？`))return;const old=s.records;s.records=s.records.filter(x=>x.id!==id);if(!(s.mode==='cloud'?queue('delete',id):persist())){s.records=old;return}if(s.edit===id)resetForm();render();toast(s.mode==='cloud'?'已在本机删除，正在同步':'记录已删除');if(s.mode==='cloud')flush()}
function history(){const q=$('#history-search').value.trim().toLowerCase(),f=$('#history-filter').value;const min=new Date();min.setHours(0,0,0,0);if(f==='7'||f==='30')min.setDate(min.getDate()-Number(f)+1);const entries=s.records.filter(r=>{if(f==='today'&&day(r.recordedAt)!==day(new Date()))return false;if((f==='7'||f==='30')&&new Date(r.recordedAt)<min)return false;return !q||[r.weather,r.location,r.sleep,r.diet,r.water,r.energy,r.sensations,r.breath1,r.breath2,r.breath3,r.regions.join(' ')].join(' ').toLowerCase().includes(q)});$('#history-summary').textContent=`筛选结果 ${entries.length} 条 · 总计 ${s.records.length} 条记录`;$('#history-list').innerHTML=entries.length?entries.map(r=>{const tags=[r.energy,r.weather,r.location,...r.regions].filter(Boolean);const b=[r.breath1,r.breath2,r.breath3];return `<article class="history-item"><div class="history-top"><div class="history-date">${esc(displayDate(r.recordedAt))}<span class="history-time">${esc(displayTime(r.recordedAt))}</span></div><div class="history-actions"><button type="button" data-edit="${esc(r.id)}">编辑</button><button type="button" class="delete" data-delete="${esc(r.id)}">删除</button></div></div><div class="history-tags"><span class="history-tag">紧张程度 ${r.tension}/10</span>${tags.map(t=>`<span class="history-tag neutral">${esc(t)}</span>`).join('')}</div><p class="history-content">${esc(r.sensations||'没有填写具体身体感受')}</p>${b.some(Boolean)?`<div class="breath-summary">${b.map((v,i)=>v?`<p>呼吸 ${i+1}：${esc(v)}</p>`:'').join('')}</div>`:''}</article>`}).join(''):`<div class="empty-panel"><div class="empty-symbol">✳</div><h3>还没有找到记录</h3><p>${s.records.length?'试试更换搜索词或日期范围。':'从第一次觉察开始，积累属于自己的记录。'}</p><button class="btn btn-secondary" data-go="record">去记录</button></div>`}
function chart(records,n){const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-n+1);const groups=new Map();records.forEach(r=>{const d=new Date(r.recordedAt);if(d<start)return;const k=day(d);groups.set(k,[...(groups.get(k)||[]),r.tension])});if(!groups.size)return '<div class="empty-panel"><div class="empty-symbol">⌁</div><h3>还没有趋势数据</h3><p>保存一条记录后，紧张程度就会出现在这里。</p></div>';
const W=920,H=258,L=47,R=20,T=14,B=216,PW=W-L-R,PH=B-T;const dates=Array.from({length:n},(_,i)=>{const x=new Date(start);x.setDate(start.getDate()+i);return day(x)});const points=dates.map((k,i)=>{if(!groups.has(k))return null;const a=groups.get(k).reduce((x,y)=>x+y,0)/groups.get(k).length;return {x:L+i*PW/(n-1),y:B-a/10*PH,k,a}}).filter(Boolean);const line=points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');const area=points.length>1?`${line} L${points.at(-1).x},${B} L${points[0].x},${B} Z`:'';const grid=[0,2.5,5,7.5,10].map(v=>{const y=B-v/10*PH;return `<line class="chart-grid" x1="${L}" y1="${y}" x2="${W-R}" y2="${y}"/><text class="chart-axis" x="${L-12}" y="${y+4}" text-anchor="end">${v}</text>`}).join('');const labels=[...new Set([0,Math.floor((n-1)/4),Math.floor((n-1)/2),Math.floor((n-1)*.75),n-1])].map(i=>`<text class="chart-axis" x="${L+i*PW/(n-1)}" y="${H-13}" text-anchor="middle">${dates[i].slice(5)}</text>`).join('');return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="最近${n}天紧张程度变化图，${points.length}天有记录">${grid}${area?`<path class="chart-area" d="${area}"/>`:''}${points.length>1?`<path class="chart-line" d="${line}"/>`:''}${points.map(p=>`<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="5"><title>${p.k} · ${p.a.toFixed(1)}/10</title></circle>`).join('')}${labels}</svg>`}
function trends(){const a=s.records;const lastWeek=new Date();lastWeek.setHours(0,0,0,0);lastWeek.setDate(lastWeek.getDate()-6);$('#stat-count').textContent=a.length;$('#stat-tension').textContent=a.length?(a.reduce((x,r)=>x+r.tension,0)/a.length).toFixed(1):'—';$('#stat-week').textContent=a.filter(r=>new Date(r.recordedAt)>=lastWeek).length;const counter=Object.fromEntries(REGION.map(r=>[r,0]));a.forEach(r=>r.regions.forEach(p=>{if(p in counter)counter[p]++}));const top=Object.entries(counter).filter(x=>x[1]).sort((x,y)=>y[1]-x[1]);$('#stat-region').textContent=top[0]?.[0]||'—';$('#tension-chart').innerHTML=chart(a,Number($('#trends-window').value)||30);$('#region-bars').innerHTML=top.length?top.slice(0,6).map(([r,n])=>`<div class="analysis-row"><span>${esc(r)}</span><div class="bar-track"><div class="bar-fill" style="width:${n/top[0][1]*100}%"></div></div><strong>${n}</strong></div>`).join(''):'<p class="muted-empty">暂时没有身体部位标注数据。</p>';const ec=ENERGIES.map(v=>a.filter(r=>r.energy===v).length);$('#energy-distribution').innerHTML=a.length?`<div class="energy-bar">${ec.map((n,i)=>`<span style="width:${n/a.length*100}%;background:${COLORS[i]}"></span>`).join('')}</div><div class="energy-key">${ENERGIES.map((v,i)=>`<div><i style="background:${COLORS[i]}"></i>${v}<strong>${ec[i]} 次</strong></div>`).join('')}</div>`:'<p class="muted-empty">保存一些记录后，会显示精力状态分布。</p>'}
function download(name,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportJson(){download(`身体觉察记录_${day(new Date())}.json`,JSON.stringify({app:'body-awareness',version:1,exportedAt:new Date().toISOString(),records:s.records},null,2),'application/json;charset=utf-8');toast(`已备份 ${s.records.length} 条记录`)}
function exportCsv(){const fields=[['recordedAt','记录时间'],['weather','天气'],['location','地点'],['sleep','睡眠'],['diet','饮食'],['water','饮水'],['energy','精力'],['regions','身体部位'],['tension','紧张程度'],['sensations','身体感受'],['breath1','第一次呼吸'],['breath2','第二次呼吸'],['breath3','第三次呼吸']];const quote=v=>{let text=String(v??'').replace(/\r?\n/g,' ');if(/^[\s]*[=+@]/.test(text)||/^[\s]*-(?![0-9])/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};const rows=[fields.map(x=>quote(x[1])).join(',')];s.records.forEach(r=>rows.push(fields.map(([k])=>quote(k==='regions'?r.regions.join('、'):k==='recordedAt'?`${displayDate(r[k])} ${displayTime(r[k])}`:r[k])).join(',')));download(`身体觉察历史_${day(new Date())}.csv`,'\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');toast('CSV 已导出，可使用 Excel 打开')}
async function importJson(file){if(!file)return;try{if(file.size>10*1024*1024)throw Error('文件太大（超过10MB）');const data=JSON.parse(await file.text());if(data.app!=='body-awareness'||!Array.isArray(data.records))throw Error('请选择本应用导出的 JSON 备份');if(data.records.length>5000)throw Error('单次最多导入5000条');const records=data.records.map(normal).filter(Boolean);if(!records.length)throw Error('没有有效记录');if(!confirm(`即将导入 ${records.length} 条记录；相同 ID 的记录会被覆盖。确定吗？`))return;const old=[...s.records],oldQueue=[...s.queue];const merged=new Map(s.records.map(r=>[r.id,r]));records.forEach(r=>{merged.set(r.id,r);if(s.mode==='cloud'){s.queue=s.queue.filter(q=>q.id!==r.id);s.queue.push({id:r.id,type:'upsert',record:r,seq:uid()})}});s.records=[...merged.values()];if(!persist()){s.records=old;s.queue=oldQueue;return}render();toast(`导入完成：${records.length} 条`);if(s.mode==='cloud')flush()}catch(e){toast('导入失败：'+e.message,true)}finally{$('#import-json').value=''}}
function settings(){const cloud=s.mode==='cloud';$('#site-managed-message').hidden=!MANAGED;$('#site-setup-guide').hidden=MANAGED;$('#cloud-config-form').hidden=MANAGED;$('#two-modes-description').hidden=REQUIRE_LOGIN;$('#settings-intro').textContent='无需登录也能直接记录；只有需要跨设备同步时，才登录个人账号。';$('#auth-explain').textContent=SITE.allowSignup===false?'仅限管理员开通的账号登录。已有账号请使用相同邮箱和密码。':'可以自己注册邮箱账号、设置密码。是否需要首次验证邮件由 Supabase 后台决定；日常登录只用密码。';$('#auth-tab-signup').hidden=SITE.allowSignup===false;if(SITE.allowSignup===false&&authTab==='signup')setAuthTab('login');$('#mode-description').textContent=cloud?`已登录：${s.user?.email||'个人账号'} · 云端同步`:'游客模式：数据仅保存在当前浏览器';$('#sync-status-text').textContent=cloud?s.queue.length?`有 ${s.queue.length} 条操作等待同步；${s.error||'网络恢复后将自动上传'}`:s.error?`云端暂不可用：${s.error}`:`已连接个人云空间，目前 ${s.records.length} 条云端记录`:`已在当前浏览器保存 ${readLocal().length} 条游客记录。登录后可选择将这些记录合并到个人账号；其他设备不会自动看到未同步的游客记录。`;$('#auth-area').hidden=!s.configured;$('#auth-logged-in').hidden=!cloud;$('#auth-logged-out').hidden=cloud;if(cloud){$('#signed-in-email').textContent=s.user.email||'已登录';$('#cloud-count-note').textContent=`当前设备有 ${readLocal().length} 条游客记录，其中 ${guestCandidates().length} 条尚未向此账号确认同步。上传时会合并，原游客记录仍保留在本浏览器。`;$('#import-local-cloud').disabled=guestCandidates().length===0}}
function localMode(){s.mode='local';s.user=null;s.queue=[];s.error='';s.records=readLocal();s.guestPromptedUser=null;render()}
async function cloudMode(user){if(!user?.id||s.mode==='cloud'&&s.user?.id===user.id)return;s.mode='cloud';s.user={id:user.id,email:user.email};s.error='';const stored=read(cacheKey(),{records:[],queue:[]});s.records=Array.isArray(stored.records)?stored.records.map(normal).filter(Boolean):[];s.queue=Array.isArray(stored.queue)?stored.queue.filter(x=>x&&x.id&&['upsert','delete'].includes(x.type)):[];render();if(s.queue.length)await flush();else await fetchCloud();if(s.mode==='cloud'&&s.user?.id===user.id&&!s.error)offerGuestImport()}
async function fetchCloud(){if(s.mode!=='cloud'||!s.client||!s.user)return;const id=s.user.id;try{const rows=[];for(let offset=0;offset<10000;offset+=1000){const {data,error}=await s.client.from('body_entries').select('id,recorded_at,payload').eq('user_id',id).order('recorded_at',{ascending:false}).range(offset,offset+999);if(error)throw error;rows.push(...data);if(data.length<1000)break}if(s.mode!=='cloud'||s.user?.id!==id)return;const map=new Map(rows.map(x=>normal({...x.payload,id:x.id,recordedAt:x.recorded_at})).filter(Boolean).map(r=>[r.id,r]));s.queue.forEach(o=>{if(o.type==='delete')map.delete(o.id);else{const r=normal(o.record);if(r)map.set(r.id,r)}});s.records=[...map.values()];s.error='';persist();render()}catch(e){if(s.mode==='cloud'&&s.user?.id===id){s.error=e.message||'网络错误';settings();indicator()}}}
async function flush(){if(s.busy||s.mode!=='cloud'||!s.client||!s.user)return;const id=s.user.id;s.busy=true;try{while(s.mode==='cloud'&&s.user?.id===id&&s.queue.length){const op=s.queue[0];let result;if(op.type==='delete')result=await s.client.from('body_entries').delete().eq('id',op.id).eq('user_id',id);else{const r=normal(op.record);if(!r)throw Error('待同步记录无效');result=await s.client.from('body_entries').upsert({id:r.id,user_id:id,recorded_at:r.recordedAt,payload:r,updated_at:new Date().toISOString()},{onConflict:'id'})}if(result.error)throw result.error;if(s.mode!=='cloud'||s.user?.id!==id)break;s.queue=s.queue.filter(q=>q.seq!==op.seq);persist();indicator()}if(s.mode==='cloud'&&s.user?.id===id)s.error=''}catch(e){if(s.mode==='cloud'&&s.user?.id===id)s.error=e.message||'同步失败'}finally{s.busy=false;if(s.mode==='cloud'&&s.user?.id===id){settings();indicator();if(!s.queue.length)fetchCloud()}}}
function validConfig(url,key){let p;try{p=new URL(url)}catch{throw Error('Project URL 格式不正确')}if(p.protocol!=='https:'||!p.hostname.endsWith('.supabase.co'))throw Error('URL 应为 https://xxxx.supabase.co');if(!key||key.length<15)throw Error('请输入 publishable / anon key');if(/service.role|sb_secret_/i.test(key))throw Error('禁止填入 service_role / secret key');if(key.split('.').length===3){try{const role=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role;if(role==='service_role')throw Error('禁止填入 service_role key')}catch(e){if(e.message.includes('service_role'))throw e}}return {url:p.origin,key:key.trim()}}
function setupClient(cfg){if(s.sub){s.sub.unsubscribe();s.sub=null}if(!window.supabase?.createClient){s.configured=false;toast('云端 SDK 未能加载。本机模式仍可正常使用，请联网刷新。',true);return}try{s.client=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});s.configured=true;const {data:{subscription}}=s.client.auth.onAuthStateChange((event,session)=>setTimeout(()=>{if(event==='SIGNED_OUT')localMode();else if(event==='PASSWORD_RECOVERY'&&session?.user){cloudMode(session.user);navigate('settings');toast('已验证找回链接，请在下方「修改当前账号密码」中设置新密码。')}else if(session?.user)cloudMode(session.user)},0));s.sub=subscription;s.client.auth.getSession().then(({data,error})=>{if(error){s.error=error.message;return}if(data.session?.user)cloudMode(data.session.user);else localMode()}).catch(e=>{s.error=e.message;indicator()})}catch(e){s.configured=false;toast('云端初始化失败：'+e.message,true)}}
async function saveConfig(e){e.preventDefault();let cfg;try{cfg=validConfig($('#supabase-url').value.trim(),$('#supabase-key').value.trim())}catch(x){toast(x.message,true);return}if(!write(CONFIG,cfg))return;if(s.client)await s.client.auth.signOut().catch(()=>{});localMode();setupClient(cfg);settings();toast('云端配置已保存，接下来请使用账号密码登录。')}
function setAuthTab(mode){
 authTab=mode==='signup'&&SITE.allowSignup!==false?'signup':'login';
 const signup=authTab==='signup';
 $('#auth-tab-login').classList.toggle('active',!signup);
 $('#auth-tab-signup').classList.toggle('active',signup);
 $('#auth-tab-login').setAttribute('aria-pressed',String(!signup));
 $('#auth-tab-signup').setAttribute('aria-pressed',String(signup));
 $('#auth-confirm-row').hidden=!signup;
 $('#auth-password-confirm').required=signup;
 $('#auth-password').autocomplete=signup?'new-password':'current-password';
 $('#auth-submit').textContent=signup?'创建账号并登录':'登录';
 $('#forgot-password').hidden=signup;
}
function friendlyAuthError(e){
 const message=String(e?.message||'未知错误');
 if(/invalid login credentials/i.test(message))return '账号或密码不正确；如果之前只用邮件链接登录，请先为原账号设置密码。';
 if(/email not confirmed/i.test(message))return '这个账号尚未完成首次邮箱验证。请检查注册邮件，或联系管理员确认账号。';
 if(/user already registered/i.test(message))return '这个邮箱已注册，请切换到「账号登录」。';
 if(/password should be at least|weak_password/i.test(message))return '密码强度不足，请使用更长且不易猜测的密码。';
 if(/signups not allowed|signup is disabled/i.test(message))return '管理员已关闭自助注册，请联系管理员开通账号。';
 if(/rate limit|too many requests/i.test(message))return '操作过于频繁，请稍后重试。';
 return message;
}
async function passwordAuth(e){
 e.preventDefault();
 if(!s.client){toast('请先由网站管理员配置云数据库',true);return}
 const email=$('#auth-email').value.trim().toLowerCase();
 const password=$('#auth-password').value;
 if(!/^\S+@\S+\.\S+$/.test(email)){toast('请输入有效的邮箱账号',true);return}
 if(password.length<8){toast('密码至少8位，建议12位以上',true);return}
 if(authTab==='signup'){
   if(SITE.allowSignup===false){toast('管理员未开放自助注册',true);return}
   if(password!==$('#auth-password-confirm').value){toast('两次输入的密码不一致',true);return}
 }
 const button=$('#auth-submit');button.disabled=true;button.textContent=authTab==='signup'?'正在注册……':'正在登录……';
 try{
   const result=authTab==='signup'?
    await s.client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):
    await s.client.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   $('#auth-password').value='';$('#auth-password-confirm').value='';
   if(result.data?.session?.user){
     await cloudMode(result.data.session.user);
     navigate('record');
     toast(authTab==='signup'?'账号已注册，登录成功 ✓':'登录成功 ✓');
   }else if(authTab==='signup'){
     setAuthTab('login');
     toast('已提交注册。当前项目要求先验证一次邮箱，请打开注册邮件完成确认。');
   }else{
     toast('账号尚未登录，请检查是否需要验证邮箱。',true);
   }
 }catch(err){toast((authTab==='signup'?'注册失败：':'登录失败：')+friendlyAuthError(err),true)}
 finally{button.disabled=false;button.textContent=authTab==='signup'?'创建账号并登录':'登录'}
}
async function forgotPassword(){
 if(!s.client){toast('云端尚未配置',true);return}
 const email=$('#auth-email').value.trim();if(!/^\S+@\S+\.\S+$/.test(email)){toast('请先在账号栏输入注册邮箱',true);return}
 if(!confirm('向此邮箱发送一次密码重置链接？密码找回仍需要邮箱可用及已配置邮件服务。'))return;
 const b=$('#forgot-password');b.disabled=true;
 try{const {error}=await s.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;toast('如果账号存在且邮件服务可用，密码重置邮件将发到该邮箱。')}catch(e){toast('发送失败：'+friendlyAuthError(e),true)}finally{b.disabled=false}
}
async function changePassword(e){
 e.preventDefault();
 if(s.mode!=='cloud'||!s.client){toast('请先登录',true);return}
 const password=$('#new-account-password').value;
 if(password.length<8){toast('新密码至少8位',true);return}
 const b=$('#change-password-form button');b.disabled=true;
 try{const {error}=await s.client.auth.updateUser({password});if(error)throw error;$('#new-account-password').value='';toast('密码已更新，下次可以使用新密码登录。')}catch(e){toast('修改失败：'+friendlyAuthError(e),true)}finally{b.disabled=false}
}
// 游客记录独立于任何账号。通过按账号标记已上传的记录版本，避免每次登录都重复导入。
function guestCandidates(){
 if(s.mode!=='cloud'||!s.user)return [];
 const sent=read(GUEST_SYNC+s.user.id,{});
 return readLocal().filter(r=>sent[r.id]?.updatedAt!==r.updatedAt);
}
function offerGuestImport(){
 if(s.mode!=='cloud'||!s.user||s.guestPromptedUser===s.user.id)return;
 s.guestPromptedUser=s.user.id;
 const records=guestCandidates();
 if(!records.length)return;
 // 必须由本人确认后才能把游客记录归入此账号，防止共享设备串号。
 setTimeout(()=>{
   if(s.mode!=='cloud'||!s.user||!records.length)return;
   const email=s.user.email||'当前账号';
   if(confirm(`当前浏览器有 ${records.length} 条游客记录尚未同步到「${email}」。\n\n是否将它们合并到这个账号？\n（选择取消仍可继续使用，并可在“设置与同步”中手动上传。）`))copyLocal(true);
 },120);
}
function copyLocal(confirmed=false){
 if(s.mode!=='cloud'||!s.user){toast('请先登录个人账号',true);return}
 if(s.error){toast('云端连接异常，请先点击“立即同步”，确认云端记录已加载后再合并游客数据。',true);return}
 const records=guestCandidates();
 if(!records.length){toast('没有需要同步到此账号的新游客记录');return}
 const email=s.user.email||'当前账号';
 if(!confirmed&&!confirm(`将当前浏览器的 ${records.length} 条游客记录同步到「${email}」？\n相同 ID 时优先保留更新时间较新的记录；游客原件仍保存在此浏览器。`))return;
 const old=[...s.records],oldQueue=[...s.queue],merged=new Map(s.records.map(r=>[r.id,r]));
 const synced=read(GUEST_SYNC+s.user.id,{});
 let uploads=0,skipped=0;
 records.forEach(r=>{
   // 不同账号复制同一条游客记录时，不能复用全局主键：会触发跨用户主键冲突。
   // 每个账号分配独立的云端 ID；V2/V3 已上传的同 ID 旧记录继续沿用旧 ID。
   const destinationId=synced[r.id]?.destinationId||(merged.has(r.id)?r.id:uid());
   const cloud=merged.get(destinationId);
   if(cloud&&Date.parse(cloud.updatedAt)>=Date.parse(r.updatedAt)){
     skipped++;
   }else{
     const copy={...r,id:destinationId};
     merged.set(destinationId,copy);
     s.queue=s.queue.filter(q=>q.id!==destinationId);
     s.queue.push({id:destinationId,type:'upsert',record:copy,seq:uid()});
     uploads++;
   }
   synced[r.id]={updatedAt:r.updatedAt,destinationId};
 });
 s.records=[...merged.values()];
 if(!persist()){s.records=old;s.queue=oldQueue;return}
 // 标记发生在同步操作成功写入本机持久队列之后；网络断开时仍可重试。
 write(GUEST_SYNC+s.user.id,synced);
 render();toast(uploads?`${uploads} 条游客记录已加入同步队列${skipped?`，${skipped} 条保留云端较新版本`:''}`:'没有新记录需要上传');
 if(uploads)flush();
}
function clearData(){if(!s.records.length){toast('没有需要清空的记录');return}if(!confirm(`将删除当前${s.mode==='cloud'?'云端账号':'浏览器'}内的 ${s.records.length} 条记录。此操作不可撤销，建议先导出备份。确定删除吗？`))return;const old=s.records,oldQueue=[...s.queue];s.records=[];if(s.mode==='cloud')old.forEach(r=>{s.queue=s.queue.filter(q=>q.id!==r.id);s.queue.push({id:r.id,type:'delete',seq:uid()})});if(!persist()){s.records=old;s.queue=oldQueue;return}if(s.edit)resetForm();render();toast(s.mode==='cloud'?'删除请求已加入同步队列':'本机数据已清空');if(s.mode==='cloud')flush()}
function init(){s.records=readLocal();resetForm();render();$$('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));document.addEventListener('click',e=>{const go=e.target.closest('[data-go]');if(go)navigate(go.dataset.go);const edit=e.target.closest('[data-edit]');if(edit)editEntry(edit.dataset.edit);const del=e.target.closest('[data-delete]');if(del)deleteEntry(del.dataset.delete);const rg=e.target.closest('[data-region]');if(rg)toggleRegion(rg.dataset.region)});$$('svg [data-region]').forEach(b=>b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleRegion(b.dataset.region)}}));$('#tension').addEventListener('input',e=>$('#tension-value').textContent=e.target.value);$('#entry-form').addEventListener('submit',saveEntry);$('#reset-form').addEventListener('click',()=>{resetForm();toast('表单已重置，历史记录不会被删除')});$('#history-search').addEventListener('input',history);$('#history-filter').addEventListener('change',history);$('#trends-window').addEventListener('change',trends);$('#history-export').addEventListener('click',exportCsv);$('#export-json').addEventListener('click',exportJson);$('#import-json').addEventListener('change',e=>importJson(e.target.files[0]));$('#clear-data').addEventListener('click',clearData);$('#cloud-config-form').addEventListener('submit',saveConfig);$('#auth-tab-login').addEventListener('click',()=>setAuthTab('login'));$('#auth-tab-signup').addEventListener('click',()=>setAuthTab('signup'));$('#auth-password-form').addEventListener('submit',passwordAuth);$('#forgot-password').addEventListener('click',forgotPassword);$('#change-password-form').addEventListener('submit',changePassword);$('#show-auth-password').addEventListener('change',e=>{const t=e.target.checked?'text':'password';$('#auth-password').type=t;$('#auth-password-confirm').type=t});$('#sign-out').addEventListener('click',async()=>{if(!s.client)return;if(s.queue.length&&!confirm(`还有 ${s.queue.length} 条记录尚未同步，退出后它们只会保存在此设备。仍要退出吗？`))return;const {error}=await s.client.auth.signOut();if(error)toast('退出失败：'+error.message,true);else{localMode();toast('已切换至本机记录')}});$('#sync-now').addEventListener('click',async()=>{if(s.queue.length)await flush();else await fetchCloud();toast(s.error?'同步未完成：'+s.error:'已检查云端记录',!!s.error)});$('#import-local-cloud').addEventListener('click',()=>copyLocal(false));window.addEventListener('online',()=>{if(s.mode==='cloud')flush()});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&s.mode==='cloud'){if(s.queue.length)flush();else fetchCloud()}});const cfg=MANAGED?{url:SITE.supabaseUrl,key:SITE.supabasePublishableKey}:read(CONFIG,null);if(cfg?.url&&cfg.key){if(!MANAGED){$('#supabase-url').value=cfg.url;$('#supabase-key').value=cfg.key}try{setupClient(validConfig(cfg.url,cfg.key))}catch{toast('云端配置无效，请管理员检查 config.js',true)}}else $('#auth-area').hidden=true;settings();setAuthTab('login');if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{})}
init();
})();

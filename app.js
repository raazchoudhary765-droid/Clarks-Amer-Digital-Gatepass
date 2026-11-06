// Paste your deployed Google Apps Script Web App URL below.
const API_URL = 'https://script.google.com/macros/s/AKfycbw7Qo_X8si9iDurJqbv9iV2MdMRFfGHHupek2T6xE979I4KfxZRFD2p6RqJMO2vYjA-/exec';
const state = { token: sessionStorage.getItem('gp_token') || '', user: null, records: [], photos: [], zoom: 1 };
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('loginForm').addEventListener('submit', login);
  $('logoutBtn').addEventListener('click', logout);
  $('gatepassForm').addEventListener('submit', submitGatepass);
  $('movementType').addEventListener('change', toggleVehicle);
  $('photoInput').addEventListener('change', addPhotos);
  $('filterBtn').addEventListener('click', loadRecords);
  $('clearFilters').addEventListener('click', clearFilters);
  $('resetForm').addEventListener('click', () => { state.photos = []; renderPhotoPreview(); setTimeout(setDefaultDate, 0); });
  $('closeModal').addEventListener('click', closeModal);
  $('zoomIn').addEventListener('click', () => setZoom(state.zoom + .25));
  $('zoomOut').addEventListener('click', () => setZoom(Math.max(.5, state.zoom - .25)));
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.goto)));
  setDefaultDate();
  toggleVehicle();
  $('todayLabel').textContent = new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'});
  if (state.token) restoreSession(); else $('loginView').classList.remove('hidden');
});
function setDefaultDate(){ $('gatepassDate').value = new Date().toISOString().slice(0,10); }
function toggleVehicle(){ const isVehicle = $('movementType').value === 'VEHICLE'; $('vehicleField').classList.toggle('hidden', !isVehicle); $('vehicleNumber').required = isVehicle; }
async function api(payload) {
  if (!API_URL || API_URL.includes('PASTE_YOUR')) throw new Error('Apps Script URL is not configured in app.js');
  const response = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload), redirect:'follow' });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}
async function login(e){
  e.preventDefault(); $('loginError').textContent = '';
  try {
    const data = await api({action:'login', username:$('username').value, password:$('password').value});
    state.token = data.token; state.user = data.user; sessionStorage.setItem('gp_token', state.token);
    enterApp();
  } catch(err){ $('loginError').textContent = err.message; }
}
async function restoreSession(){
  // Validate cached token by requesting records. If expired, return to login.
  try { const data = await api({action:'listGatepasses', token:state.token}); state.records = data.records; state.sheetUrl = data.spreadsheetUrl; state.user = data.user; enterApp(true); }
  catch(e){ sessionStorage.removeItem('gp_token'); state.token=''; $('loginView').classList.remove('hidden'); }
}
function enterApp(restored=false){
  $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden');
  $('userName').textContent = state.user.name; $('userRole').textContent = state.user.role; $('avatar').textContent = (state.user.name||'U')[0].toUpperCase();
  document.querySelectorAll('.security-only').forEach(el => el.classList.toggle('hidden', state.user.role !== 'SECURITY'));
  if (state.user.role === 'MANAGEMENT') $('welcomeTitle').textContent = 'Management Overview';
  else $('welcomeTitle').textContent = 'Security Operations';
  showPage('dashboard'); loadRecords();
}
async function logout(){
  try { await api({action:'logout',token:state.token}); } catch(e){}
  sessionStorage.removeItem('gp_token'); state.token=''; state.user=null; $('appView').classList.add('hidden'); $('loginView').classList.remove('hidden'); $('password').value='';
}
function showPage(page){
  ['dashboard','new','records'].forEach(p => $(p+'Page').classList.toggle('hidden',p!==page));
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('pageTitle').textContent = page==='new'?'New Gatepass':page==='records'?'Gatepass Records':'Dashboard';
  if(page==='records') loadRecords();
  if(page==='dashboard') loadRecords();
}
async function submitGatepass(e){
  e.preventDefault(); const btn=$('submitBtn'), msg=$('formMessage'); msg.textContent='';
  if(!$('gatepassNo').value.trim()){msg.textContent='Gatepass Number is required.';return;}
  if($('movementType').value==='VEHICLE' && !$('vehicleNumber').value.trim()){msg.textContent='Vehicle number is required.';return;}
  btn.disabled=true; btn.textContent='Uploading...';
  try{
    const photos=[];
    for(const file of state.photos) photos.push({name:file.name,dataUrl:await fileToDataUrl(file)});
    const data=await api({action:'createGatepass',token:state.token,gatepassNo:$('gatepassNo').value.trim(),gatepassDate:$('gatepassDate').value,movementType:$('movementType').value,vehicleNumber:$('vehicleNumber').value,personName:$('personName').value,remarks:$('remarks').value,photos});
    msg.textContent=`Gatepass ${data.gatepassNo} submitted successfully. ${data.photoCount} photo(s) uploaded.`;
    msg.className='form-message success'; toast('Gatepass submitted successfully');
    $('gatepassForm').reset(); state.photos=[]; renderPhotoPreview(); setDefaultDate(); toggleVehicle(); await loadRecords(); showPage('dashboard');
  }catch(err){msg.textContent=err.message;msg.className='form-message error';}
  finally{btn.disabled=false;btn.textContent='Submit Gatepass';}
}
function addPhotos(e){
  const incoming=Array.from(e.target.files||[]);
  for(const f of incoming){
    if(!f.type.startsWith('image/')){toast('Only image files are allowed');continue;}
    if(f.size>8*1024*1024){toast(f.name+' is over 8 MB');continue;}
    state.photos.push(f);
  }
  e.target.value=''; renderPhotoPreview();
}
function renderPhotoPreview(){
  $('photoPreview').querySelectorAll('img').forEach(img => { if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl); });
  $('photoPreview').innerHTML='';
  state.photos.forEach((f,i)=>{
    const wrap=document.createElement('div');wrap.className='preview-item';
    const img=document.createElement('img');const objectUrl=URL.createObjectURL(f);img.src=objectUrl;img.dataset.objectUrl=objectUrl;img.alt=f.name;
    const remove=document.createElement('button');remove.type='button';remove.className='remove-photo';remove.textContent='×';remove.onclick=()=>{state.photos.splice(i,1);renderPhotoPreview();};
    wrap.append(img,remove);$('photoPreview').append(wrap);
  });
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
async function loadRecords(){
  try{
    const payload={action:'listGatepasses',token:state.token,search:$('searchInput').value,fromDate:$('fromDate').value,toDate:$('toDate').value,movementType:$('typeFilter').value};
    const data=await api(payload); state.records=data.records||[]; state.sheetUrl=data.spreadsheetUrl;
    $('sheetLink').href=state.sheetUrl; $('openSheetBtn').href=state.sheetUrl;
    renderRecords();
  }catch(err){ if(err.message.toLowerCase().includes('session')) logout(); else toast(err.message); }
}
function renderRecords(){
  const records=state.records, today=new Date().toLocaleDateString('en-GB').replaceAll('/','-');
  $('totalCount').textContent=records.length;
  $('todayCount').textContent=records.filter(r=>r['Gatepass Date']===today).length;
  $('vehicleCount').textContent=records.filter(r=>r['Movement Type']==='VEHICLE').length;
  $('handCount').textContent=records.filter(r=>r['Movement Type']==='BY_HAND').length;
  renderCards('recentGrid',records.slice(0,4)); renderCards('recordsGrid',records);
}
function renderCards(targetId,records){
  const root=$(targetId);root.innerHTML='';
  if(!records.length){root.innerHTML='<div class="record-card"><p class="muted">No gatepass records found.</p></div>';return;}
  records.forEach(r=>{
    const card=document.createElement('article');card.className='record-card';
    const top=document.createElement('div');top.className='record-top';
    const left=document.createElement('div');const no=document.createElement('div');no.className='record-no';no.textContent=r['Gatepass No.'];
    const date=document.createElement('div');date.className='record-date';date.textContent=r['Gatepass Date'];left.append(no,date);
    const tag=document.createElement('span');tag.className='status-tag';tag.textContent=r['Movement Type']==='VEHICLE'?'VEHICLE':'BY HAND';top.append(left,tag);
    const details=document.createElement('div');details.className='record-details';
    addDetail(details,'Person Name',r['Person Name']);addDetail(details,'Vehicle / Movement',r['Vehicle Number']||'BY HAND');
    addDetail(details,'Submitted By',r['Submitted By']);addDetail(details,'Photo Count',r['Photo Count']||0);
    card.append(top,details);
    if(r['Remarks']){const rem=document.createElement('div');rem.className='record-remarks';rem.textContent='Remarks: '+r['Remarks'];card.append(rem);}
    const strip=document.createElement('div');strip.className='thumb-strip';
    (r.photos||[]).forEach((rawUrl,i)=>{
      const url=drivePreviewUrl(rawUrl);
      const im=document.createElement('img');im.className='thumb';im.src=url;im.alt='Gatepass photo '+(i+1);im.loading='lazy';
      im.onerror=()=>{const id=extractDriveId(rawUrl);if(id && !im.dataset.fallback){im.dataset.fallback='1';im.src='https://lh3.googleusercontent.com/d/'+id;}else{im.classList.add('image-load-error');im.alt='Photo preview unavailable';}};
      im.onclick=()=>openModal(url,r['Gatepass No.']+' · Photo '+(i+1));strip.append(im);
    });
    if(!(r.photos||[]).length){const np=document.createElement('div');np.className='no-photo';np.textContent='No photo attached';strip.append(np);}
    card.append(strip);
    const foot=document.createElement('div');foot.className='record-footer';foot.textContent='Status: '+(r.Status||'SUBMITTED');const count=document.createElement('span');count.textContent=(r.photos||[]).length+' attachment(s)';foot.append(count);card.append(foot);
    root.append(card);
  });
}
function addDetail(root,label,value){const box=document.createElement('div');const l=document.createElement('span');l.className='detail-label';l.textContent=label;const v=document.createElement('span');v.className='detail-value';v.textContent=value||'—';box.append(l,v);root.append(box);}
function extractDriveId(url){
  const s=String(url||'');
  let m=s.match(/[?&]id=([a-zA-Z0-9_-]+)/); if(m) return m[1];
  m=s.match(/\/d\/([a-zA-Z0-9_-]+)/); return m?m[1]:'';
}
function drivePreviewUrl(url){
  const id=extractDriveId(url);
  return id ? 'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1600' : String(url||'');
}
function clearFilters(){$('searchInput').value='';$('fromDate').value='';$('toDate').value='';$('typeFilter').value='';loadRecords();}
function openModal(url,caption){
  state.zoom=1;
  const modalImg=$('modalImage');modalImg.dataset.original=url;modalImg.dataset.fallback='';
  modalImg.onerror=()=>{const id=extractDriveId(modalImg.dataset.original);if(id&&!modalImg.dataset.fallback){modalImg.dataset.fallback='1';modalImg.src='https://lh3.googleusercontent.com/d/'+id;}};
  modalImg.src=url;modalImg.style.transform='scale(1)';$('modalCaption').textContent=caption;$('imageModal').classList.remove('hidden');}
function closeModal(){$('imageModal').classList.add('hidden');$('modalImage').src='';}
function setZoom(value){state.zoom=value;$('modalImage').style.transform=`scale(${value})`;}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

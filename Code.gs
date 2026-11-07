/** Hotel Clarks Amer | Security Gatepass. Deploy as Apps Script Web App. */
const CONFIG={SHEET:'GATEPASS_MASTER',RETURNS:'RETURN_LOG',AUDIT:'AUDIT_LOG',FOLDER:'GATEPASS_PHOTOS',TZ:'Asia/Kolkata'};
const HEADERS={
 GATEPASS_MASTER:['Gatepass No','Date','Out Time','Gatepass Type','Party Name','Material Name','Qty','Taken By','Movement Mode','Vehicle No','Driver Name','Remarks','Status','Received Qty','Balance Qty','In Date','In Time','Gatepass Photo File ID','Gatepass Photo URL','Extra Photo File IDs','Extra Photo URLs','Department','Created At','Updated At'],
 RETURN_LOG:['Return ID','Gatepass No','In Date','In Time','Received Qty','Received By','Remarks','Recorded At'],
 AUDIT_LOG:['Event ID','Gatepass No','Action','Actor','Timestamp','Remarks']
};
function doGet(){setupSheets();return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('Hotel Clarks Amer | Gate Pass').addMetaTag('viewport','width=device-width, initial-scale=1');}
function include(name){return HtmlService.createHtmlOutputFromFile(name).getContent();}
function sheet_(name){const ss=SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Bind script to a Google Sheet');return ss.getSheetByName(name)||ss.insertSheet(name);}
function setupSheets(){
 Object.entries(HEADERS).forEach(([name,headers])=>{
  const s=sheet_(name),last=Math.max(s.getLastColumn(),1);
  const old=s.getLastRow()?s.getRange(1,1,1,last).getDisplayValues()[0].filter(Boolean):[];
  // Safely migrate known headers by name without overwriting existing record values.
  if(old.length&&old.join('|')!==headers.join('|')){
   const data=s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,last).getValues():[];
   const nonempty=data.some(row=>row.some(v=>v!==''));
   if(nonempty){
    const unknown=old.filter(h=>!headers.includes(h));
    if(unknown.length){const backupName='BACKUP_'+name;const backup=sheet_(backupName);if(backup.getLastRow()===0){backup.getRange(1,1,1,old.length).setValues([old]);if(data.length)backup.getRange(2,1,data.length,old.length).setValues(data);}}
    const remapped=data.map(row=>headers.map(h=>{const i=old.indexOf(h);return i<0?'':row[i]}));
    s.clearContents();s.getRange(1,1,1,headers.length).setValues([headers]);if(remapped.length)s.getRange(2,1,remapped.length,headers.length).setValues(remapped);
   }else{s.clearContents();s.getRange(1,1,1,headers.length).setValues([headers]);}
  }else if(!old.length)s.getRange(1,1,1,headers.length).setValues([headers]);
  s.getRange(1,1,1,headers.length).setBackground('#14233c').setFontColor('#e7b95d').setFontWeight('bold');s.setFrozenRows(1);
 });return 'READY';
}
function rows_(){const s=sheet_(CONFIG.SHEET);if(s.getLastRow()<2)return [];const keys=HEADERS.GATEPASS_MASTER;return s.getRange(2,1,s.getLastRow()-1,keys.length).getValues().filter(r=>r[0]).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i] instanceof Date?Utilities.formatDate(r[i],CONFIG.TZ,'yyyy-MM-dd HH:mm:ss'):r[i]])));}
function listGatepasses(){setupSheets();return rows_().reverse();}
function find_(number){const s=sheet_(CONFIG.SHEET);if(s.getLastRow()<2)throw Error('No records');const cell=s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(String(number)).matchEntireCell(true).findNext();if(!cell)throw Error('Gatepass not found');return cell.getRow();}
function folder_(){const props=PropertiesService.getScriptProperties(),id=props.getProperty('PHOTO_FOLDER_ID');if(id){try{return DriveApp.getFolderById(id)}catch(e){}}const f=DriveApp.createFolder(CONFIG.FOLDER);props.setProperty('PHOTO_FOLDER_ID',f.getId());return f;}
function photo_(obj,number,suffix){if(!obj||!/^data:image\/(jpeg|png|webp);base64,/.test(obj.data||''))throw Error('Invalid photo');const match=obj.data.match(/^data:(image\/[^;]+);base64,(.+)$/),bytes=Utilities.base64Decode(match[2]);if(bytes.length>4*1024*1024)throw Error('Photo too large');const file=folder_().createFile(Utilities.newBlob(bytes,match[1],number+'_'+suffix+'.jpg'));return {id:file.getId(),url:'https://drive.google.com/uc?export=view&id='+file.getId()};}
function createGatepass(input){setupSheets();const p=JSON.parse(JSON.stringify(input));const type=String(p.type||'').toUpperCase();if(!['RGP','NRGP'].includes(type))throw Error('Select RGP or NRGP');for(const k of ['number','date','outTime','party','material','takenBy','mode'])if(!String(p[k]||'').trim())throw Error('Missing '+k);if(!(Number(p.qty)>0))throw Error('Invalid quantity');if(p.mode==='Vehicle'&&!p.vehicle)throw Error('Enter vehicle number');if(!p.photo)throw Error('Attach gatepass image');
 const lock=LockService.getScriptLock();lock.waitLock(30000);try{
  if(rows_().some(r=>String(r['Gatepass No'])===String(p.number)))throw Error('Gatepass number already exists');
  const main=photo_(p.photo,p.number,'gatepass');const extras=(p.extras||[]).slice(0,4).map((x,i)=>photo_(x,p.number,'extra_'+(i+1)));
  const now=new Date(),status=type==='NRGP'?'Closed':'Pending';
  const values=[p.number,p.date,p.outTime,type,p.party,p.material,Number(p.qty),p.takenBy,p.mode,p.mode==='Vehicle'?(p.vehicle||''):'',p.mode==='Vehicle'?(p.driver||''):'',p.remarks||'',status,0,Number(p.qty),'','',main.id,main.url,extras.map(x=>x.id).join(','),extras.map(x=>x.url).join(','),p.department||'',now,now];
  sheet_(CONFIG.SHEET).appendRow(values);audit_(p.number,'CREATED',p.takenBy,status);return {number:p.number,status};
 }finally{lock.releaseLock()}}
function receiveMaterial(input){setupSheets();const lock=LockService.getScriptLock();lock.waitLock(30000);try{
 const row=find_(input.number),s=sheet_(CONFIG.SHEET),r=s.getRange(row,1,1,HEADERS.GATEPASS_MASTER.length).getValues()[0];if(r[3]!=='RGP'||r[12]!=='Pending')throw Error('Only pending RGP can be received');const q=Number(input.qty),balance=Number(r[14]);if(!Number.isFinite(q)||q<=0||q>balance)throw Error('Quantity must be 0 to '+balance);const now=new Date(),date=Utilities.formatDate(now,CONFIG.TZ,'yyyy-MM-dd'),time=Utilities.formatDate(now,CONFIG.TZ,'HH:mm:ss'),newBalance=balance-q;
 s.getRange(row,14,1,4).setValues([[Number(r[13])+q,newBalance,date,time]]);s.getRange(row,13).setValue(newBalance===0?'Closed':'Pending');s.getRange(row,24).setValue(now);
 sheet_(CONFIG.RETURNS).appendRow([Utilities.getUuid(),input.number,date,time,q,input.by||'Security',input.remarks||'',now]);audit_(input.number,'RECEIVED',input.by||'Security','Qty '+q+'; balance '+newBalance);return {status:newBalance===0?'Closed':'Pending',balance:newBalance};
 }finally{lock.releaseLock()}}
function audit_(no,action,actor,remarks){sheet_(CONFIG.AUDIT).appendRow([Utilities.getUuid(),no,action,actor,new Date(),remarks||'']);}
function getImageData(fileId){if(!/^[\w-]{10,}$/.test(String(fileId)))throw Error('Invalid file');const f=DriveApp.getFileById(fileId),b=f.getBlob();return 'data:'+b.getContentType()+';base64,'+Utilities.base64Encode(b.getBytes());}

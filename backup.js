(() => {
"use strict";
const FORMAT="fullpagecapture-backup";
const VERSION=1;
const createButton=document.querySelector("#create-backup");
const fileInput=document.querySelector("#backup-file");
const preview=document.querySelector("#backup-preview");
const restoreButton=document.querySelector("#restore-backup");
const status=document.querySelector("#backup-status");
let selectedBackup=null;
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open("fullPageCaptureExports",2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("exports"))r.result.createObjectStore("exports");if(!r.result.objectStoreNames.contains("library"))r.result.createObjectStore("library",{keyPath:"id"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error("Could not access local capture storage."));});}
function readStore(db,name){return new Promise((resolve,reject)=>{if(!db.objectStoreNames.contains(name))return resolve([]);const r=db.transaction(name,"readonly").objectStore(name).openCursor(),items=[];r.onsuccess=()=>{const c=r.result;if(!c)return resolve(items);items.push({key:c.key,value:c.value});c.continue();};r.onerror=()=>reject(new Error("Could not read "+name+" data."));});}
function blobToBase64(blob){return blob.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer);let binary="";for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);});}
async function pack(value){if(value instanceof Blob)return {__fpcBackupType:"Blob",mimeType:value.type,data:await blobToBase64(value)};if(Array.isArray(value))return Promise.all(value.map(pack));if(value&&typeof value==="object"){const out={};for(const [k,v] of Object.entries(value))out[k]=await pack(v);return out;}return value;}
function unpack(value){if(Array.isArray(value))return value.map(unpack);if(value&&typeof value==="object"){if(value.__fpcBackupType==="Blob"&&typeof value.data==="string"){const raw=atob(value.data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:value.mimeType||""});}const out={};for(const [k,v] of Object.entries(value))out[k]=unpack(v);return out;}return value;}
async function createBackup(){createButton.disabled=true;status.textContent="Preparing backup…";let db;try{const settings=await chrome.storage.local.get(null);db=await openDb();const [exports,library]=await Promise.all([readStore(db,"exports"),readStore(db,"library")]);const backup={format:FORMAT,version:VERSION,createdAt:new Date().toISOString(),settings,database:{exports:await Promise.all(exports.map(async x=>({key:x.key,value:await pack(x.value)}))),library:await Promise.all(library.map(async x=>({key:x.key,value:await pack(x.value)})))}};const url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="FullPageCapture-backup-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status.textContent="Backup exported."; }catch(e){status.textContent="Backup failed: "+(e.message||"Unknown error");}finally{if(db)db.close();createButton.disabled=false;}}
function validate(data){
  if(!data||data.format!==FORMAT||data.version!==VERSION)throw new Error("Unsupported FullPageCapture backup.");
  if(typeof data.createdAt!=="string"||!Number.isFinite(Date.parse(data.createdAt)))throw new Error("Backup date is invalid.");
  if(!data.settings||typeof data.settings!=="object"||Array.isArray(data.settings))throw new Error("Backup settings are invalid.");
  const settingTypes={defaultFormat:"string",filenamePattern:"string",saveFolder:"string",showSaveDialog:"boolean",libraryEnabled:"boolean"};
  for(const [key,value] of Object.entries(data.settings)){
    if(!(key in settingTypes)||typeof value!==settingTypes[key])throw new Error("Backup contains an unsupported setting.");
  }
  if(data.settings.defaultFormat&&!["png","jpeg","pdf"].includes(data.settings.defaultFormat))throw new Error("Backup contains an invalid export format.");
  if(!data.database||!Array.isArray(data.database.exports)||!Array.isArray(data.database.library))throw new Error("Backup capture data is missing.");
  const validKey=key=>typeof key==="string"||typeof key==="number"||Array.isArray(key);
  const validatePacked=(value,depth=0)=>{
    if(depth>30)throw new Error("Backup data is nested too deeply.");
    if(Array.isArray(value)){for(const item of value)validatePacked(item,depth+1);return;}
    if(value&&typeof value==="object"){
      if(value.__fpcBackupType==="Blob"){
        if(typeof value.data!=="string"||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data))throw new Error("Backup contains an invalid file.");
        if(typeof value.mimeType!=="string")throw new Error("Backup contains an invalid file type.");
        return;
      }
      for(const item of Object.values(value))validatePacked(item,depth+1);
    }
  };
  const exportKeys=new Set();
  for(const item of data.database.exports){
    if(!item||!validKey(item.key)||exportKeys.has(JSON.stringify(item.key))||!("value" in item))throw new Error("Backup contains an invalid saved record.");
    exportKeys.add(JSON.stringify(item.key));validatePacked(item.value);
  }
  const libraryIds=new Set();
  for(const item of data.database.library){
    if(!item||!item.value||typeof item.value!=="object"||typeof item.value.id!=="string"||!item.value.id||libraryIds.has(item.value.id)||!("blob" in item.value))throw new Error("Backup contains an invalid Library capture.");
    if(!item.value.blob||typeof item.value.blob!=="object"||item.value.blob.__fpcBackupType!=="Blob")throw new Error("Backup contains an invalid Library file.");
    libraryIds.add(item.value.id);validatePacked(item.value);
  }
  validatePacked(data.settings);
  return data;
}
fileInput.addEventListener("change",async()=>{selectedBackup=null;restoreButton.disabled=true;status.textContent="";const file=fileInput.files&&fileInput.files[0];if(!file){preview.textContent="Choose a backup file to inspect it before restoring.";return;}try{const data=validate(JSON.parse(await file.text()));selectedBackup=data;preview.textContent="Backup date: "+new Date(data.createdAt).toLocaleString()+" · "+data.database.library.length+" Library captures · "+data.database.exports.length+" saved records · "+Object.keys(data.settings).length+" settings. Restoring replaces current data.";restoreButton.disabled=false;}catch(e){preview.textContent=e.message||"Could not inspect backup.";}});
async function readCurrentDatabase(){const db=await openDb();try{const [exports,library]=await Promise.all([readStore(db,"exports"),readStore(db,"library")]);return {exports,library};}finally{db.close();}}
async function writeDatabase(snapshot){const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(["exports","library"],"readwrite"),ex=tx.objectStore("exports"),lib=tx.objectStore("library");ex.clear();lib.clear();for(const x of snapshot.exports)ex.put(x.value,x.key);for(const x of snapshot.library)lib.put(x.value);tx.oncomplete=resolve;tx.onerror=()=>reject(new Error("Could not restore capture data."));tx.onabort=()=>reject(new Error("Capture restore was interrupted."));});}finally{db.close();}}
async function restoreDatabase(data){const snapshot={exports:await Promise.all(data.database.exports.map(async x=>({key:x.key,value:unpack(x.value)}))),library:data.database.library.map(x=>unpack(x.value))};await writeDatabase(snapshot);}

restoreButton.addEventListener("click",async()=>{if(!selectedBackup)return;if(!confirm("Restore this backup? This replaces ALL current extension settings, Library captures, and saved capture data. This cannot be undone. Export a backup of your current data first if you may need it."))return;restoreButton.disabled=true;createButton.disabled=true;status.textContent="Restoring backup…";let previousSettings,previousDatabase;try{previousSettings=await chrome.storage.local.get(null);previousDatabase=await readCurrentDatabase();await restoreDatabase(selectedBackup);await chrome.storage.local.clear();await chrome.storage.local.set(selectedBackup.settings);preview.textContent="Restored "+selectedBackup.database.library.length+" Library captures and "+selectedBackup.database.exports.length+" saved records. Reload extension pages to apply restored settings.";status.textContent="Backup restored successfully.";selectedBackup=null;fileInput.value="";}catch(e){try{if(previousDatabase)await writeDatabase(previousDatabase);if(previousSettings){await chrome.storage.local.clear();await chrome.storage.local.set(previousSettings);}}catch(rollbackError){status.textContent="Restore failed, and automatic rollback was incomplete. Check your Library and settings before continuing. "+(rollbackError.message||"");}status.textContent="Restore failed. Your previous data and settings were restored. "+(e.message||"Unknown error");}finally{restoreButton.disabled=!selectedBackup;createButton.disabled=false;}});
createButton.addEventListener("click",createBackup);
})();

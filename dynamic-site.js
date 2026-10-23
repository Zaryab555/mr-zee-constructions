(function () {
'use strict';
const config=window.MR_ZEE_BACKEND||{};
const ready=Boolean(config.url&&config.publishableKey&&window.supabase);
const client=ready?window.supabase.createClient(config.url,config.publishableKey):null;
const $=id=>document.getElementById(id);
const msg=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
const safe=(value)=>document.createTextNode(String(value||''));
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.appendChild(safe(text));return el;}
function show(el,visible){if(el)el.hidden=!visible;}
function cardForReview(review){
 const card=node('div','review');
 card.append(node('div','stars','★'.repeat(review.rating)+'☆'.repeat(5-review.rating)));
 card.append(node('p','',review.comment));
 const author=node('strong','',review.name);card.append(author);
 if(review.location)card.append(node('small','', ' · '+review.location));
 return card;
}
function mediaForItem(item){
 const figure=node('figure','managed-media');
 const url=client.storage.from('site-media').getPublicUrl(item.file_path).data.publicUrl;
 let media;
 if(item.media_type==='video'){media=node('video');media.controls=true;media.preload='metadata';media.playsInline=true;}
 else {media=node('img');media.loading='lazy';media.alt=item.title;}
 media.src=url;figure.append(media,node('figcaption','',item.title));return figure;
}
async function refreshPublic(){
 if(!client)return;
 try {
  const [rev,gal]=await Promise.all([
    client.from('customer_reviews').select('id,name,location,rating,comment').eq('status','approved').order('created_at',{ascending:false}).limit(24),
    client.from('gallery_media').select('id,title,file_path,media_type').eq('published',true).order('created_at',{ascending:false}).limit(60)
  ]);
  if(rev.error)throw rev.error;if(gal.error)throw gal.error;
  const reviews=$('liveReviews');reviews.replaceChildren(...rev.data.map(cardForReview));
  show($('noReviews'),rev.data.length===0);
  const galleryEl=$('liveGallery');galleryEl.replaceChildren();
  const grouped=new Map();
  for(const item of gal.data){if(!grouped.has(item.title))grouped.set(item.title,[]);grouped.get(item.title).push(item);}
  for(const [title,items] of grouped){
   const album=node('details','project-album');
   const summary=node('summary');
   const cover=items.find(x=>x.media_type==='image');
   if(cover){const img=node('img');img.loading='lazy';img.alt=title+' project cover';img.src=client.storage.from('site-media').getPublicUrl(cover.file_path).data.publicUrl;summary.append(img);}
   const name=node('span');name.append(node('strong','',title),node('small','',items.length+' photo/video'+(items.length===1?'':'s')));
   summary.append(name,node('span','album-arrow','View project ▾'));
   const grid=node('div','gallery-grid album-photos');grid.append(...items.map(mediaForItem));
   album.append(summary,grid);galleryEl.append(album);
  }
 }catch(error){console.error(error);msg('reviewStatus','Unable to load recent updates right now.');}
}
const form=$('submitReview');
if(form)form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!client){msg('reviewStatus','Reviews are not available yet. Please try again later.');return;}
 if($('reviewWebsite').value){msg('reviewStatus','Thank you.');return;}
 const submit=$('reviewSubmit');submit.disabled=true;
 const data={name:$('reviewName').value.trim(),location:$('reviewLocation').value.trim(),rating:Number($('reviewRating').value),comment:$('reviewComment').value.trim()};
 try{
  if(data.name.length<2||data.comment.length<10||data.comment.length>1500)throw Error('Please enter your name and a review of 10–1500 characters.');
  const {error}=await client.from('customer_reviews').insert(data);
  if(error)throw error;
  form.reset();msg('reviewStatus','Thanks! Your review has been received and will appear after approval.');
 }catch(err){msg('reviewStatus',err.message||'Unable to submit the review.');}
 finally{submit.disabled=false;}
});
if(!ready){
 show($('reviewUnavailable'),true);
 if(form)show(form,false);
 show($('adminLogin'),false);
}else{
 refreshPublic();
}
async function isAdmin(){
 const {data:{user}}=await client.auth.getUser();
 if(!user)return false;
 const {data,error}=await client.from('site_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(error)throw error;
 return !!data;
}
let admin=false;
async function refreshAdmin(){
 if(!admin)return;
 const [reviews,gallery]=await Promise.all([
  client.from('customer_reviews').select('id,name,location,rating,comment,status,created_at').order('created_at',{ascending:false}).limit(100),
  client.from('gallery_media').select('id,title,file_path,media_type,published,created_at').order('created_at',{ascending:false}).limit(100)
 ]);
 if(reviews.error)throw reviews.error;if(gallery.error)throw gallery.error;
 const list=$('pendingReviews');list.replaceChildren();
 for(const r of reviews.data){
  if(r.status!=='pending')continue;
  const row=node('div','admin-item');
  row.append(node('strong','',r.name+' — '+'★'.repeat(r.rating)),node('p','',r.comment));
  for(const status of ['approved','rejected']){
   const b=node('button','admin-small',status==='approved'?'Approve':'Reject');
   b.onclick=async()=>{b.disabled=true;try{const{error}=await client.from('customer_reviews').update({status}).eq('id',r.id);if(error)throw error;await refreshAdmin();await refreshPublic();}catch(e){alert(e.message);}finally{b.disabled=false;}};
   row.append(b);
  }
  list.append(row);
 }
 if(!list.children.length)list.append(node('p','','No pending reviews.'));
 const items=$('adminGalleryList');items.replaceChildren();
 const projectOptions=$('existingProjects');if(projectOptions){projectOptions.replaceChildren();const titles=[...new Set(gallery.data.map(x=>x.title))];for(const title of titles){const option=node('option');option.value=title;projectOptions.append(option);}}
 for(const item of gallery.data){
  const row=node('div','admin-item');
  row.append(node('strong','',item.title+' ('+item.media_type+')'));
  const change=node('button','admin-small',item.published?'Hide':'Publish');
  change.onclick=async()=>{change.disabled=true;try{const{error}=await client.from('gallery_media').update({published:!item.published}).eq('id',item.id);if(error)throw error;await refreshAdmin();await refreshPublic();}catch(e){alert(e.message);}finally{change.disabled=false;}};
  const del=node('button','admin-small','Delete');
  del.onclick=async()=>{if(!confirm('Permanently delete this uploaded file?'))return;del.disabled=true;try{
   // Remove storage object first; if deletion fails the record is retained.
   const {error:storageError}=await client.storage.from('site-media').remove([item.file_path]);
   if(storageError)throw storageError;
   const {error}=await client.from('gallery_media').delete().eq('id',item.id);
   if(error)throw error;
   await refreshAdmin();await refreshPublic();
  }catch(e){alert(e.message);}finally{del.disabled=false;}};
  row.append(change,del);items.append(row);
 }
}
async function syncAdmin(){
 try{
  admin=await isAdmin();show($('adminPanel'),admin);show($('adminLogin'),!admin);
  if(admin)await refreshAdmin();
  else if(ready)msg('loginMessage','Sign in with your admin account.');
 }catch(e){msg('loginMessage',e.message);}
}
const login=$('adminLoginForm');
if(login)login.addEventListener('submit',async e=>{
 e.preventDefault();if(!client)return;
 msg('loginMessage','Signing in...');
 const {error}=await client.auth.signInWithPassword({email:$('adminEmail').value,password:$('adminPassword').value});
 if(error){msg('loginMessage',error.message);return;}
 await syncAdmin();
 if(!admin)msg('loginMessage','This account does not have administrator permission.');
});
if($('adminRegister'))$('adminRegister').onclick=async()=>{
 if(!client)return;
 const email=$('adminEmail').value.trim(),password=$('adminPassword').value;
 if(!email||password.length<10){msg('loginMessage','Enter your email and a password with at least 10 characters.');return;}
 const {data,error}=await client.auth.signUp({email,password});
 if(error){msg('loginMessage',error.message);return;}
 msg('loginMessage',data.session?'Account created. Your account still needs owner access approval.':'Check your email to confirm your account. Owner approval will also be needed.');
};
if($('adminLogout'))$('adminLogout').onclick=async()=>{await client.auth.signOut();admin=false;await syncAdmin();};
const uploader=$('mediaUploader');
const fileInput=$('mediaFile');
const maxFiles=30;
const fileLimit=50*1024*1024;
const types=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
const exts={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
let mediaBatch=[];
let batchTitle='';
let uploadBusy=false;

function reportSelectedFiles(){
 const preview=$('selectedMediaPreview');
 if(preview)preview.replaceChildren();
 const count=mediaBatch.length;
 msg('selectedMediaSummary',count?count+' selected: '+mediaBatch.filter(x=>x.done).length+' uploaded, '+mediaBatch.filter(x=>!x.done).length+' remaining.':'No files selected. Long-press to select multiple photos from your phone.');
 for(const entry of mediaBatch.slice(0,maxFiles)){
  const file=entry.file;
  const fig=node('figure'); const cap=node('figcaption','',file.name);
  if(types.includes(file.type)){
   const visual=node(file.type.startsWith('video/')?'video':'img');
   const u=URL.createObjectURL(file);
   visual.src=u;
   if(visual.tagName==='VIDEO'){visual.muted=true;visual.preload='metadata';}
   visual.addEventListener('load',()=>URL.revokeObjectURL(u),{once:true});
   visual.addEventListener('error',()=>URL.revokeObjectURL(u),{once:true});
   visual.addEventListener('loadedmetadata',()=>URL.revokeObjectURL(u),{once:true});
   fig.append(visual);
  }
  fig.append(cap);preview?.append(fig);
 }
}
if(fileInput)fileInput.addEventListener('change',()=>{
 mediaBatch=Array.from(fileInput.files).map(file=>({file,done:false,path:'',error:''}));
 batchTitle='';
 reportSelectedFiles();
 const progress=$('uploadProgress');if(progress){progress.hidden=true;progress.value=0;}
 const results=$('uploadFileResults');if(results)results.replaceChildren();
 msg('uploadMessage',mediaBatch.length>1?'Selected '+mediaBatch.length+' files. Keep this page open until every upload is confirmed.':'');
 const button=$('uploadButton');if(button)button.textContent='Upload All & Publish';
});

// Using one permanent file path per selected file avoids creating duplicates when
// the user retries an interrupted batch on the same page.
async function publishOneMedia(entry,title){
 const file=entry.file;
 if(!entry.path){
  const kind=file.type.startsWith('video/')?'video':'image';
  entry.path=(kind==='video'?'videos/':'photos/')+crypto.randomUUID()+'.'+exts[file.type];
 }
 // An earlier attempt could have succeeded even if the phone lost the response.
 const already=await client.from('gallery_media').select('id').eq('file_path',entry.path).maybeSingle();
 if(already.error)throw already.error;
 if(already.data)return;
 const uploaded=await client.storage.from('site-media').upload(entry.path,file,{contentType:file.type,upsert:false});
 if(uploaded.error&&!/already exists|duplicate|resource exists|409/i.test(uploaded.error.message||''))throw uploaded.error;
 const type=file.type.startsWith('video/')?'video':'image';
 const inserted=await client.from('gallery_media').insert({title,file_path:entry.path,media_type:type});
 if(inserted.error){
  const check=await client.from('gallery_media').select('id').eq('file_path',entry.path).maybeSingle();
  if(check.error||!check.data)throw inserted.error;
 }
 const verified=await client.from('gallery_media').select('id').eq('file_path',entry.path).maybeSingle();
 if(verified.error)throw verified.error;
 if(!verified.data)throw Error('File upload not confirmed in the gallery database.');
}
if(uploader)uploader.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!client||!admin||uploadBusy)return;
 const title=$('mediaTitle').value.trim();
 if(!mediaBatch.length||title.length<2||title.length>100){
  msg('uploadMessage','Enter a project title and select photos/videos first.');return;
 }
 if(mediaBatch.length>maxFiles){
  msg('uploadMessage','Select no more than '+maxFiles+' files per batch.');return;
 }
 const invalid=mediaBatch.filter(x=>!types.includes(x.file.type)||x.file.size===0||x.file.size>fileLimit);
 if(invalid.length){
  msg('uploadMessage','Unsupported, empty or over-50-MB files: '+invalid.map(x=>x.file.name).join(', '));return;
 }
 if(batchTitle&&batchTitle!==title&&mediaBatch.some(x=>x.done)){
  msg('uploadMessage','Please keep the project title "'+batchTitle+'" until this batch finishes.');return;
 }
 batchTitle=title;
 const button=$('uploadButton'),progress=$('uploadProgress'),results=$('uploadFileResults'),titleInput=$('mediaTitle');
 uploadBusy=true;button.disabled=true;fileInput.disabled=true;titleInput.disabled=true;
 progress.hidden=false;progress.max=mediaBatch.length;progress.value=mediaBatch.filter(x=>x.done).length;
 results.replaceChildren();
 try{
  for(let i=0;i<mediaBatch.length;i++){
   const entry=mediaBatch[i];
   if(entry.done){
    results.append(node('p','','✓ Already uploaded: '+entry.file.name));
    continue;
   }
   for(let attempt=1;attempt<=2;attempt++){
    msg('uploadMessage','Uploading '+(i+1)+' of '+mediaBatch.length+': '+entry.file.name+(attempt===2?' (retrying)':''));
    try{
     await publishOneMedia(entry,batchTitle);
     entry.done=true;entry.error='';
     break;
    }catch(error){
     entry.error=error.message||'The connection was interrupted.';
     if(attempt===1&&navigator.onLine){
      await new Promise(resolve=>setTimeout(resolve,900));
     }
    }
   }
   const message=entry.done?'✓ '+entry.file.name:'✗ '+entry.file.name+': '+entry.error;
   results.append(node('p','',message));
   progress.value=mediaBatch.filter(x=>x.done).length;
   reportSelectedFiles();
  }
  const completed=mediaBatch.filter(x=>x.done).length,remaining=mediaBatch.length-completed;
  if(remaining){
   msg('uploadMessage',completed+' of '+mediaBatch.length+' confirmed. '+remaining+' not uploaded. Tap Retry Failed Files; successful files will not be uploaded twice.');
   button.textContent='Retry Failed Files ('+remaining+')';
  }else{
   msg('uploadMessage','Success! All '+completed+' files are now saved in the "'+batchTitle+'" gallery folder.');
   button.textContent='Upload All & Publish';
  }
  await refreshAdmin();await refreshPublic();
 }catch(error){
  msg('uploadMessage','Upload status could not be refreshed: '+(error.message||'Unknown error'));
 }finally{
  uploadBusy=false;button.disabled=false;fileInput.disabled=false;titleInput.disabled=false;
 }
}); 
if(ready && $('adminLoginForm'))syncAdmin();
})();
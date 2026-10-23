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
  $('liveGallery').replaceChildren(...gal.data.map(mediaForItem));
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
if(fileInput)fileInput.addEventListener('change',()=>{
 const files=Array.from(fileInput.files);
 const preview=$('selectedMediaPreview');if(preview)preview.replaceChildren();
 msg('selectedMediaSummary',files.length?files.length+' files selected ('+(files.reduce((n,f)=>n+f.size,0)/1048576).toFixed(1)+' MB total). Max '+maxFiles+' files per batch.':'No files selected yet.');
 for(const file of files.slice(0,30)){
  const fig=node('figure');const caption=node('figcaption','',file.name);
  if(types.includes(file.type)){
   const visual=node(file.type.startsWith('video/')?'video':'img');
   const url=URL.createObjectURL(file);visual.src=url;
   if(visual.tagName==='VIDEO'){visual.muted=true;visual.preload='metadata';}
   visual.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
   visual.addEventListener('loadedmetadata',()=>URL.revokeObjectURL(url),{once:true});
   fig.append(visual);
  }
  fig.append(caption);preview?.append(fig);
 }
});
if(uploader)uploader.addEventListener('submit',async event=>{
 event.preventDefault();if(!client||!admin)return;
 const files=Array.from(fileInput.files),title=$('mediaTitle').value.trim();
 if(!files.length||title.length<2||title.length>100){msg('uploadMessage','Choose files and enter a project title.');return;}
 if(files.length>maxFiles){msg('uploadMessage','Please select no more than '+maxFiles+' files per batch.');return;}
 const invalid=files.filter(f=>!types.includes(f.type)||f.size>fileLimit||f.size===0);
 if(invalid.length){msg('uploadMessage','Some files are unsupported, empty or over 50 MB: '+invalid.map(f=>f.name).join(', '));return;}
 const button=$('uploadButton'),progress=$('uploadProgress'),results=$('uploadFileResults');
 button.disabled=true;fileInput.disabled=true;progress.hidden=false;progress.max=files.length;progress.value=0;
 results.replaceChildren();let successful=0;
 const failed=[];
 try{
  for(const file of files){
   msg('uploadMessage','Uploading '+(successful+failed.length+1)+' of '+files.length+': '+file.name);
   const kind=file.type.startsWith('video/')?'video':'image';
   const path=(kind==='video'?'videos/':'photos/')+crypto.randomUUID()+'.'+exts[file.type];
   try{
    const {error:upErr}=await client.storage.from('site-media').upload(path,file,{contentType:file.type,upsert:false});
    if(upErr)throw upErr;
    const {error:dbErr}=await client.from('gallery_media').insert({title,file_path:path,media_type:kind});
    if(dbErr){await client.storage.from('site-media').remove([path]);throw dbErr;}
    successful++;results.append(node('p','','✓ '+file.name));
   }catch(error){failed.push(file.name);results.append(node('p','','✗ '+file.name+': '+(error.message||'Upload failed')));}
   progress.value=successful+failed.length;
  }
  msg('uploadMessage',successful+' of '+files.length+' files published'+(failed.length?'. '+failed.length+' failed. Retry those files separately.':'.'));
  if(!failed.length){uploader.reset();fileInput.dispatchEvent(new Event('change'));}
  await refreshAdmin();await refreshPublic();
 }finally{button.disabled=false;fileInput.disabled=false;}
});
if(ready)syncAdmin();
})();
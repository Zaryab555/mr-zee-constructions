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
if($('adminLogout'))$('adminLogout').onclick=async()=>{await client.auth.signOut();admin=false;await syncAdmin();};
const uploader=$('mediaUploader');
if(uploader)uploader.addEventListener('submit',async event=>{
 event.preventDefault();if(!client||!admin)return;
 const file=$('mediaFile').files[0],title=$('mediaTitle').value.trim();
 if(!file||title.length<2){msg('uploadMessage','Choose a file and enter a title.');return;}
 const types=['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'];
 if(!types.includes(file.type)){msg('uploadMessage','Use JPG, PNG, WEBP, GIF, MP4 or WEBM.');return;}
 if(file.size>50*1024*1024){msg('uploadMessage','Maximum size is 50 MB per file. Compress larger videos first.');return;}
 const button=$('uploadButton');button.disabled=true;msg('uploadMessage','Uploading...');
 const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'})[file.type];
 const type=file.type.startsWith('video/')?'video':'image';
 const path=(type==='video'?'videos/':'photos/')+crypto.randomUUID()+'.'+ext;
 try{
  const {error:uploadError}=await client.storage.from('site-media').upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError)throw uploadError;
  const {error:dbError}=await client.from('gallery_media').insert({title,file_path:path,media_type:type});
  if(dbError){await client.storage.from('site-media').remove([path]);throw dbError;}
  uploader.reset();msg('uploadMessage','Uploaded and published successfully.');await refreshAdmin();await refreshPublic();
 }catch(e){msg('uploadMessage',e.message||'Upload failed.');}
 finally{button.disabled=false;}
});
if(ready)syncAdmin();
})();
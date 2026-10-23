# Reviews and Gallery Dashboard — Setup

This project remains a **static GitHub Pages site**. The new forms need a secure service to persist reviews and store photos/videos. This implementation uses a Supabase project that the site owner must create. Changes on this branch are NOT live until the pull request is merged and configuration is completed.

## 1. Create your database and storage
1. Create a project at https://supabase.com/dashboard (choose a strong database password).
2. Open **SQL Editor**, paste the entire `supabase-setup.sql` file and run it. It creates review/media tables, a public image/video storage bucket, and **row-level security**.
3. Under **Authentication > Users**, create your own email/password user; copy the user's **UUID**.
4. Run this in SQL Editor, substituting the UUID:
   `insert into public.site_admins(user_id) values ('YOUR-ADMIN-AUTH-USER-UUID');`
   Do not grant admin access to strangers. Restrict public signups in Authentication settings; use a strong unique password and MFA if available.

## 2. Connect the website
1. In Supabase **Project Settings / API**, copy your project's URL and **publishable (or legacy anon) key**.
2. Edit `site-config.js` and paste the URL and publishable/anon key between the quotes.
3. **NEVER** use a service role key, secret key, or database password in the website.
4. Merge the pull request into `main` after testing. GitHub Pages updates after deployment.

## 3. Customer reviews
Customers complete the form at **#reviews**. New reviews are **pending** by default. Only approved reviews appear publicly. You review them via **#admin**. These are website reviews, **not** automatic Google Business Profile reviews. Remove old placeholder reviews when deploying (this branch already removes them).

## 4. Upload photos and videos from your phone
Open `https://mrzeeconstructions.co.uk/#admin` on your phone, sign in, add a title, choose an image or video, then tap **Upload & Publish**. You can hide or remove entries. Supported: JPG, PNG, WEBP, GIF, MP4 and WEBM, maximum **50 MB** per file (your Supabase project may enforce a smaller global upload limit). Storage quota, bandwidth, and platform plan limits apply. Consider compressing large videos, or using YouTube/Vimeo embeds in a future release.

The existing Gallery images stored in the GitHub repository remain displayed. They are *not* deletable from this dashboard.

## 5. Security and maintenance
- Only site admins can publish media, approve/reject reviews or delete content.
- All visitors can submit a review, but cannot self-approve.
- Publicly uploaded gallery files are accessible on the internet; do not upload private family photos, confidential documents, or photos without permission.
- Do not expose your admin password or publish secret keys. Customers do not need to log in.
- A honeypot field helps with automated spam but is **not** a full bot-prevention solution. Add CAPTCHA and rate limiting/Edge Functions if submissions become abusive.
- To avoid misleading visitors, do not create imaginary positive reviews.
- Test the sign-in, review, approval, gallery photo and video before announcing the feature.

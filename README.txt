NAYON PORTFOLIO — VERCEL + SUPABASE

The website is a public static site hosted on Vercel. Supabase provides admin authentication, shared project records, and uploaded media. Only users with app_metadata.role = "admin" can edit. The Supabase publishable/anon key is intended to be public; never put the service_role/secret key in website files, Vercel client-side environment variables, or git.

QUICK SETUP
1. Create a Supabase project.
2. In Supabase SQL Editor, run supabase/setup.sql.
   Rerun this script after updating the site files to add project categories and shared website settings.
3. In Authentication > Users, create the administrator using an email address and a confirmed phone number in international format (+880...). Set a strong password.
4. In SQL Editor, assign the admin role to that exact account:
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'YOUR_ADMIN_EMAIL';
   Verify exactly one row was updated. Do not put admin role in user_metadata.
5. In Authentication settings, disable public sign-ups after creating your admin account.
6. In Authentication > URL Configuration, set the Site URL to your Vercel domain and add the production and preview domains you use to Redirect URLs.
7. In Authentication > Providers, enable Phone only if phone/password sign-in and SMS reset are desired. Configure an SMS provider such as Twilio or another supported provider and add rate limits/CAPTCHA for production.
8. In Authentication > Email Templates > Reset Password, use the OTP token in the message (for example: "Your password reset code is {{ .Token }}") so the in-site code form can verify it. Configure custom SMTP for reliable production email delivery.
9. Copy the Supabase Project URL and publishable/anon key from Project Settings > API into supabase-config.js. These two values are public. Do not copy a secret/service_role key.
10. Redeploy the static site on Vercel. Admin login, project management, password changes, and recovery activate once the config is valid.
11. After an administrator logs in, open Settings in the header. Account settings customize public text, contact details, colors, and fonts; Security settings manage the admin email and password; Project settings add, edit, or remove projects.

LOGIN AND PASSWORD RECOVERY
- Admin login accepts the registered email or confirmed phone number and password.
- After login, use the Sign out button in the header, or open Settings > Security settings to change the email or password and sign out. Email changes may remain pending until confirmed from the email message.
- For security, administrators are automatically signed out after one hour without activity in the current website tab. Activity in another tab does not reset this timer.
- Forgot password accepts the registered email (email OTP) or confirmed phone in +country-code format (SMS OTP). Phone reset verifies an SMS sign-in OTP, checks the admin role, then sets a new password.
- Supabase recovery email must use the OTP template above. SMS requires an enabled phone provider and may incur provider charges.
- Passwords must meet Supabase Auth password policy. The UI asks for at least 12 characters with uppercase/lowercase, a number, and a symbol; configure the same policy in Supabase Auth.

PROJECTS AND FILES
- Public visitors can read the project list and public media.
- Admin project edits are stored in the shared portfolio_projects table and appear for all visitors.
- Website-wide settings are stored in portfolio_site_settings. Public visitors can read settings; only administrators can save them.
- Admins can assign projects to Eyewear Design, Product Design, Character Design, or 2D Design. Existing projects default to Eyewear Design.
- Use Settings > Project settings to add, edit, or remove projects. Category grids show two rows at a time; Show more expands the selected category.
- Project uploads go to the public "portfolio" bucket. Upload size is limited to 25 MB per file. The bucket policy in setup.sql allows only admin app_metadata roles to upload/edit/delete.
- Existing Eyewear cards remain in index.html. Their cloud overrides are keyed by static IDs; newly created projects use generated UUIDs.

For Vercel, keep this a static deployment; no server/service-role key is required. After changing Supabase Auth settings, redeploy or refresh the site and test login, email/SMS recovery, uploads, and public viewing.

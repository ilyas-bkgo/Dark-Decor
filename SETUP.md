# Deploy Dark Decor with Supabase and Vercel

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com/) and keep its database password in a password manager.

## 2. Create the order tables and security rules

In the Supabase dashboard, open **SQL Editor → New query**. Paste and run the complete file `supabase/migrations/001_orders.sql` from this project. The migration creates the orders and admins tables, row-level security policies, server-calculated prices, and indexes.

The order trigger serializes submissions by normalized phone number and permits at most five orders from one phone in a rolling hour. This is a basic abuse limit, not an IP-based CAPTCHA service. The form also retains its hidden honeypot and rejects submissions made less than three seconds after opening.

Next, open another **SQL Editor → New query**, paste the complete file `supabase/migrations/002_events.sql`, and run it. It creates the analytics event table and an admin-only summary function. A database trigger serializes events by random browser session ID and rejects event 101 or higher in a rolling hour for that session.

After migration 002, open **SQL Editor → New query** again, paste the complete file `supabase/migrations/003_casablanca_timezone.sql`, and run it. This updates the analytics daily grouping to use the `Africa/Casablanca` timezone; run it after 002 because it replaces the summary function created there. Order filters, date displays, and Excel exports also use Casablanca time, including Morocco's Ramadan offset changes.

After migration 003, run `supabase/migrations/004_admin_management.sql` in a new Supabase **SQL Editor → New query**. It adds admin-only functions for listing, adding, and removing admins. The functions enforce admin membership in the database; the frontend never writes directly to `public.admins`.

## 3. Disable public sign-ups

In Supabase, open **Authentication → Providers → Email** and disable **Allow new users to sign up**. Admin accounts will be created by you in the dashboard; there is no sign-up screen in the site.

## 4. Create your friend's admin account

For the initial administrator only, create your friend's account in **Authentication → Users → Add user** with a strong password and enable **Auto Confirm User**. Copy that user's UUID. In **SQL Editor**, run the following after replacing the UUID to bootstrap the first admin:

```sql
insert into public.admins (user_id)
values ('PASTE-AUTH-USER-UUID-HERE');
```

Only UUIDs listed in `public.admins` can read or update orders. The `admins` table has no API access; the application checks membership through a restricted database function.

Once you can sign in as an admin, create future admin accounts in **Authentication → Users → Add user**, enable **Auto Confirm User**, and create a temporary strong password for the user. Then open `/admin`, select **المشرفون**, enter the new account's email, and choose **إضافة مشرف**. Do not add later admins with direct table writes. The same tab lets each logged-in admin change their own password.

## 5. Configure and deploy on Vercel

Push this project to the Git provider connected to Vercel. In Supabase, open **Project Settings → API** and copy the Project URL and the publishable key. The publishable key is intended for the browser; never put a service-role or secret key in a `VITE_` variable.

In Vercel, open **Project → Settings → Environment Variables** and add these variables for Production (and Preview/Development if you use those environments):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VITE_SITE_URL` | Public site origin, such as `https://your-domain.example` (optional; enables absolute social-preview URLs) |

To enable ads measurement, create a Meta Pixel in **Meta Events Manager → Connect data sources → Web**, then copy its Pixel ID. Add `VITE_META_PIXEL_ID` in the same Vercel Environment Variables page. Leave it unset or empty to disable the Pixel. The site asks visitors for marketing-cookie consent before loading Meta's script.

Save the variables, then redeploy so Vite includes the new environment values in the build. Set `VITE_SITE_URL` to the final public site origin to enable absolute Open Graph image and page URLs; if unset, those URL tags are omitted. The Vercel build command is `npm run build`; output directory is `dist`. `vercel.json` rewrites `/admin` and other client routes to the SPA entry point so refreshing `/admin` works while static icons and the share image remain direct files.

For local development, copy `.env.example` to `.env.local`, fill in the two Supabase values and (optionally) the Pixel ID, then run `npm run dev`.

## 6. Test the full flow

1. Open the public storefront and submit a test order. Wait at least three seconds before submitting.
2. Open `/admin` and sign in with the admin account.
3. Confirm the new order appears. Try status, city, date, and name/phone filters.
4. Change the order status, refresh the page, and confirm it persisted.
5. Export Excel with filters active and confirm matching records, Arabic headers, and phone numbers with leading zeroes are present.
6. Check the order's call and WhatsApp links on a phone.
7. Accept the marketing-cookie notice, then use Meta Events Manager's **Test Events** tool or the **Meta Pixel Helper** browser extension to confirm PageView, ViewContent, InitiateCheckout, and Lead events. Lead fires only after an order is accepted; its payload contains only the total and MAD currency. The Lead `eventID` is also stored as the submitted event row's UUID for possible future deduplication.
8. Open **الإحصائيات** in `/admin`, change the date range, and confirm the funnel and breakdowns load. Test in a private browser session with Do Not Track disabled; DNT-enabled browsers intentionally produce no analytics.
9. Run `npm run check:dates` to verify normal-time and Ramadan Casablanca date conversion (`2026-10-24` and `2024-03-20`).

## 7. Security and launch checklist

- Keep the Supabase service-role key out of Vercel frontend variables, source code, and chat. Only the Project URL and publishable key belong in the Vite app.
- Meta Pixel is not loaded unless `VITE_META_PIXEL_ID` is configured and a visitor accepts the marketing-cookie notice.
- Funnel analytics contain random session IDs, event/section names, selected offer, field names (never field values), device type, referrer host or UTM source, and campaign name. They do not contain names, phone numbers, addresses, or form text. Browsers with Do Not Track enabled are not tracked.
- Keep public sign-ups disabled and grant admin membership only to trusted accounts.
- Confirm the orders table has RLS enabled and the migration policies are present.
- Use a unique admin password and enable multi-factor authentication for the Supabase account where available.
- Before running ads, review Supabase's current free-plan database, bandwidth, and pause limits against expected traffic. Set up a backup/export routine and verify a restore plan; free-plan backup options and limits can change.
- Vercel environment variable changes require a new deployment to take effect.

## Data protection and rate limit

Orders contain only the name, phone, city, address, selected offer, quantity, note, status, timestamps, and optional admin note. The database computes the total and blocks more than five orders per normalized phone per hour. Admin filtering and Excel export query the database, not browser storage.

Analytics use an independent `events` table with anonymous session-level measurements and a database summary function. The database limits each session to 100 events per rolling hour; the limit is keyed by the random session ID, not an IP address.

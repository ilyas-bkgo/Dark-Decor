# Deploy Dark Decor with Supabase and Vercel

## 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com/) and keep its database password in a password manager.

## 2. Create the order tables and security rules

In the Supabase dashboard, open **SQL Editor → New query**. Paste and run the complete file `supabase/migrations/001_orders.sql` from this project. The migration creates the orders and admins tables, row-level security policies, server-calculated prices, and indexes.

The order trigger serializes submissions by normalized phone number and permits at most five orders from one phone in a rolling hour. This is a basic abuse limit, not an IP-based CAPTCHA service. The form also retains its hidden honeypot and rejects submissions made less than three seconds after opening.

## 3. Disable public sign-ups

In Supabase, open **Authentication → Providers → Email** and disable **Allow new users to sign up**. Admin accounts will be created by you in the dashboard; there is no sign-up screen in the site.

## 4. Create your friend's admin account

In **Authentication → Users**, use **Add user** to create the account with your friend's email and a strong password. Copy that user's UUID. In **SQL Editor**, run the following after replacing the UUID:

```sql
insert into public.admins (user_id)
values ('PASTE-AUTH-USER-UUID-HERE');
```

Only UUIDs listed in `public.admins` can read or update orders. The `admins` table has no API access; the application checks membership through a restricted database function.

## 5. Configure and deploy on Vercel

Push this project to the Git provider connected to Vercel. In Supabase, open **Project Settings → API** and copy the Project URL and the publishable key. The publishable key is intended for the browser; never put a service-role or secret key in a `VITE_` variable.

In Vercel, open **Project → Settings → Environment Variables** and add these variables for Production (and Preview/Development if you use those environments):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

Save them, then redeploy so Vite includes the new environment values in the build. The Vercel build command is `npm run build`; output directory is `dist`. `vercel.json` rewrites `/admin` and other client routes to the SPA entry point so refreshing `/admin` works.

For local development, copy `.env.example` to `.env.local`, fill in the two values, then run `npm run dev`.

## 6. Test the full flow

1. Open the public storefront and submit a test order. Wait at least three seconds before submitting.
2. Open `/admin` and sign in with the admin account.
3. Confirm the new order appears. Try status, city, date, and name/phone filters.
4. Change the order status, refresh the page, and confirm it persisted.
5. Export Excel with filters active and confirm matching records, Arabic headers, and phone numbers with leading zeroes are present.
6. Check the order's call and WhatsApp links on a phone.

## 7. Security and launch checklist

- Keep the Supabase service-role key out of Vercel frontend variables, source code, and chat. Only the Project URL and publishable key belong in the Vite app.
- Keep public sign-ups disabled and grant admin membership only to trusted accounts.
- Confirm the orders table has RLS enabled and the migration policies are present.
- Use a unique admin password and enable multi-factor authentication for the Supabase account where available.
- Before running ads, review Supabase's current free-plan database, bandwidth, and pause limits against expected traffic. Set up a backup/export routine and verify a restore plan; free-plan backup options and limits can change.
- Vercel environment variable changes require a new deployment to take effect.

## Data protection and rate limit

Orders contain only the name, phone, city, address, selected offer, quantity, note, status, timestamps, and optional admin note. The database computes the total and blocks more than five orders per normalized phone per hour. Admin filtering and Excel export query the database, not browser storage.

# Coach desk: setting it up

Everything here is on free plans. You do the steps in order, one at a time.
Where a step says "send me", paste the value in the chat and I do the rest.

What you end up with:

- The website forms save every enquiry in your own database (Supabase, EU).
- You get an email for each new enquiry.
- A private coach desk at your own Netlify address, where you review Snapshots
  and publish the report link.

---

## Step 1. Create the database

1. Go to **supabase.com** and click **Start your project**. Sign up with
   info@concrete-surfers.com.
2. Click **New project**.
   - Name: `concrete-surfers`
   - Database password: click **Generate a password**, then save it in your
     password manager. You will almost never need it, but keep it.
   - Region: **Central EU (Frankfurt)**.
   - Plan: **Free**.
3. Click **Create new project** and wait about two minutes.
4. Open **Project Settings** (the gear icon at the bottom left), then **API Keys**
   (in some accounts it's called **API**).
5. **Send me two things:** the **Project URL** (it looks like
   `https://abcdxyz.supabase.co`) and the **publishable key** (starts with
   `sb_publishable_`; older projects call it the **anon public** key).
   Both are safe to share. **Never send me the secret key or the service_role key.**

## Step 2. Close the front door

1. In Supabase, open **Authentication**, then **Sign In / Providers**.
2. Switch off **Allow new users to sign up**. Click **Save**.

Now nobody can create an account. Only the one you make next exists.

## Step 3. Create your login

1. **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Email: `info@concrete-surfers.com`. Password: a strong one, saved in your
   password manager.
3. Tick **Auto Confirm User**. Click **Create user**.

## Step 4. Build the tables

1. Open this file on GitHub:
   `desk/supabase/setup.sql` in the coach-vasco repository, on the branch
   `claude/concrete-surfers-website-avpp00`.
2. Click the **Copy raw file** button (two overlapping squares, top right of the file).
3. In Supabase, open **SQL Editor**, click **New query**, paste, then click **Run**.
4. If Supabase warns that the query has "destructive operations", click to run it
   anyway. It only replaces access rules; it never deletes data.
5. At the bottom you should see: **Ready. The coach login is linked.**
   If it says no login exists, do Step 3, then click **Run** again.

## Step 5. Email alerts

1. Go to **resend.com** and sign up with **info@concrete-surfers.com**.
   It has to be this address: on the free plan, without setting up your domain,
   Resend only sends to the address you signed up with. That's exactly what we need.
2. Open **API Keys**, click **Create API key**. Name: `desk`. Permission:
   **Sending access**. Click **Add**.
3. Copy the key (it starts with `re_`). It is shown only once. Don't send it to me;
   you paste it into Supabase in the next step.

## Step 6. The intake function

This is the small program the website forms send to.

1. In Supabase, open **Edge Functions**, click **Deploy a new function**, then
   **Via Editor**.
2. Name it exactly `intake`.
3. Delete the example code. Open `desk/supabase/functions/intake/index.ts` on
   GitHub (same branch as Step 4), click **Copy raw file**, paste it in.
4. Click **Deploy function**.
5. Open the function's **Details** (or **Settings**) and switch **off**
   **Verify JWT** / **Enforce JWT verification**. Save. (The website has no key,
   so it must be allowed to call this function without one. The function itself
   only accepts enquiries.)
6. Open **Edge Functions**, then **Secrets**, and add three:
   - `RESEND_API_KEY`: the key from Step 5
   - `ALERT_EMAIL`: `info@concrete-surfers.com`
   - `DESK_URL`: leave for now, you add it after Step 7

## Step 7. Put the desk online

Wait until I tell you I've connected the desk to your database (after Step 1).

1. Go to **app.netlify.com** (same account as the website).
2. **Add new project**, then **Import an existing project**, then **GitHub**,
   then pick **coach-vasco**.
3. Branch to deploy: `claude/concrete-surfers-website-avpp00`
   (later, once it's merged, `main`).
4. **Base directory**: `desk`. Leave everything else as it is. Click **Deploy**.
5. When it's done, open **Project configuration**, then **Change project name**,
   and call it something like `cs-desk`. Your desk is now at
   `https://cs-desk.netlify.app`.
6. **Send me that address.** Then go back to Supabase, Step 6.6, and add the
   secret `DESK_URL` with that address.

## Step 8. Test it

1. On your phone, open the website and send a Snapshot request with a second
   email address of yours (a Gmail works) and a real YouTube or Drive link.
2. Within a minute you should get an email: "New Snapshot: …".
3. Open the desk, sign in, open the Snapshot, mark the clip received, fill in
   the form, press **Publish and create the link**, and open the link.

Tell me what felt wrong. Nothing else gets built until you've done this.

---

## Things to know

**The database goes to sleep after 7 days without use.** A small scheduled job
(`.github/workflows/keep-awake.yml`) checks the Snapshot count twice a week
to keep it awake. It only runs once this work is merged into `main` on GitHub.
Website visitors also keep it awake. If it ever does fall asleep, open the
project in Supabase and click **Restore**; nothing is lost.

**There are no automatic backups on the free plan.** Use **Download a backup**
at the bottom of the inbox now and then, and keep the file somewhere safe.
It contains personal data, so not in a shared folder.

**Netlify's free plan has a monthly allowance (300 credits).** Each time a site
updates it uses 15, and the website and desk share the allowance. If it runs
out, every site on the account goes offline until the next month. The desk only
rebuilds when something in the `desk` folder changes. Check the usage under
**Team settings, Billing** from time to time.

**Forgot your password?** In Supabase, open **SQL Editor** and run, with your new
password in place of the example:

    update auth.users
    set encrypted_password = extensions.crypt('your-new-password', extensions.gen_salt('bf'))
    where email = 'info@concrete-surfers.com';

**If the desk can't be reached**, the website forms fall back to Netlify Forms, so
no enquiry is lost. Those land in Netlify under **Forms**.

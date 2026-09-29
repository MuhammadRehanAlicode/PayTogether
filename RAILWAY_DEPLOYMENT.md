# Deploy PayTogether to Railway

This repository is configured for Railway with the root `Dockerfile`. Keep the
repository layout unchanged when pushing to GitHub: the application must remain
in the `pay1` folder.

1. Push the **contents of `E:\PayTogether-final`** to a new GitHub repository.
   The included `.gitignore` keeps `myenv`, `.env`, SQLite data, uploaded media,
   and generated static files out of GitHub.
2. In Railway, create a project and select **Deploy from GitHub repo**.
3. Add a **PostgreSQL** service to the same Railway project.
4. Open the web service's **Variables** and add:

   ```text
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   SECRET_KEY=<a long, random private value>
   DEBUG=False
   ALLOWED_HOSTS=.railway.app
   ```

   Railway provides `PORT` automatically. Replace `Postgres` in the reference
   if you rename the PostgreSQL service. After generating a Railway domain or
   adding a custom domain, add its full HTTPS URL to `CSRF_TRUSTED_ORIGINS` only
   if Django reports a CSRF origin error, for example:

   ```text
   CSRF_TRUSTED_ORIGINS=https://your-app.up.railway.app,https://example.com
   ```

5. Deploy. The Docker startup command applies Django migrations, then starts
   Gunicorn on Railway's assigned port. In the service Settings > Networking,
   click **Generate Domain** to make the site public.

## Important production note

Railway's application filesystem is ephemeral. Database records are stored in
PostgreSQL, but user-uploaded profile and tour images are not persistent with
this setup. Use persistent object storage (such as S3/Cloudinary) before
relying on uploads in production.

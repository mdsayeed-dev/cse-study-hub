# CSE Study Hub 2.0

A Google-Drive-style public class resource site.

## Included
- Public folder/file browser
- Search + folder filter
- File counts and storage summary
- Responsive mobile UI
- Admin password login
- Upload a complete folder or multiple files
- Preserve folder paths
- Delete files
- Download files

## Run
Install Node.js, then:

npm install

Windows PowerShell:
$env:ADMIN_PASSWORD="your-strong-password"
npm start

Linux/macOS:
export ADMIN_PASSWORD="your-strong-password"
npm start

Open http://localhost:3000

## Production
This starter uses local disk. For a permanent public site, connect object storage such as Cloudflare R2, Supabase Storage or Amazon S3. Set ADMIN_PASSWORD in the hosting provider's environment variables.

Do not use the default password "change-me" in production.

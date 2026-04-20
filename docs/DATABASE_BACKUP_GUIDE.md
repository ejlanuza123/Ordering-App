# Manual Database Backup Guide

This guide explains how to create a full manual backup of the Supabase PostgreSQL database and how to restore it later on another PostgreSQL server.

## Quick Reference

Use the shell that matches your terminal:

- PowerShell: commands start with `&` when using the full executable path.
- Command Prompt (cmd): use the command directly.

If `pg_dump` is already on your Windows `PATH`, you can use the shorter commands shown below.

## Add `pg_dump` to your PATH

This lets you run `pg_dump`, `pg_restore`, and `psql` directly instead of typing the full path every time.

### Permanent setup in Windows

1. Open Start and search for `Environment Variables`.
2. Open `Edit the system environment variables`.
3. Click `Environment Variables...`.
4. Under `System variables` or `User variables`, select `Path` and click `Edit`.
5. Click `New` and add this folder:

```text
C:\Program Files\PostgreSQL\17\bin
```

6. Click `OK` on all dialogs.
7. Close and reopen PowerShell or Command Prompt.

### Temporary setup for the current PowerShell session

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
```

### Temporary setup for the current Command Prompt session

```cmd
set PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin
```

## What you need

- A PostgreSQL client installed on Windows (`pg_dump.exe` and `psql.exe`)
- Your Supabase database password
- Network access to the Supabase pooler host

For this project, the IPv4 pooler connection details are:

- Host: `aws-1-ap-south-1.pooler.supabase.com`
- Port: `5432`
- Database: `postgres`
- User: `postgres.etypzzzobbacpvwvjhuf`

Use the database password from the Supabase dashboard. Do not use the anon key.

## 1. Full backup as a `.dump` file

This is the recommended format because it is easier to restore with `pg_restore`.

If `pg_dump` is already added to your Windows `PATH`, you can run it without the full executable path:

```powershell
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fc --no-owner --no-acl -f "C:\Projects\backup.dump"
```

Command Prompt (cmd):

```cmd
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fc --no-owner --no-acl -f "C:\Projects\backup.dump"
```

If you have not refreshed your terminal after installing PostgreSQL, open a new PowerShell or cmd window first. If Windows still cannot find `pg_dump`, use the full path version below.

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  -h aws-1-ap-south-1.pooler.supabase.com `
  -p 5432 `
  -U postgres.etypzzzobbacpvwvjhuf `
  -d postgres `
  -Fc `
  --no-owner `
  --no-acl `
  -f "C:\Projects\backup.dump"
```

When prompted, enter the Supabase database password.

### Verify the dump file

```powershell
Get-Item "C:\Projects\backup.dump"
```

## 2. Full backup as a plain `.sql` file

Use this if you want a human-readable SQL file.

If `pg_dump.exe` is already available in your `PATH`, you can use the shorter command:

```powershell
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fp --no-owner --no-acl -f "C:\Projects\full-backup.sql"
```

Command Prompt (cmd):

```cmd
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fp --no-owner --no-acl -f "C:\Projects\full-backup.sql"
```

If PowerShell or cmd still cannot find `pg_dump`, use the full path version below.

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  -h aws-1-ap-south-1.pooler.supabase.com `
  -p 5432 `
  -U postgres.etypzzzobbacpvwvjhuf `
  -d postgres `
  -Fp `
  --no-owner `
  --no-acl `
  -f "C:\Projects\full-backup.sql"
```

## 3. Schema-only backup (no data)

Use this when you want database structure only (tables, views, functions, triggers, policies) without any row data.

If `pg_dump` is already available in your `PATH`:

```powershell
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres --schema-only --no-owner --no-acl -f "C:\Projects\schema-only.sql"
```

Command Prompt (cmd):

```cmd
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres --schema-only --no-owner --no-acl -f "C:\Projects\schema-only.sql"
```

Full path (PowerShell):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  -h aws-1-ap-south-1.pooler.supabase.com `
  -p 5432 `
  -U postgres.etypzzzobbacpvwvjhuf `
  -d postgres `
  --schema-only `
  --no-owner `
  --no-acl `
  -f "C:\Projects\schema-only.sql"
```

## 4. Restore a `.dump` file

Use `pg_restore` to import a custom-format dump into a local PostgreSQL database.

Use the password for your local PostgreSQL `postgres` user here. This is separate from the Supabase database password.

If `pg_restore` is already available in your `PATH`, you can use the shorter command:

```powershell
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean --if-exists "C:\Projects\backup.dump"
```

Command Prompt (cmd):

```cmd
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean --if-exists "C:\Projects\backup.dump"
```

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -h localhost `
  -p 5432 `
  -U postgres `
  -d postgres `
  --clean `
  --if-exists `
  "C:\Projects\backup.dump"
```

Command Prompt (cmd):

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -h localhost -p 5432 -U postgres -d postgres --clean --if-exists "C:\Projects\backup.dump"
```

### Restore `.dump` directly to Supabase

Use this only if you want to apply the dump to the live Supabase database.

```powershell
pg_restore -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres --no-owner --no-privileges "C:\Projects\backup.dump"
```

Command Prompt (cmd):

```cmd
pg_restore -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres --no-owner --no-privileges "C:\Projects\backup.dump"
```

## 5. Restore a `.sql` file

Use `psql` to import a plain SQL backup.

Use the password for your local PostgreSQL `postgres` user here. This is separate from the Supabase database password.

If `psql` is already available in your `PATH`, you can use the shorter command:

```powershell
psql "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable" -f "C:\Projects\full-backup.sql"
```

Command Prompt (cmd):

```cmd
psql "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable" -f "C:\Projects\full-backup.sql"
```

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable" `
  -f "C:\Projects\full-backup.sql"
```

Command Prompt (cmd):

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql.exe" "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable" -f "C:\Projects\full-backup.sql"
```

### Restore directly to Supabase

Use this only if you want to apply the backup to the live Supabase database.

```powershell
psql "host=aws-1-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.etypzzzobbacpvwvjhuf sslmode=require" -f "C:\Projects\full-backup.sql"
```

Command Prompt (cmd):

```cmd
psql "host=aws-1-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.etypzzzobbacpvwvjhuf sslmode=require" -f "C:\Projects\full-backup.sql"
```

## 6. How to confirm the restore worked

The restore is working if the command finishes without errors and the database contains the expected tables, views, and data.

### Check the exit status

- In PowerShell or cmd, the command should finish normally with no red error text.
- If the terminal returns to the prompt and shows no errors, that is the first sign the restore succeeded.

### Connect and inspect the database

Use `psql` to check whether the expected objects exist:

```powershell
psql "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable"
```

Then run these commands inside `psql`:

```sql
\dt
\dn
\dv
```

If you know a table that should have data, check its row count:

```sql
SELECT COUNT(*) FROM your_table_name;
```

### What to expect

- For a full restore, tables and data should be present.
- For a schema-only restore, the tables and schema objects should exist, but row counts should be zero or the data should be absent.
- If the restore created no objects, failed partway, or the expected rows are missing, check the terminal output for the first error.

## 7. Common problems

### `pg_dump` is not recognized

- Use the full path to `pg_dump.exe`.
- On this machine, PostgreSQL 17 is installed at `C:\Program Files\PostgreSQL\17\bin`.
- That folder also contains `pg_restore.exe` and `psql.exe`.

### `could not translate host name`

- Use the IPv4 pooler host shown above.
- Make sure you are not using the direct DB host if your network does not support IPv6.

### `password authentication failed`

- Double-check the database password from the Supabase dashboard.
- Make sure the username is `postgres.etypzzzobbacpvwvjhuf`.

### `password authentication failed for user "postgres"` when restoring locally

- That error is for the local PostgreSQL server on `localhost`, not Supabase.
- Enter the local `postgres` password you set when PostgreSQL was installed.
- If you do not know the local password, open your local PostgreSQL tool or reset the local `postgres` password before restoring.

### `network is unreachable`

- That usually means the machine cannot reach the IPv6 direct host.
- Use the pooler host instead of the direct database host.

## 8. Recommended backup workflow

1. Create a `.dump` backup for the best restore experience.
2. Keep a `.sql` backup if you want a readable copy.
3. Use a schema-only backup when you need structure only and no data.
4. Store the backup file outside the app repo if possible.
5. Rotate the database password if it was exposed in chat or logs.

## 9. Short version

### Backup to dump

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fc --no-owner --no-acl -f "C:\Projects\backup.dump"
```

### Backup to SQL

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fp --no-owner --no-acl -f "C:\Projects\full-backup.sql"
```

### Backup schema only (no data)

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres --schema-only --no-owner --no-acl -f "C:\Projects\schema-only.sql"
```

## 10. Using a different computer

The backup file path is local to the computer where you run `pg_dump`.

- If you are on another computer, change the output path to a folder that exists on that machine.
- You can save to the current folder, Desktop, Documents, or any writable location.
- The backup file can be copied later to another computer for restore.

### Example using the current folder

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  -h aws-1-ap-south-1.pooler.supabase.com `
  -p 5432 `
  -U postgres.etypzzzobbacpvwvjhuf `
  -d postgres `
  -Fc `
  --no-owner `
  --no-acl `
  -f ".\backup.dump"
```

Command Prompt (cmd):

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fc --no-owner --no-acl -f ".\backup.dump"
```

### Example using the Desktop

```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  -h aws-1-ap-south-1.pooler.supabase.com `
  -p 5432 `
  -U postgres.etypzzzobbacpvwvjhuf `
  -d postgres `
  -Fp `
  --no-owner `
  --no-acl `
  -f "$env:USERPROFILE\Desktop\full-backup.sql"
```

Command Prompt (cmd):

```cmd
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fp --no-owner --no-acl -f "%USERPROFILE%\Desktop\full-backup.sql"
```

### Restore on another computer

Use the file path on the machine where the backup file now exists.

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable" `
  -f "$env:USERPROFILE\Desktop\full-backup.sql"
```

Command Prompt (cmd):

```cmd
"C:\Program Files\PostgreSQL\17\bin\psql.exe" "host=localhost port=5432 dbname=postgres user=postgres sslmode=disable" -f "%USERPROFILE%\Desktop\full-backup.sql"
```

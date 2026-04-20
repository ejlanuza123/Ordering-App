# Local Infra and DB Tools Setup Guide (Windows)

This guide sets up the same tooling used in our previous work:

- Kubernetes tools for local cluster experiments (`kubectl`, `minikube`, `helm`)
- PostgreSQL client tools for backup and restore (`pg_dump`, `psql`, `pg_restore`)

Use this when preparing a new developer machine.

## 1. Prerequisites

- Windows 10/11 with Administrator access
- Internet connection
- At least 8 GB RAM (16 GB recommended)
- At least 20 GB free disk space
- BIOS virtualization enabled (Intel VT-x or AMD-V) for Minikube with VirtualBox

## 2. Install tools with winget

Open PowerShell as Administrator, then run:

```powershell
winget install --id Kubernetes.kubectl -e
winget install --id Helm.Helm -e
winget install --id Kubernetes.minikube -e
winget install --id Oracle.VirtualBox -e
winget install --id PostgreSQL.PostgreSQL.17 -e
```

If a tool is already installed, winget will skip or offer update behavior.

## 3. Restart terminal and verify installs

Close all terminals, open a new PowerShell, and verify:

```powershell
kubectl version --client
helm version
minikube version
pg_dump --version
psql --version
pg_restore --version
```

Expected outcome: each command returns a version number with no "not recognized" error.

## 4. Add PostgreSQL tools to PATH (if needed)

If `pg_dump`, `psql`, or `pg_restore` are not recognized, add this folder to PATH:

```text
C:\Program Files\PostgreSQL\17\bin
```

Permanent setup:

1. Open Start and search for Environment Variables.
2. Open Edit the system environment variables.
3. Select Environment Variables.
4. Under User variables or System variables, edit Path.
5. Add `C:\Program Files\PostgreSQL\17\bin`.
6. Save and reopen terminal.

Temporary setup for current session:

PowerShell:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
```

Command Prompt:

```cmd
set PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin
```

## 5. Important Minikube requirement

If Minikube fails with virtualization errors like `HOST_VIRT_UNAVAILABLE`, enable virtualization in BIOS first.

Typical flow:

1. Reboot and enter BIOS/UEFI.
2. Enable Intel Virtualization Technology (VT-x) or AMD SVM/AMD-V.
3. Save and reboot Windows.
4. Retry Minikube start.

## 6. Start local Kubernetes cluster

```powershell
minikube start --driver=virtualbox
kubectl get nodes
```

Expected outcome: one node in `Ready` status.

## 7. Install local PostgreSQL in Kubernetes with Helm (optional)

Use this when testing restore to a local K8s PostgreSQL instance.

```powershell
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm install local-postgres bitnami/postgresql --set auth.postgresPassword=postgres
kubectl get pods
```

Expected outcome: PostgreSQL pod becomes `Running`.

## 8. Verify DB backup and restore tooling quickly

Use these quick checks to confirm the machine is ready for backup and restore work.

### Check Supabase connectivity

```powershell
Test-NetConnection aws-1-ap-south-1.pooler.supabase.com -Port 5432
```

### Test backup command

```powershell
pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 5432 -U postgres.etypzzzobbacpvwvjhuf -d postgres -Fc --no-owner --no-acl -f "C:\Projects\backup.dump"
```

### Test local restore command

```powershell
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean --if-exists "C:\Projects\backup.dump"
```

Notes:

- Supabase password is used for backup from Supabase.
- Local PostgreSQL password is used when restoring to `localhost`.

## 9. Common issues and fixes

### "command is not recognized"

- Reopen terminal.
- Confirm PATH includes PostgreSQL bin folder.
- Run tool using full path once to verify install.

### `password authentication failed`

- Check whether target is Supabase host or localhost.
- Supabase host uses Supabase DB password.
- `localhost` uses local PostgreSQL password.

### `HOST_VIRT_UNAVAILABLE` in Minikube

- Enable VT-x/AMD-V in BIOS.
- Reboot and retry Minikube.

## 10. Where to continue

- Backup and restore command details: `docs/DATABASE_BACKUP_GUIDE.md`
- Mobile app setup: `docs/MOBILE_DEVELOPER_SETUP_GUIDE.md`

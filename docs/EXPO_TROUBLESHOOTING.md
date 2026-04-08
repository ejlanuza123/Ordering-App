Expo CLI — "Body is unusable: Body has already been read"

Problem

When running `npx expo start -c` you may see an error like:

```
TypeError: Body is unusable: Body has already been read
```

This commonly happens during Expo's dependency "doctor" step (the CLI inspects native module versions) when an HTTP response body is consumed more than once by the CLI or its dependencies (undici). It is often due to a Node/CLI/version mismatch or a transient bug in the doctor code.

Quick workaround

If `npx expo start -c` fails with the above error, you can bypass the doctor step by setting `EXPO_NO_DOCTOR=1` in your environment for that session and restarting the bundler. This is a temporary workaround — it disables the CLI's dependency checks, but it lets the packager start.

Windows (cmd):

```cmd
set EXPO_NO_DOCTOR=1
npx expo start -c
```

PowerShell (session only):

```powershell
$env:EXPO_NO_DOCTOR = '1'
npx expo start -c
```

macOS / Linux / WSL:

```bash
export EXPO_NO_DOCTOR=1
npx expo start -c
```

How to check (retrieve) the `EXPO_NO_DOCTOR` setting

- Windows (cmd):

```cmd
echo %EXPO_NO_DOCTOR%
```

- PowerShell:

```powershell
echo $env:EXPO_NO_DOCTOR
```

- Bash / WSL / macOS:

```bash
echo $EXPO_NO_DOCTOR
```

- From Node (any platform):

```bash
node -e "console.log(process.env.EXPO_NO_DOCTOR || '<not set>')"
```

Persisting the setting (optional)

If you want to keep the workaround across terminal sessions, choose one of these approaches:

- Project-local `.env.local` (recommended for per-project settings):

  1. Create (or edit) `./.env.local` at the project root (`PetronSanPedroApp/.env.local`).
  2. Add:

  ```env
  EXPO_NO_DOCTOR=1
  ```

  The Expo CLI often logs `env: load .env.local` when it reads this file. Keep `.env.local` out of source control (add it to `.gitignore`) if it contains sensitive or environment-specific overrides.

- Persist to your Windows user environment (makes it system-wide for new shells):

```cmd
setx EXPO_NO_DOCTOR 1
```

Note: `setx` requires opening a new terminal session to take effect.

- Add a script to `package.json` (cross-platform, explicit):

```json
"scripts": {
  "start:expo": "cross-env EXPO_NO_DOCTOR=1 expo start -c"
}
```

Then run:

```bash
npm run start:expo
```

Removing / unsetting the variable

- Windows (current cmd session):

```cmd
set EXPO_NO_DOCTOR=
```

- PowerShell (current session):

```powershell
Remove-Item Env:EXPO_NO_DOCTOR
```

- Remove persistent (setx) value:

```cmd
setx EXPO_NO_DOCTOR ""
```

(You can also remove via Windows System Settings → Advanced system settings → Environment Variables.)

Notes & recommendations

- Using `EXPO_NO_DOCTOR=1` is a practical short-term workaround so you can continue development. It suppresses the CLI's dependency checks and does not fix the underlying cause.
- Recommended permanent fixes:
  - Use Node 18 LTS with Expo projects (check with `node -v`). Node 20+ can expose undici/body handling differences.
  - Update the local `expo` package and CLI to the latest compatible versions.
  - If the error persists while using Node 18, capture `EXPO_DEBUG=true` logs and open an issue with the Expo CLI maintainers including the stack trace.

Example diagnostic start (temporary, gives more CLI logs):

```cmd
set EXPO_DEBUG=true
set EXPO_NO_DOCTOR=1
npx expo start -c
```

If you want, I can add a short note or link to this file from the project `README.md` or add a `start:expo` script to `package.json`. 

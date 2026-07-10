# Kyvora Studio Collaboration Testing Guide

Follow these steps to run two independent, concurrent instances of Kyvora Studio on your local machine, allowing you to simulate collaboration, real-time messaging, and shared editing.

---

## Prerequisites

1. **Verify Backend is Running**:
   Ensure the Spring Boot backend is active on port `8080`.
   * The backend should be running in IntelliJ or via the console command.
   * Verify it is listening on port 8080 by checking that `http://localhost:8080/api/v1/auth/login` is reachable.

---

## Launching Two Separate Instances

To open two independent instances of the IDE (each with its own independent session state, user login, and UI configuration), you must pass unique values to the `--user-data-dir` and `--extensions-dir` flags.

Open **two separate terminals** and run the following commands:

### Terminal 1: Launch Kyvora Instance A
```powershell
.\scripts\code.bat --user-data-dir="C:\Users\himanshu vishwakarma\.gemini\antigravity\user-data-a" --extensions-dir="C:\Users\himanshu vishwakarma\.gemini\antigravity\extensions-a"
```


### Terminal 2: Launch Kyvora Instance B
```powershell
.\scripts\code.bat --user-data-dir="C:\Users\himanshu vishwakarma\.gemini\antigravity\user-data-b" --extensions-dir="C:\Users\himanshu vishwakarma\.gemini\antigravity\extensions-b"
```

---

## Step-by-Step Testing Flow

Once both instances of Kyvora Studio are running:

### Step 1: Authentication in Instance A
1. Click the **Collaboration** icon in the sidebar (Kyvora Collaboration Hub).
2. Since you are not signed in, you will see the **Sign In to Kyvora** screen.
3. Click the **"Don't have an account? Sign up"** link.
4. Sign up with a new username (e.g., `user_a`), email, and password.
5. You will see a success toast alert: `"Account created! You can now log in."`.
6. Switch back to the sign-in form, enter `user_a`'s credentials, and click **Login**.
7. You will see a success toast: `"Successfully logged in!"`, and the main hub view will open.

### Step 2: Authentication in Instance B
1. In the second IDE instance, open the **Collaboration Hub**.
2. Click **"Don't have an account? Sign up"** and create a second account (e.g., `user_b`).
3. Log in with `user_b`'s credentials.
4. You will see the `"Successfully logged in!"` toast notification.

### Step 3: Creating a Session in Instance A
1. In **Instance A** (`user_a`), click the **Create Session** input field, give the session a name (e.g., `Kyvora Dev Session`), and click **Create**.
2. A success toast alert will read `"Session created successfully!"`.
3. Under the **Session Info** card, copy the:
   * **Session ID**
   * **Secret Token**

### Step 4: Joining the Session in Instance B
1. In **Instance B** (`user_b`), paste the copied **Session ID** and **Secret Token** into the respective inputs under **Join Session**.
2. Click **Join**.
3. A success toast will read `"Connected to collaboration session!"`.
4. In both instances, you will now see the active participant list update in real-time under the **Participants** list (`user_a` and `user_b`).

### Step 5: Live Chat and Collaboration
1. Go to the **Chat** tab in either instance.
2. Type a message and send it.
3. Observe the message sync instantly in the other instance.

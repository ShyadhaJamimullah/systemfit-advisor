# SystemFit Advisor

SystemFit Advisor helps users check whether their laptop or system is suitable for installing and running a specific software application.

The user provides their system specifications, enters the software they want to install, and the app generates a compatibility analysis using Gemini 2.5 Flash.

## What It Does

SystemFit Advisor analyzes your system details and gives:

* Compatibility flag: **Good**, **Risky**, or **Not Recommended**
* Compatibility score
* Reasons for the recommendation
* Possible risks
* Missing or unclear system details
* Installation advice
* Suggested alternatives
* Downloadable report

## How It Works

1. Choose your operating system: Windows, macOS, or Linux.
2. Copy and run the provided command in your terminal.
3. Paste the command output into the system specifications field.
4. Enter the software you want to install.
5. Optionally add the software download link.
6. Enter your Gemini API key.
7. Click **Analyze**.
8. View the compatibility result and download the report if needed.

## Privacy

SystemFit Advisor uses a BYOK approach, which means **Bring Your Own Key**.

Your Gemini API key is used only for the analysis request. It is not stored by the app.

The app does not require login and does not use a database.

Before submitting system specifications, review the command output and remove anything you do not want to share.

## Run Locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend will run at:

```text
http://127.0.0.1:8000
```

### Frontend

Open a new terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will run at:

```text
http://127.0.0.1:3000
```

Open the frontend URL in your browser and use the app.

## Gemini API Key

To use the app, you need a Gemini API key from Google AI Studio.

Get your key from:

```text
https://aistudio.google.com/app/apikey
```

Do not share your API key publicly or commit it to GitHub.

## Report Export

After analysis, the app allows you to export the result as a report.

The report includes:

* Software name
* Compatibility flag
* Compatibility score
* Summary
* Detected machine profile
* Reasons
* Risks
* Missing or unclear specifications
* Installation advice
* Suggested alternatives
* Confidence level
* Disclaimer

## Disclaimer

SystemFit Advisor provides AI-estimated compatibility guidance. Always verify the final software requirements from the official software documentation before installing.

# SystemFit Advisor

Local-first MVP for checking whether a laptop or system can reliably install a target software package.

## Run The Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Run The Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The Gemini API key is BYOK. It is sent only with the analysis request and is not stored by the frontend or backend.


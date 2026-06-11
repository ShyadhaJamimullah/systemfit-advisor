from __future__ import annotations

import json
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, HttpUrl, field_validator


class AnalyzeRequest(BaseModel):
    gemini_api_key: str = Field(min_length=8)
    system_specs: str = Field(min_length=20, max_length=30000)
    software_name: str = Field(min_length=1, max_length=180)
    download_link: HttpUrl | None = None

    @field_validator("gemini_api_key", "system_specs", "software_name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Required value cannot be blank.")
        return cleaned


class DetectedMachineProfile(BaseModel):
    operating_system: str = "Unknown"
    os_version: str = "Unknown"
    cpu: str = "Unknown"
    architecture: str = "Unknown"
    ram: str = "Unknown"
    storage: str = "Unknown"
    gpu: str = "Unknown"
    other_details: list[str] = Field(default_factory=list)


class Alternative(BaseModel):
    name: str
    type: Literal[
        "Lightweight alternative",
        "Cloud alternative",
        "CLI alternative",
        "Similar software",
        "Other",
    ]
    free_or_paid: Literal["Free", "Paid", "Freemium", "Unknown"]
    open_source: Literal["Yes", "No", "Partially", "Unknown"]
    why_suggested: str
    official_link: HttpUrl | None = None


class AnalysisResult(BaseModel):
    flag: Literal["Good", "Risky", "Not Recommended"]
    flag_color: Literal["green", "yellow", "red"]
    compatibility_score: int = Field(ge=0, le=100)
    summary: str
    detected_machine_profile: DetectedMachineProfile
    reasons: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    missing_or_unclear_specs: list[str] = Field(default_factory=list)
    installation_advice: list[str] = Field(default_factory=list)
    alternatives: list[Alternative] = Field(default_factory=list)
    confidence: Literal["High", "Medium", "Low"]
    disclaimer: str = (
        "AI-estimated result. Verify with official software documentation."
    )


app = FastAPI(title="SystemFit Advisor API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://systemfit-frontend.vercel.app",
        # Add the deployed frontend Vercel URL here.
    ],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResult)
def analyze(payload: AnalyzeRequest) -> AnalysisResult:
    client = genai.Client(api_key=payload.gemini_api_key)

    prompt = f"""
You are SystemFit Advisor, a careful local system compatibility analyst.

Assess whether this system can install and reliably run the requested software.
Use the raw specs exactly as supplied. If information is missing, say so and reduce confidence.

Return only valid JSON matching this schema:
{{
  "flag": "Good" | "Risky" | "Not Recommended",
  "flag_color": "green" | "yellow" | "red",
  "compatibility_score": integer 0-100,
  "summary": string,
  "detected_machine_profile": {{
    "operating_system": string,
    "os_version": string,
    "cpu": string,
    "architecture": string,
    "ram": string,
    "storage": string,
    "gpu": string,
    "other_details": string[]
  }},
  "reasons": string[],
  "risks": string[],
  "missing_or_unclear_specs": string[],
  "installation_advice": string[],
  "alternatives": [
    {{
      "name": string,
      "type": "Lightweight alternative" | "Cloud alternative" | "CLI alternative" | "Similar software" | "Other",
      "free_or_paid": "Free" | "Paid" | "Freemium" | "Unknown",
      "open_source": "Yes" | "No" | "Partially" | "Unknown",
      "why_suggested": string,
      "official_link": string URL or null
    }}
  ],
  "confidence": "High" | "Medium" | "Low",
  "disclaimer": "AI-estimated result. Verify with official software documentation."
}}

Strict scoring rubric:
- Good: score 75-100.
  Use only when the system clearly meets or exceeds the recommended requirements for the requested software.
  The software should be expected to install and run reliably for normal use.
- Risky: score 45-74.
  Use when the system appears to meet minimum requirements but falls below recommended requirements.
  The software may install and run, but performance, multitasking, storage, GPU, virtualization, or stability may be limited.
  Do not mark the result as Not Recommended only because the system is below recommended requirements.
- Not Recommended: score 0-44.
  Use only when the system appears to fail critical minimum requirements, such as an unsupported OS, unsupported architecture, insufficient RAM, insufficient storage, missing required GPU or API support, or another serious blocker.
  Also use when the pasted specifications are too incomplete to make a safe recommendation and the missing information is critical.

Heavy software guidance:
- For common heavy software such as AutoCAD, Android Studio, Docker Desktop, Blender, or game engines, classify the result as Risky rather than Not Recommended when the system meets minimum requirements but not recommended requirements.
- Clearly describe the likely performance, multitasking, storage, GPU, virtualization, or stability limitations.
- Reserve Not Recommended for clear minimum requirement failures or critically incomplete specifications.

Scoring consistency rules:
- The flag and compatibility_score must always agree with the score bands above.
- Keep the flag and score stable and repeatable for the same software, download link, and system specifications.
- Do not vary the score merely to express uncertainty. Reflect uncertainty in confidence and missing_or_unclear_specs instead.

Extraction and response rules:
- Parse the raw terminal output into detected_machine_profile.
- Never guess silently. Use the exact string "Unknown" for any missing profile value.
- Add every missing, ambiguous, conflicting, or unreadable requirement-relevant detail to missing_or_unclear_specs.
- Keep reasons tied to evidence from the machine profile and likely official software requirements.
- Give practical installation advice and useful alternatives when the requested software is risky or unsuitable.
- For every alternative, classify its type, price model, and open-source status. Use "Unknown" when this cannot be established reliably.
- official_link must be an official product or project URL, or null.
- Return JSON only. Do not return markdown, code fences, commentary, or text outside the JSON object.

Software: {payload.software_name}
Download link: {str(payload.download_link) if payload.download_link else "Not provided"}

Raw system specifications:
{payload.system_specs}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini analysis failed. Check the API key, network access, and model availability.",
        ) from exc

    try:
        raw_text = response.text or "{}"
        data = json.loads(raw_text)
        return AnalysisResult.model_validate(data)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an unexpected response format.",
        ) from exc

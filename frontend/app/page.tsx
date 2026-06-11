"use client";

import { FormEvent, useEffect, useState } from "react";

type OperatingSystem = "Windows" | "macOS" | "Linux";
type Flag = "Good" | "Risky" | "Not Recommended";
type FlagColor = "green" | "yellow" | "red";

type DetectedMachineProfile = {
  operating_system: string;
  os_version: string;
  cpu: string;
  architecture: string;
  ram: string;
  storage: string;
  gpu: string;
  other_details: string[];
};

type Alternative = {
  name: string;
  type:
    | "Lightweight alternative"
    | "Cloud alternative"
    | "CLI alternative"
    | "Similar software"
    | "Other";
  free_or_paid: "Free" | "Paid" | "Freemium" | "Unknown";
  open_source: "Yes" | "No" | "Partially" | "Unknown";
  why_suggested: string;
  official_link: string | null;
};

type AnalysisResult = {
  flag: Flag;
  flag_color: FlagColor;
  compatibility_score: number;
  summary: string;
  detected_machine_profile: DetectedMachineProfile;
  reasons: string[];
  risks: string[];
  missing_or_unclear_specs: string[];
  installation_advice: string[];
  alternatives: Alternative[];
  confidence: "High" | "Medium" | "Low";
  disclaimer: string;
};

type FormErrors = Partial<
  Record<"apiKey" | "systemSpecs" | "softwareName" | "downloadLink" | "request", string>
>;

type SessionForm = {
  softwareName: string;
  downloadLink: string;
  systemSpecs: string;
  selectedOs: OperatingSystem;
};

const commands: Record<OperatingSystem, string> = {
  Windows: `Get-ComputerInfo | Select-Object OsName, OsVersion, CsSystemType, CsManufacturer, CsModel, CsProcessors, CsTotalPhysicalMemory, BiosFirmwareType
Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace
Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM`,
  macOS:
    "system_profiler SPSoftwareDataType SPHardwareDataType SPDisplaysDataType SPStorageDataType",
  Linux:
    "uname -a && lscpu && free -h && df -h && lsblk && lspci | grep -Ei 'vga|3d|display'",
};

const operatingSystems = Object.keys(commands) as OperatingSystem[];
const sessionKey = "systemfit-session-form";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function Field({
  id,
  label,
  helper,
  error,
  children,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {children}
      {helper ? <small>{helper}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="result-section">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul className="result-list">
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="result-muted">None identified.</p>
      )}
    </section>
  );
}

function ProfileSection({ profile }: { profile: DetectedMachineProfile }) {
  const details = [
    ["OS", profile.operating_system],
    ["OS version", profile.os_version],
    ["CPU", profile.cpu],
    ["Architecture", profile.architecture],
    ["RAM", profile.ram],
    ["Storage / free space", profile.storage],
    ["GPU", profile.gpu],
  ];

  return (
    <section className="result-section">
      <h3>Detected machine profile</h3>
      <dl className="profile-grid">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "Unknown"}</dd>
          </div>
        ))}
      </dl>
      {profile.other_details.length > 0 ? (
        <div className="profile-other">
          <p className="result-label">Other detected details</p>
          <ul className="result-list">
            {profile.other_details.map((detail, index) => (
              <li key={`${detail}-${index}`}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function AlternativesSection({ alternatives }: { alternatives: Alternative[] }) {
  return (
    <section className="result-section">
      <h3>Suggested alternatives</h3>
      {alternatives.length > 0 ? (
        <div className="alternatives-list">
          {alternatives.map((alternative, index) => (
            <article className="alternative-row" key={`${alternative.name}-${index}`}>
              <div className="alternative-head">
                <h4>{alternative.name}</h4>
                <span>
                  {alternative.free_or_paid} / Open source: {alternative.open_source}
                </span>
              </div>
              <p className="alternative-type">{alternative.type}</p>
              <p>{alternative.why_suggested}</p>
              {alternative.official_link ? (
                <a href={alternative.official_link} rel="noreferrer" target="_blank">
                  Official link
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="result-muted">No alternatives were suggested.</p>
      )}
    </section>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [systemSpecs, setSystemSpecs] = useState("");
  const [softwareName, setSoftwareName] = useState("");
  const [downloadLink, setDownloadLink] = useState("");
  const [selectedOs, setSelectedOs] = useState<OperatingSystem>("Windows");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultTimestamp, setResultTimestamp] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SessionForm>;
        setSoftwareName(parsed.softwareName ?? "");
        setDownloadLink(parsed.downloadLink ?? "");
        setSystemSpecs(parsed.systemSpecs ?? "");
        if (parsed.selectedOs && operatingSystems.includes(parsed.selectedOs)) {
          setSelectedOs(parsed.selectedOs);
        }
      }
    } catch {
      sessionStorage.removeItem(sessionKey);
    } finally {
      setSessionReady(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    const sessionForm: SessionForm = {
      softwareName,
      downloadLink,
      systemSpecs,
      selectedOs,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionForm));
  }, [downloadLink, selectedOs, sessionReady, softwareName, systemSpecs]);

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!apiKey.trim()) {
      nextErrors.apiKey = "Please enter your Gemini API key.";
    }
    if (!softwareName.trim()) {
      nextErrors.softwareName = "Please enter the software you want to install.";
    }
    if (!systemSpecs.trim()) {
      nextErrors.systemSpecs = "Please paste your system specifications.";
    }
    if (downloadLink.trim()) {
      try {
        const parsedUrl = new URL(downloadLink.trim());
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          nextErrors.downloadLink = "Please enter a valid HTTP or HTTPS URL.";
        }
      } catch {
        nextErrors.downloadLink = "Please enter a valid download URL.";
      }
    }

    return nextErrors;
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(commands[selectedOs]);
      setCopyStatus("copied");
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = commands[selectedOs];
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      const copied = document.execCommand("copy");
      fallback.remove();
      setCopyStatus(copied ? "copied" : "failed");
    }

    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);

    try {
      const response = await fetch(`${apiBase}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gemini_api_key: apiKey,
          system_specs: systemSpecs.trim(),
          software_name: softwareName.trim(),
          download_link: downloadLink.trim() || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const detail =
          typeof payload.detail === "string"
            ? payload.detail
            : "Analysis failed. Check the submitted values and try again.";
        throw new Error(detail);
      }

      setResult(payload as AnalysisResult);
      setResultTimestamp(new Date().toISOString());
      setErrors({});
    } catch (caught) {
      setErrors({
        request: caught instanceof Error ? caught.message : "Analysis failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  function clearForm() {
    setSoftwareName("");
    setDownloadLink("");
    setSystemSpecs("");
    setResult(null);
    setResultTimestamp("");
    setErrors({});
  }

  function downloadResult() {
    if (!result) return;

    const safeSoftwareName =
      softwareName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "software";
    const exportPayload = {
      software_name: softwareName.trim(),
      download_link: downloadLink.trim() || null,
      timestamp: resultTimestamp || new Date().toISOString(),
      analysis: result,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `systemfit-analysis-${safeSoftwareName}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <header className="top-nav">
        <span className="wordmark">SYSTEMFIT ADVISOR</span>
      </header>

      <section className="advisor-shell">
        <div className="input-stack">
          <div className="intro">
            <p className="caption">LOCAL-FIRST COMPATIBILITY ENGINE</p>
            <h1>SYSTEM COMPATIBILITY ANALYSIS</h1>
            <p>
              Paste the machine profile, name the software, and receive a sober
              installation verdict: good, risky, or not recommended.
            </p>
          </div>

          <section className="command-section" aria-labelledby="command-title">
            <div className="section-title">
              <p className="caption">SPECIFICATION COMMANDS</p>
              <h2 id="command-title">Collect The Machine Profile</h2>
            </div>
            <div className="command-tabs" role="tablist" aria-label="Operating system">
              {operatingSystems.map((os) => (
                <button
                  aria-selected={selectedOs === os}
                  className={selectedOs === os ? "command-tab active" : "command-tab"}
                  key={os}
                  onClick={() => {
                    setSelectedOs(os);
                    setCopyStatus("idle");
                  }}
                  role="tab"
                  type="button"
                >
                  {os}
                </button>
              ))}
            </div>
            <div className="command-panel" role="tabpanel">
              <pre>
                <code>{commands[selectedOs]}</code>
              </pre>
              <button className="text-button" onClick={copyCommand} type="button">
                {copyStatus === "copied"
                  ? "Copied"
                  : copyStatus === "failed"
                    ? "Copy failed"
                    : "Copy command"}
              </button>
            </div>
          </section>

          <form className="analysis-form" noValidate onSubmit={handleSubmit}>
            <div className="section-title">
              <p className="caption">REQUEST</p>
              <h2>Analyze Installation Fit</h2>
            </div>

            <Field
              error={errors.apiKey}
              helper="Your API key is only used for this request and is not stored."
              id="api-key"
              label="Gemini API key"
            >
              <div className="input-with-action">
                <input
                  aria-invalid={Boolean(errors.apiKey)}
                  autoComplete="off"
                  id="api-key"
                  name="api-key"
                  onChange={(event) => setApiKey(event.target.value)}
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                />
                <button
                  aria-label={showApiKey ? "Hide Gemini API key" : "Show Gemini API key"}
                  className="input-action"
                  onClick={() => setShowApiKey((current) => !current)}
                  type="button"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            <div className="form-grid">
              <Field
                error={errors.softwareName}
                id="software"
                label="Software name"
              >
                <input
                  aria-invalid={Boolean(errors.softwareName)}
                  id="software"
                  name="software"
                  onChange={(event) => setSoftwareName(event.target.value)}
                  value={softwareName}
                />
              </Field>

              <Field
                error={errors.downloadLink}
                id="download-link"
                label="Optional download link"
              >
                <input
                  aria-invalid={Boolean(errors.downloadLink)}
                  id="download-link"
                  name="download-link"
                  onChange={(event) => setDownloadLink(event.target.value)}
                  type="url"
                  value={downloadLink}
                />
              </Field>
            </div>

            <Field
              error={errors.systemSpecs}
              helper="Review the command output before submitting and remove anything you do not wish to share."
              id="system-specs"
              label="System specifications"
            >
              <textarea
                aria-invalid={Boolean(errors.systemSpecs)}
                id="system-specs"
                name="system-specs"
                onChange={(event) => setSystemSpecs(event.target.value)}
                placeholder="Paste raw terminal output here."
                rows={12}
                value={systemSpecs}
              />
            </Field>

            {errors.request ? <p className="error">{errors.request}</p> : null}

            <div className="form-actions">
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? "ANALYZING..." : "ANALYZE"}
              </button>
              <button
                className="secondary-button"
                disabled={loading}
                onClick={clearForm}
                type="button"
              >
                CLEAR
              </button>
            </div>
          </form>
        </div>

        <aside className="result-panel" aria-busy={loading} aria-live="polite">
          {loading ? (
            <div className="result-state">
              <p className="caption">ANALYSIS IN PROGRESS</p>
              <h2>Analyzing...</h2>
              <p>
                Analyzing machine profile, software requirements, and possible
                alternatives...
              </p>
              <div className="loading-line" aria-hidden="true" />
            </div>
          ) : result ? (
            <div className="completed-result">
              <div className="result-head">
                <div>
                  <p className="caption">ANALYSIS RESULT</p>
                  <h2>{result.flag.toUpperCase()}</h2>
                </div>
                <div className={`score score-${result.flag_color}`}>
                  <span>{result.compatibility_score}</span>
                  <small>/ 100</small>
                </div>
              </div>

              <section className="result-section summary-section">
                <h3>Summary</h3>
                <p>{result.summary}</p>
              </section>
              <ProfileSection profile={result.detected_machine_profile} />
              <ResultList items={result.reasons} title="Reasons" />
              <ResultList items={result.risks} title="Risks" />
              <ResultList
                items={result.missing_or_unclear_specs}
                title="Missing or unclear specs"
              />
              <ResultList
                items={result.installation_advice}
                title="Installation advice"
              />
              <AlternativesSection alternatives={result.alternatives} />

              <section className="result-meta">
                <div>
                  <span>Confidence</span>
                  <p>{result.confidence}</p>
                </div>
                <div>
                  <span>Disclaimer</span>
                  <p>{result.disclaimer}</p>
                </div>
              </section>

              <button className="secondary-button download-button" onClick={downloadResult}>
                DOWNLOAD RESULT
              </button>
            </div>
          ) : (
            <div className="result-state empty-state">
              <p className="caption">OUTPUT</p>
              <h2>Result</h2>
              <p>
                Your compatibility analysis will appear here after you submit a
                machine profile and software name.
              </p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

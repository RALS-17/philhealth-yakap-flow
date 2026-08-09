import { useState } from 'react'

type EntryType = 'outpatient' | 'walkin' | 'er' | null
type Screen = 1 | 2 | 3 | 4
type ResultView =
  | 'admitted'
  | 'oecb'
  | 'yakap'
  | 'cancer'
  | 'cancer-abnormal'
  | 'cancer-qualified'
  | 'referral'
  | null

type BranchView = 'er-triage' | 'outpatient' | 'walkin' | null

function PathBreadcrumb({ path }: { path: string[] }) {
  return (
    <div className="path">
      {path.map((p, i) => (
        <span key={`${p}-${i}`}>
          {i > 0 && <span className="sep"> → </span>}
          <span>{p}</span>
        </span>
      ))}
    </div>
  )
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="progress-wrap">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`progress-dot ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}
        />
      ))}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(1)
  const [path, setPath] = useState<string[]>(['Start'])
  const [entryType, setEntryType] = useState<EntryType>(null)
  const [branchView, setBranchView] = useState<BranchView>(null)
  const [resultView, setResultView] = useState<ResultView>(null)
  const [yakapFromEr, setYakapFromEr] = useState(false)

  const goBack = () => {
    if (screen === 1) return
    if (screen === 2) {
      setScreen(1)
      setPath(['Start'])
      setEntryType(null)
    } else if (screen === 3) {
      setScreen(2)
      setPath((p) => p.slice(0, 2))
      setBranchView(null)
    } else if (screen === 4) {
      // If deep in cancer results, go back to cancer choice or previous
      if (resultView === 'cancer-abnormal' || resultView === 'cancer-qualified') {
        setResultView('cancer')
        setPath((p) => {
          const idx = p.findIndex((x) => x.includes('Cancer') || x.includes('Abnormal') || x.includes('Z-Benefit'))
          return idx > 0 ? p.slice(0, idx + 1) : p.slice(0, -1)
        })
        return
      }
      setScreen(3)
      setPath((p) => p.slice(0, 3))
      setResultView(null)
      setYakapFromEr(false)
    }
  }

  const restart = () => {
    setScreen(1)
    setPath(['Start'])
    setEntryType(null)
    setBranchView(null)
    setResultView(null)
    setYakapFromEr(false)
  }

  const selectEntry = (type: EntryType) => {
    if (!type) return
    const labels: Record<string, string> = {
      outpatient: 'Outpatient',
      walkin: 'Walk-in (Non-Emergency)',
      er: 'Emergency Room (ER)',
    }
    setEntryType(type)
    setPath(['Start', labels[type]])
    setScreen(2)
  }

  const goToERTriage = () => {
    setPath((p) => [...p, 'ER Triage'])
    setBranchView('er-triage')
    setScreen(3)
  }

  const goToOutpatient = () => {
    setPath((p) => [...p, 'YAKAP Doctor Consultation'])
    setBranchView('outpatient')
    setScreen(3)
  }

  const goToWalkin = () => {
    setPath((p) => [...p, 'Assessment by YAKAP Doctor'])
    setBranchView('walkin')
    setScreen(3)
  }

  const selectTriage = (level: string) => {
    if (level === 'l5') {
      setPath((p) => [...p, 'Level 5 → YAKAP'])
      setYakapFromEr(true)
      setResultView('yakap')
    } else if (level === 'oecb') {
      setPath((p) => [...p, 'OECB Benefits'])
      setResultView('oecb')
    } else {
      const names: Record<string, string> = {
        l1: 'Level 1 – Resuscitation',
        l2: 'Level 2 – Emergency',
        l3: 'Level 3 – Urgent',
        l4: 'Level 4 – Less Urgent',
      }
      setPath((p) => [...p, names[level]])
      setResultView('admitted')
    }
    setScreen(4)
  }

  const selectYakapPath = (type: 'standard' | 'cancer' | 'referral') => {
    if (type === 'standard') {
      setPath((p) => [...p, 'YAKAP PHIC Benefits'])
      setYakapFromEr(false)
      setResultView('yakap')
    } else if (type === 'cancer') {
      setPath((p) => [...p, 'YAKAP Cancer Screening'])
      setResultView('cancer')
    } else {
      setPath((p) => [...p, 'Referral'])
      setResultView('referral')
    }
    setScreen(4)
  }

  const showCancerFromYakap = () => {
    setPath((p) => [...p, 'Cancer Screening Check'])
    setResultView('cancer')
  }

  const showCancerAbnormal = () => {
    setPath((p) => [...p, 'Abnormal → Oncology'])
    setResultView('cancer-abnormal')
  }

  const showCancerQualified = () => {
    setPath((p) => [...p, 'Z-Benefit Package'])
    setResultView('cancer-qualified')
  }

  // ---------- RENDER HELPERS ----------

  const renderScreen1 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">1. Patient Entry Points</div>
      <p className="section-desc">Select how the patient arrived at Global Care Medical Center.</p>
      <div className="card-grid">
        <button className="choice-card" onClick={() => selectEntry('outpatient')}>
          <div className="icon">👥</div>
          <h3>Outpatient</h3>
          <p>Scheduled or referred patients</p>
          <ul>
            <li>Scheduled Appointment</li>
            <li>Referred / Walk-in</li>
          </ul>
        </button>
        <button className="choice-card green-card" onClick={() => selectEntry('walkin')}>
          <div className="icon">🚶</div>
          <h3>Walk-in Patients</h3>
          <p>Non-emergency clinic visits</p>
          <ul>
            <li>Direct to Clinic</li>
            <li>Non-Emergency Concerns</li>
          </ul>
        </button>
        <button className="choice-card er-card" onClick={() => selectEntry('er')}>
          <div className="icon">🚑</div>
          <h3>Emergency Room (ER)</h3>
          <p>Acute or life-threatening conditions</p>
          <ul>
            <li>Acute Illness / Injury</li>
            <li>Life-threatening Conditions</li>
          </ul>
        </button>
      </div>
    </div>
  )

  const renderScreen2 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">2. PhilHealth Benefits Navigator Assistance</div>
      <p className="section-desc">
        The Navigator greets, verifies eligibility, and determines the applicable benefit.
      </p>
      <div className="navigator-panel">
        <h3>🧭 PhilHealth Benefits Navigator</h3>
        <ul className="navigator-list">
          <li>
            <span>✓</span> Greet & assist patient
          </li>
          <li>
            <span>✓</span> Verify PhilHealth membership and eligibility
          </li>
          <li>
            <span>✓</span> Assess patient’s condition and purpose of visit
          </li>
          <li>
            <span>✓</span> Determine applicable PhilHealth benefit/s
          </li>
          <li>
            <span>✓</span> Provide guidance and orientation
          </li>
        </ul>
      </div>
      <p className="section-desc" style={{ marginTop: 8 }}>
        Which path applies based on the entry point?
      </p>
      <div className="card-grid">
        {entryType === 'er' && (
          <button className="choice-card er-card" onClick={goToERTriage}>
            <div className="icon">🚨</div>
            <h3>Proceed to ER Triage</h3>
            <p>5-level triage & benefit determination (Section 3A)</p>
          </button>
        )}
        {entryType === 'outpatient' && (
          <button className="choice-card green-card" onClick={goToOutpatient}>
            <div className="icon">🩺</div>
            <h3>YAKAP Doctor Consultation</h3>
            <p>Clinical assessment & YAKAP benefits (Section 3B)</p>
          </button>
        )}
        {entryType === 'walkin' && (
          <button className="choice-card green-card" onClick={goToWalkin}>
            <div className="icon">🩺</div>
            <h3>Assessment by YAKAP Doctor</h3>
            <p>Clinical assessment & YAKAP benefits (Section 3C)</p>
          </button>
        )}
      </div>
      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
      </div>
    </div>
  )

  const renderScreen3 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      {branchView === 'er-triage' && (
        <>
          <div className="section-title">3A. For ER Patients – Triage & Benefit Determination</div>
          <p className="section-desc">Select the triage level assigned to the patient.</p>
          <div className="card-grid">
            <button className="choice-card er-card" onClick={() => selectTriage('l1')}>
              <span className="level-badge l1">LEVEL 1</span>
              <h3>Resuscitation</h3>
              <p>Immediate life-saving intervention</p>
            </button>
            <button className="choice-card er-card" onClick={() => selectTriage('l2')}>
              <span className="level-badge l2">LEVEL 2</span>
              <h3>Emergency</h3>
              <p>High risk, needs rapid care</p>
            </button>
            <button className="choice-card" onClick={() => selectTriage('l3')}>
              <span className="level-badge l3">LEVEL 3</span>
              <h3>Urgent</h3>
              <p>Needs prompt attention</p>
            </button>
            <button className="choice-card" onClick={() => selectTriage('l4')}>
              <span className="level-badge l4">LEVEL 4</span>
              <h3>Less Urgent</h3>
              <p>Can wait short period</p>
            </button>
            <button className="choice-card" onClick={() => selectTriage('l5')}>
              <span className="level-badge l5">LEVEL 5</span>
              <h3>Non-Urgent</h3>
              <p>Endorsed to YAKAP Doctor</p>
            </button>
            <button className="choice-card" onClick={() => selectTriage('oecb')}>
              <div className="icon">📋</div>
              <h3>27 Emergency Symptoms</h3>
              <p>Use OECB Benefits (not admitted)</p>
            </button>
          </div>
        </>
      )}
      {(branchView === 'outpatient' || branchView === 'walkin') && (
        <>
          <div className="section-title">
            {branchView === 'outpatient'
              ? '3B. For Outpatients – YAKAP Doctor Consultation'
              : '3C. For Walk-in (Non-Emergency)'}
          </div>
          <p className="section-desc">
            {branchView === 'outpatient'
              ? 'Clinical assessment and determination of needed YAKAP services.'
              : 'Assessment by YAKAP Doctor – determine needed services.'}
          </p>
          <div className="card-grid">
            <button className="choice-card green-card" onClick={() => selectYakapPath('standard')}>
              <div className="icon">💚</div>
              <h3>Standard YAKAP Benefits</h3>
              <p>Consultation · Diagnostics · YAKAP Gamot</p>
            </button>
            <button className="choice-card" onClick={() => selectYakapPath('cancer')}>
              <div className="icon">🎗️</div>
              <h3>Eligible for Cancer Screening</h3>
              <p>History or meets eligibility criteria</p>
            </button>
            <button className="choice-card" onClick={() => selectYakapPath('referral')}>
              <div className="icon">🔗</div>
              <h3>Needs Referral</h3>
              <p>Higher level or specialty care</p>
            </button>
          </div>
        </>
      )}
      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
      </div>
    </div>
  )

  const renderResult = () => {
    if (resultView === 'admitted') {
      return (
        <>
          <div className="result-header red">
            <h2>Admitted – Apply PhilHealth Benefits</h2>
            <p>After ER management and evaluation (Levels 1–4)</p>
            <div className="badge">Inpatient / Case Rate Pathway</div>
          </div>
          <div className="section-label">PhilHealth benefits to apply</div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">📄</div>
              <div>
                <h4>No Balance Billing (NBB) Policy</h4>
                <p>As applicable for qualified members in basic/ward accommodation.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">🏥</div>
              <div>
                <h4>All Case Rate (ACR) / PHIC Package</h4>
                <p>Case rate based on final diagnosis and procedures performed.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">📦</div>
              <div>
                <h4>Other Applicable PhilHealth Package</h4>
                <p>Z-Benefits, special packages, or other benefits as indicated.</p>
              </div>
            </div>
          </div>
          <div className="note-box amber">
            <strong>Continuity of Care:</strong> After discharge, coordinate follow-up
            appointments, result monitoring, treatment continuity, and case management support
            with PhilHealth & Z-Benefit coordination assistance.
          </div>
        </>
      )
    }

    if (resultView === 'oecb') {
      return (
        <>
          <div className="result-header teal">
            <h2>Outpatient Emergency Care Benefit (OECB)</h2>
            <p>
              27 Emergency Symptoms (PhilHealth Circular No. 2024-0027) – Patient will{' '}
              <strong>NOT</strong> be admitted
            </p>
            <div className="badge">ER Outpatient · No Admission</div>
          </div>
          <div className="section-label">OECB covers</div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">🚑</div>
              <div>
                <h4>Emergency Department Care</h4>
                <p>Treatment at accredited Level 1–3 hospital ER without admission.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">💊</div>
              <div>
                <h4>Medicines & Supplies</h4>
                <p>Used during the ER stay for the listed emergency symptoms.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">🔬</div>
              <div>
                <h4>Diagnostics</h4>
                <p>Labs and imaging needed for emergency management.</p>
              </div>
            </div>
          </div>
          <div className="note-box blue">
            Based on PhilHealth’s list of 27 emergency symptoms. Patient is treated and
            discharged within 24 hours.
          </div>
        </>
      )
    }

    if (resultView === 'yakap') {
      return (
        <>
          <div className="result-header green">
            <h2>
              {yakapFromEr
                ? 'YAKAP PHIC Benefits (from ER Level 5)'
                : 'YAKAP PHIC Benefits'}
            </h2>
            <p>Primary care benefits under the YAKAP program</p>
            <div className="badge">YAKAP · Primary Care</div>
          </div>
          <div className="section-label">Covered services</div>
          <div className="component-list">
            <div className="component-card green">
              <div className="comp-icon">👨‍⚕️</div>
              <div>
                <h4>Consultation</h4>
                <p>Clinical assessment and management by YAKAP doctor.</p>
              </div>
            </div>
            <div className="component-card green">
              <div className="comp-icon">🔬</div>
              <div>
                <h4>Diagnostic Tests</h4>
                <p>CBC, urinalysis, FBS, lipid profile, chest X-ray, and other YAKAP labs.</p>
              </div>
            </div>
            <div className="component-card green">
              <div className="comp-icon">💊</div>
              <div>
                <h4>YAKAP Gamot (Medicines)</h4>
                <p>Essential outpatient medicines under the GAMOT benefit (up to annual cap).</p>
              </div>
            </div>
            <div className="component-card green">
              <div className="comp-icon">📚</div>
              <div>
                <h4>Health Education</h4>
                <p>Counseling, lifestyle advice, and patient education.</p>
              </div>
            </div>
          </div>
          <div className="note-box green">
            <strong>Next step:</strong> If patient has history or meets eligibility for cancer
            screening, proceed to YAKAP Cancer Screening Program. Otherwise, schedule follow-up
            as needed (Continuity of Care).
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-green" onClick={showCancerFromYakap}>
              Check Cancer Screening Eligibility →
            </button>
          </div>
        </>
      )
    }

    if (resultView === 'cancer') {
      return (
        <>
          <div className="result-header purple">
            <h2>YAKAP Cancer Screening Program</h2>
            <p>Screening as per DOH / PhilHealth Guide · Results release and explanation</p>
            <div className="badge">YAKAP · Cancer Screening</div>
          </div>
          <div className="section-label">Outcome of screening</div>
          <div className="card-grid">
            <button className="choice-card" onClick={showCancerAbnormal}>
              <div className="icon">⚠️</div>
              <h3>Abnormal Result</h3>
              <p>Endorse to Oncology Clinic for Assessment & Evaluation</p>
            </button>
            <button className="choice-card green-card" onClick={showCancerQualified}>
              <div className="icon">💜</div>
              <h3>Qualified Patient</h3>
              <p>Apply for Z-Benefit Package (Cancer Patients)</p>
            </button>
          </div>
          <div className="note-box blue" style={{ marginTop: 14 }}>
            Screening follows DOH/PhilHealth guidelines. Navigator supports results explanation
            and next steps.
          </div>
        </>
      )
    }

    if (resultView === 'cancer-abnormal') {
      return (
        <>
          <div className="result-header purple">
            <h2>Abnormal Result – Oncology Referral</h2>
            <p>Endorsed to Oncology Clinic for Assessment & Evaluation</p>
            <div className="badge">Referral Pathway</div>
          </div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">🏥</div>
              <div>
                <h4>Oncology Clinic Assessment</h4>
                <p>Specialist evaluation of abnormal screening findings.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">📋</div>
              <div>
                <h4>Further Diagnostics & Planning</h4>
                <p>As determined by the oncology team.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">💜</div>
              <div>
                <h4>Possible Z-Benefit Pathway</h4>
                <p>If confirmed cancer and patient qualifies, apply for Z-Benefit Package.</p>
              </div>
            </div>
          </div>
          <div className="note-box amber">
            Continuity of care and PhilHealth coordination assistance remain available
            throughout.
          </div>
        </>
      )
    }

    if (resultView === 'cancer-qualified') {
      return (
        <>
          <div className="result-header purple">
            <h2>Z-Benefit Package (Cancer Patients)</h2>
            <p>Qualified patient – apply for the corresponding Z-Benefit</p>
            <div className="badge">Z-Benefit · Catastrophic</div>
          </div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">💜</div>
              <div>
                <h4>Z-Benefit Application</h4>
                <p>Submit requirements for the specific cancer Z-package.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">🏥</div>
              <div>
                <h4>Treatment at Accredited Facility</h4>
                <p>Care delivered according to PhilHealth Z-Benefit guidelines.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">🤝</div>
              <div>
                <h4>Case Management Support</h4>
                <p>PhilHealth & facility coordination for continuity of care.</p>
              </div>
            </div>
          </div>
          <div className="note-box green">
            Navigator and case managers assist with documentation and follow-up.
          </div>
        </>
      )
    }

    if (resultView === 'referral') {
      return (
        <>
          <div className="result-header blue">
            <h2>Referral to Higher Level / Specialty Care</h2>
            <p>YAKAP doctor determined need for referral</p>
            <div className="badge">Referral Pathway</div>
          </div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">🔗</div>
              <div>
                <h4>Referral Letter & Coordination</h4>
                <p>Clear endorsement to appropriate specialty or higher facility.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">📋</div>
              <div>
                <h4>PhilHealth Benefit Guidance</h4>
                <p>Navigator advises on applicable packages at the receiving facility.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">📅</div>
              <div>
                <h4>Continuity of Care</h4>
                <p>Follow-up linkage back to Global Care / YAKAP when appropriate.</p>
              </div>
            </div>
          </div>
          <div className="note-box blue">
            Patient education on rights, responsibilities, and next steps is provided by the
            Navigator.
          </div>
        </>
      )
    }

    return null
  }

  const renderScreen4 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      {renderResult()}
      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
        <button className="btn btn-primary" onClick={restart}>
          New Patient
        </button>
      </div>
      <div className="reminders">
        <h4>Key Reminders</h4>
        <ul>
          <li>Always present your valid PhilHealth ID.</li>
          <li>Inform the staff if you are a senior citizen, PWD, or indigent.</li>
          <li>Benefits are subject to PhilHealth guidelines and eligibility.</li>
          <li>Ask the PhilHealth Benefits Navigator for assistance.</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="container">
      <header>
        <div className="brand">
          <img src="/global-care-logo.svg" alt="Global Care Canlubang" />
          <div className="brand-text">
            <strong>GLOBAL CARE</strong>
            <span>Medical Center · Canlubang</span>
          </div>
        </div>
        <h1>PhilHealth Benefits Utilization Flow</h1>
        <p className="tagline">Ensuring Every Patient Gets the Right Benefit, at the Right Time</p>
      </header>

      <ProgressDots step={screen} />

      {screen === 1 && renderScreen1()}
      {screen === 2 && renderScreen2()}
      {screen === 3 && renderScreen3()}
      {screen === 4 && renderScreen4()}

      <div className="footer-bar">
        <strong>OUR COMMITMENT:</strong> Right Benefit. Right Patient. Right Time.
        <br />
        We Care. We Guide. We Serve. · Global Care Medical Center – Canlubang
      </div>
    </div>
  )
}

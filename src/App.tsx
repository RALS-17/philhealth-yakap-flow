import { useState } from 'react'

type Screen = 1 | 2 | 3 | 4 | 5 | 6
type EntryType = 'er' | 'opd' | 'direct' | null
type BenefitType = 'er' | 'opd' | 'special' | 'zbenefit' | null
type ErSub = 'admissible' | 'non-admissible' | null
type SpecialPkg =
  | 'ami'
  | 'maternity'
  | 'rehab'
  | 'dialysis'
  | 'animalbite'
  | 'daysurgery'
  | null
type YakapSub = 'standard' | 'cancer' | null
type CancerOutcome = 'abnormal' | 'qualified' | null

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

function ProgressDots({ step, total = 6 }: { step: number; total?: number }) {
  return (
    <div className="progress-wrap">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
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
  const [benefitType, setBenefitType] = useState<BenefitType>(null)
  const [erSub, setErSub] = useState<ErSub>(null)
  const [specialPkg, setSpecialPkg] = useState<SpecialPkg>(null)
  const [yakapSub, setYakapSub] = useState<YakapSub>(null)
  const [cancerOutcome, setCancerOutcome] = useState<CancerOutcome>(null)

  const goBack = () => {
    if (screen === 1) return
    if (screen === 2) {
      setScreen(1)
      setPath(['Start'])
      setEntryType(null)
    } else if (screen === 3) {
      setScreen(2)
      setPath((p) => p.slice(0, 2))
    } else if (screen === 4) {
      setScreen(3)
      setPath((p) => p.slice(0, 3))
      setBenefitType(null)
      setErSub(null)
      setSpecialPkg(null)
      setYakapSub(null)
      setCancerOutcome(null)
    } else if (screen === 5) {
      // Back from detail into benefit choice or sub-choice
      if (cancerOutcome) {
        setCancerOutcome(null)
        setPath((p) => p.slice(0, -1))
        return
      }
      if (yakapSub === 'cancer') {
        setYakapSub(null)
        setPath((p) => p.slice(0, -1))
        return
      }
      if (erSub || specialPkg || yakapSub) {
        setErSub(null)
        setSpecialPkg(null)
        setYakapSub(null)
        setPath((p) => p.slice(0, 4))
        return
      }
      setScreen(4)
      setPath((p) => p.slice(0, 4))
    } else if (screen === 6) {
      setScreen(5)
      setPath((p) => p.slice(0, -1))
    }
  }

  const restart = () => {
    setScreen(1)
    setPath(['Start'])
    setEntryType(null)
    setBenefitType(null)
    setErSub(null)
    setSpecialPkg(null)
    setYakapSub(null)
    setCancerOutcome(null)
  }

  // ---------- SCREEN 1: PATIENT ENTERS GCC ----------
  const selectEntry = (type: EntryType) => {
    if (!type) return
    const labels: Record<string, string> = {
      er: 'ER',
      opd: 'OPD',
      direct: 'Direct Admission / Procedure / Maternity',
    }
    setEntryType(type)
    setPath(['Start', labels[type]])
    setScreen(2)
  }

  // ---------- SCREEN 2 → 3 ----------
  const goToClassification = () => {
    setPath((p) => [...p, 'Clinical Classification'])
    setScreen(3)
  }

  // ---------- SCREEN 3: Which benefit? ----------
  const selectBenefit = (type: BenefitType) => {
    if (!type) return
    const labels: Record<string, string> = {
      er: 'Emergency Room',
      opd: 'OPD – YAKAP',
      special: 'Special Package',
      zbenefit: 'Z Benefit',
    }
    setBenefitType(type)
    setPath((p) => [...p, labels[type]])
    setScreen(4)
  }

  // ---------- SCREEN 4 / 5: Sub-choices ----------
  const selectErSub = (sub: ErSub) => {
    if (!sub) return
    const labels = {
      admissible: 'Admissible (ACR / NBB)',
      'non-admissible': 'Non-Admissible (OECB)',
    }
    setErSub(sub)
    setPath((p) => [...p, labels[sub]])
    setScreen(5)
  }

  const selectSpecial = (pkg: SpecialPkg) => {
    if (!pkg) return
    const labels: Record<string, string> = {
      ami: 'AMI Package',
      maternity: 'Maternity & New Born Package',
      rehab: 'Rehab Package',
      dialysis: 'Dialysis Package',
      animalbite: 'Animal Bite Package',
      daysurgery: 'Day Surgery Package',
    }
    setSpecialPkg(pkg)
    setPath((p) => [...p, labels[pkg]])
    setScreen(5)
  }

  const selectYakap = (sub: YakapSub) => {
    if (!sub) return
    const labels = {
      standard: 'YAKAP Standard Benefits',
      cancer: 'YAKAP Cancer Screening',
    }
    setYakapSub(sub)
    setPath((p) => [...p, labels[sub]])
    setScreen(5)
  }

  const selectCancerOutcome = (outcome: CancerOutcome) => {
    if (!outcome) return
    const labels = {
      abnormal: 'Abnormal → Oncology',
      qualified: 'Z-Benefit Package',
    }
    setCancerOutcome(outcome)
    setPath((p) => [...p, labels[outcome]])
  }

  const goToCoordination = () => {
    setPath((p) => [...p, 'Benefit Coordination'])
    setScreen(6)
  }

  // ---------- RENDER HELPERS ----------

  const renderScreen1 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">Patient Enters GCC</div>
      <p className="section-desc">Select how the patient arrives at Global Care Canlubang.</p>
      <div className="card-grid">
        <button className="choice-card er-card" onClick={() => selectEntry('er')}>
          <div className="icon">🚑</div>
          <h3>ER</h3>
          <p>Emergency Room</p>
          <ul>
            <li>Acute illness / injury</li>
            <li>Life-threatening conditions</li>
          </ul>
        </button>
        <button className="choice-card green-card" onClick={() => selectEntry('opd')}>
          <div className="icon">🏥</div>
          <h3>OPD</h3>
          <p>Outpatient Department</p>
          <ul>
            <li>Scheduled / walk-in consult</li>
            <li>Non-emergency concerns</li>
          </ul>
        </button>
        <button className="choice-card" onClick={() => selectEntry('direct')}>
          <div className="icon">📋</div>
          <h3>Direct Admission / Procedure / Maternity</h3>
          <p>Planned or specialty pathways</p>
          <ul>
            <li>Direct Admission</li>
            <li>Procedure</li>
            <li>Maternity</li>
          </ul>
        </button>
      </div>
    </div>
  )

  const renderScreen2 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">GCC PhilHealth Screening Coordinator</div>
      <p className="section-desc">Eligibility check and initial screening.</p>

      <div className="navigator-panel">
        <h3>🧭 Screening Coordinator</h3>
        <ul className="navigator-list">
          <li>
            <span>✓</span> Identity Verify
          </li>
          <li>
            <span>✓</span> Pin / PBEF Validation
          </li>
          <li>
            <span>✓</span> Program Screen
          </li>
        </ul>
      </div>

      <div className="note-box blue" style={{ marginTop: 14 }}>
        Coordinator verifies PhilHealth membership, eligibility, and routes the patient to the
        correct clinical classification.
      </div>

      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
        <button className="btn btn-primary" onClick={goToClassification}>
          Proceed to Clinical Classification →
        </button>
      </div>
    </div>
  )

  const renderScreen3 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">Clinical Classification</div>
      <p className="section-desc">Which PhilHealth benefit is applicable?</p>

      <div className="card-grid">
        <button className="choice-card er-card" onClick={() => selectBenefit('er')}>
          <div className="icon">🚨</div>
          <h3>Emergency Room</h3>
          <p>Admissible (ACR / NBB) or Non-Admissible (OECB)</p>
        </button>
        <button className="choice-card green-card" onClick={() => selectBenefit('opd')}>
          <div className="icon">💚</div>
          <h3>OPD – YAKAP</h3>
          <p>Consultation · Diagnostics · Gamot · Cancer Screening</p>
        </button>
        <button className="choice-card" onClick={() => selectBenefit('special')}>
          <div className="icon">📦</div>
          <h3>Special Package</h3>
          <p>AMI · Maternity · Rehab · Dialysis · Animal Bite · Day Surgery</p>
        </button>
        <button className="choice-card" onClick={() => selectBenefit('zbenefit')}>
          <div className="icon">💜</div>
          <h3>Z Benefit</h3>
          <p>Z Package for catastrophic cases</p>
        </button>
      </div>

      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
      </div>
    </div>
  )

  const renderScreen4 = () => {
    // Intermediate choice screens
    if (benefitType === 'er') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="section-title">Emergency Room Pathway</div>
          <p className="section-desc">Is the patient admissible?</p>
          <div className="card-grid">
            <button className="choice-card er-card" onClick={() => selectErSub('admissible')}>
              <span className="level-badge l1">ADMISSIBLE</span>
              <h3>Admissible</h3>
              <p>1. Payee: ACR<br />2. Indigent: NBB</p>
            </button>
            <button className="choice-card" onClick={() => selectErSub('non-admissible')}>
              <span className="level-badge l5">NON-ADMISSIBLE</span>
              <h3>Non-Admissible</h3>
              <p>1. OECB (Outpatient Emergency Care Benefit)</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
          </div>
        </div>
      )
    }

    if (benefitType === 'opd') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="section-title">OPD – YAKAP Pathway</div>
          <p className="section-desc">Select the applicable YAKAP service focus.</p>
          <div className="card-grid">
            <button className="choice-card green-card" onClick={() => selectYakap('standard')}>
              <div className="icon">💚</div>
              <h3>Standard YAKAP Benefits</h3>
              <p>1. Consultation<br />2. Diagnostics / Lab<br />3. Gamot</p>
            </button>
            <button className="choice-card" onClick={() => selectYakap('cancer')}>
              <div className="icon">🎗️</div>
              <h3>Cancer Screening</h3>
              <p>4. YAKAP Cancer Screening Program</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
          </div>
        </div>
      )
    }

    if (benefitType === 'special') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="section-title">Special Package</div>
          <p className="section-desc">Select the applicable special package.</p>
          <div className="card-grid">
            <button className="choice-card" onClick={() => selectSpecial('ami')}>
              <div className="icon">❤️</div>
              <h3>1. AMI</h3>
              <p>Acute Myocardial Infarction package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('maternity')}>
              <div className="icon">👶</div>
              <h3>2. Maternity & New Born</h3>
              <p>Maternity and newborn care package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('rehab')}>
              <div className="icon">🦾</div>
              <h3>3. Rehab</h3>
              <p>Rehabilitation package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('dialysis')}>
              <div className="icon">🩺</div>
              <h3>4. Dialysis</h3>
              <p>Hemodialysis / peritoneal dialysis</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('animalbite')}>
              <div className="icon">🐶</div>
              <h3>5. Animal Bite</h3>
              <p>Animal bite treatment package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('daysurgery')}>
              <div className="icon">🏥</div>
              <h3>6. Day Surgery</h3>
              <p>Ambulatory / day surgery package</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
          </div>
        </div>
      )
    }

    if (benefitType === 'zbenefit') {
      // Z Benefit goes straight to detail
      return renderBenefitDetail()
    }

    return null
  }

  const renderBenefitDetail = () => {
    // ER Admissible
    if (benefitType === 'er' && erSub === 'admissible') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header red">
            <h2>Admissible – ER</h2>
            <p>Patient will be admitted</p>
            <div className="badge">Inpatient Pathway</div>
          </div>
          <div className="section-label">PhilHealth benefits to apply</div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">📄</div>
              <div>
                <h4>1. Payee: ACR</h4>
                <p>All Case Rate based on final diagnosis and procedures.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">🏥</div>
              <div>
                <h4>2. Indigent: NBB</h4>
                <p>No Balance Billing for qualified indigent members in basic accommodation.</p>
              </div>
            </div>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    // ER Non-Admissible (OECB)
    if (benefitType === 'er' && erSub === 'non-admissible') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header teal">
            <h2>Non-Admissible – OECB</h2>
            <p>Outpatient Emergency Care Benefit · Patient will NOT be admitted</p>
            <div className="badge">ER Outpatient · No Admission</div>
          </div>
          <div className="section-label">OECB covers</div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">🚑</div>
              <div>
                <h4>Emergency Department Care</h4>
                <p>Treatment at accredited ER without admission.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">💊</div>
              <div>
                <h4>Medicines & Supplies</h4>
                <p>Used during the ER stay for covered emergency symptoms.</p>
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
            Based on PhilHealth’s list of emergency symptoms. Patient is treated and discharged
            within 24 hours.
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    // YAKAP Standard
    if (benefitType === 'opd' && yakapSub === 'standard') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header green">
            <h2>YAKAP PHIC Benefits</h2>
            <p>Primary care benefits under the YAKAP program</p>
            <div className="badge">YAKAP · Primary Care</div>
          </div>
          <div className="section-label">Covered services</div>
          <div className="component-list">
            <div className="component-card green">
              <div className="comp-icon">👨‍⚕️</div>
              <div>
                <h4>1. Consultation</h4>
                <p>Clinical assessment and management by YAKAP doctor.</p>
              </div>
            </div>
            <div className="component-card green">
              <div className="comp-icon">🔬</div>
              <div>
                <h4>2. Diagnostics / Lab</h4>
                <p>CBC, urinalysis, FBS, lipid profile, chest X-ray, and other YAKAP labs.</p>
              </div>
            </div>
            <div className="component-card green">
              <div className="comp-icon">💊</div>
              <div>
                <h4>3. Gamot (Medicines)</h4>
                <p>Essential outpatient medicines under the GAMOT benefit.</p>
              </div>
            </div>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    // YAKAP Cancer Screening
    if (benefitType === 'opd' && yakapSub === 'cancer') {
      if (!cancerOutcome) {
        return (
          <div className="screen">
            <PathBreadcrumb path={path} />
            <div className="result-header purple">
              <h2>YAKAP Cancer Screening Program</h2>
              <p>Screening as per DOH / PhilHealth guidelines</p>
              <div className="badge">YAKAP · Cancer Screening</div>
            </div>
            <div className="section-label">Outcome of screening</div>
            <div className="card-grid">
              <button className="choice-card" onClick={() => selectCancerOutcome('abnormal')}>
                <div className="icon">⚠️</div>
                <h3>Abnormal Result</h3>
                <p>Endorse to Oncology Clinic for Assessment & Evaluation</p>
              </button>
              <button className="choice-card green-card" onClick={() => selectCancerOutcome('qualified')}>
                <div className="icon">💜</div>
                <h3>Qualified Patient</h3>
                <p>Apply for Z-Benefit Package (Cancer Patients)</p>
              </button>
            </div>
            <div className="nav-row">
              <button className="btn btn-outline" onClick={goBack}>
                ← Back
              </button>
            </div>
          </div>
        )
      }

      if (cancerOutcome === 'abnormal') {
        return (
          <div className="screen">
            <PathBreadcrumb path={path} />
            <div className="result-header purple">
              <h2>Abnormal Result – Oncology Referral</h2>
              <p>Endorsed to Oncology Clinic</p>
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
            </div>
            <div className="nav-row">
              <button className="btn btn-outline" onClick={goBack}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={goToCoordination}>
                Continue to Benefit Coordination →
              </button>
            </div>
          </div>
        )
      }

      if (cancerOutcome === 'qualified') {
        return (
          <div className="screen">
            <PathBreadcrumb path={path} />
            <div className="result-header purple">
              <h2>Z-Benefit Package (Cancer)</h2>
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
            </div>
            <div className="nav-row">
              <button className="btn btn-outline" onClick={goBack}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={goToCoordination}>
                Continue to Benefit Coordination →
              </button>
            </div>
          </div>
        )
      }
    }

    // Special Packages
    if (benefitType === 'special' && specialPkg) {
      const titles: Record<string, string> = {
        ami: 'AMI Package',
        maternity: 'Maternity & New Born Package',
        rehab: 'Rehab Package',
        dialysis: 'Dialysis Package',
        animalbite: 'Animal Bite Package',
        daysurgery: 'Day Surgery Package',
      }
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header blue">
            <h2>{titles[specialPkg]}</h2>
            <p>Special Package pathway</p>
            <div className="badge">Special Package</div>
          </div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">📦</div>
              <div>
                <h4>Package Application</h4>
                <p>Apply the corresponding PhilHealth special package rates and rules.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">📋</div>
              <div>
                <h4>Documentation & Eligibility</h4>
                <p>Complete required clinical and administrative documents.</p>
              </div>
            </div>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    // Z Benefit (direct)
    if (benefitType === 'zbenefit') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header purple">
            <h2>Z Benefit – Z Package</h2>
            <p>Catastrophic benefit package</p>
            <div className="badge">Z-Benefit</div>
          </div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">💜</div>
              <div>
                <h4>Z Package Application</h4>
                <p>Submit requirements for the applicable Z-Benefit package.</p>
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
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    return null
  }

  const renderScreen5 = () => renderBenefitDetail()

  const renderScreen6 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="result-header blue">
        <h2>Benefit Coordination Engine</h2>
        <p>From package identification to post-discharge continuity</p>
        <div className="badge">Coordination · Billing · Claims</div>
      </div>

      <div className="section-label">Process flow</div>
      <div className="component-list">
        <div className="component-card">
          <div className="comp-icon">1️⃣</div>
          <div>
            <h4>Primary Package Identified</h4>
            <p>Main PhilHealth benefit package determined.</p>
          </div>
        </div>
        <div className="component-card">
          <div className="comp-icon">2️⃣</div>
          <div>
            <h4>Secondary Benefits Checked</h4>
            <p>Additional applicable benefits reviewed.</p>
          </div>
        </div>
        <div className="component-card">
          <div className="comp-icon">3️⃣</div>
          <div>
            <h4>Complete Documentation</h4>
            <p>Clinical and administrative documents completed.</p>
          </div>
        </div>
        <div className="component-card">
          <div className="comp-icon">4️⃣</div>
          <div>
            <h4>SOA / eSOA Validation</h4>
            <p>Statement of Account validated.</p>
          </div>
        </div>
        <div className="component-card">
          <div className="comp-icon">5️⃣</div>
          <div>
            <h4>PhilHealth Deduction Applied</h4>
            <p>Benefit amount deducted from the bill.</p>
          </div>
        </div>
        <div className="component-card">
          <div className="comp-icon">6️⃣</div>
          <div>
            <h4>Final Bill / Discharge</h4>
            <p>Patient receives final bill and is discharged.</p>
          </div>
        </div>
        <div className="component-card">
          <div className="comp-icon">7️⃣</div>
          <div>
            <h4>eCLAIMS 3.0 + CF5 when required</h4>
            <p>Claims submitted via eClaims; CF5 as needed.</p>
          </div>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 20 }}>
        Post-Discharge Continuity
      </div>
      <div className="card-grid">
        <div className="choice-card green-card" style={{ cursor: 'default' }}>
          <div className="icon">💚</div>
          <h3>YAKAP Follow-up</h3>
          <p>Primary care follow-up under YAKAP</p>
        </div>
        <div className="choice-card" style={{ cursor: 'default' }}>
          <div className="icon">💊</div>
          <h3>Gamot Medicines</h3>
          <p>Thru Pharmacy & MedPure</p>
        </div>
        <div className="choice-card" style={{ cursor: 'default' }}>
          <div className="icon">🔗</div>
          <h3>Follow-up / Referral</h3>
          <p>Specialty or higher-level care linkage</p>
        </div>
      </div>

      <div className="reminders">
        <h4>Key Reminders</h4>
        <ul>
          <li>Always present your valid PhilHealth ID.</li>
          <li>Inform the staff if you are a senior citizen, PWD, or indigent.</li>
          <li>Benefits are subject to PhilHealth guidelines and eligibility.</li>
          <li>Ask the PhilHealth Benefits Navigator / Screening Coordinator for assistance.</li>
        </ul>
      </div>

      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
        <button className="btn btn-primary" onClick={restart}>
          New Patient
        </button>
      </div>
    </div>
  )

  return (
    <div className="container">
      <header>
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
            alt="Global Care Canlubang"
          />
          <div className="brand-text">
            <strong>GLOBAL CARE</strong>
            <span>Medical Center · Canlubang</span>
          </div>
        </div>
        <h1>PhilHealth Benefits Utilization Flow</h1>
        <p className="tagline">Global Care Canlubang PhilHealth Ecosystem</p>
      </header>

      <ProgressDots step={screen} total={6} />

      {screen === 1 && renderScreen1()}
      {screen === 2 && renderScreen2()}
      {screen === 3 && renderScreen3()}
      {screen === 4 && renderScreen4()}
      {screen === 5 && renderScreen5()}
      {screen === 6 && renderScreen6()}

      <div className="footer-bar">
        <strong>OUR COMMITMENT:</strong> Right Benefit. Right Patient. Right Time.
        <br />
        We Care. We Guide. We Serve. · Global Care Medical Center – Canlubang
      </div>
    </div>
  )
}

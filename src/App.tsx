import { useState } from 'react'

type Screen = 1 | 2 | 3 | 4 | 5 | 6
type EntryType = 'er' | 'opd' | 'direct' | null
type BenefitType = 'er' | 'yakap' | 'daysurgery' | 'specialized' | 'zbenefit' | null
type ErSub = 'admissible' | 'non-admissible' | null
type SpecialPkg =
  | 'woundcare'
  | 'endoscopy'
  | 'hsg'
  | 'dialysis'
  | 'chemo'
  | 'radio'
  | 'blood'
  | 'animalbite'
  | 'rehab'
  | 'ami'
  | 'maternity'
  | null
type YakapSub = 'standard' | 'cancer' | 'gamot' | null
type CancerStep =
  | null
  | 'risk'
  | 'screen-type'
  | 'screen-checklist'
  | 'result-normal'
  | 'result-abnormal'
  | 'confirmed'
type OecbTab = 'overview' | 'groups' | 'covered' | 'pathways' | 'exclusions'
type DetailView =
  | 'main'
  | 'oecb-tables'
  | 'cancer-flow'
  | 'gamot-flow'
  | 'acr-flow'
  | 'z-flow'
  | 'animal-flow'
  | 'rehab-flow'
  | 'dialysis-flow'
  | 'nbb-flow'
type ProcessStep = number // 0-based index for interactive process flows

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
  const [cancerStep, setCancerStep] = useState<CancerStep>(null)
  const [oecbTab, setOecbTab] = useState<OecbTab>('overview')
  const [detailView, setDetailView] = useState<DetailView>('main')
  const [processStep, setProcessStep] = useState<ProcessStep>(0)
  const [gamotBranch, setGamotBranch] = useState<string | null>(null)
  const [gamotRx, setGamotRx] = useState<'new' | 'existing' | null>(null)
  const [gamotDispensed, setGamotDispensed] = useState<'full' | 'partial' | null>(null)
  const [acrPackage, setAcrPackage] = useState<'standard' | 'special' | null>(null)
  const [cancerScreenType, setCancerScreenType] = useState<string | null>(null)
  const [zQualified, setZQualified] = useState<'yes' | 'no' | null>(null)
  const [nbbAccom, setNbbAccom] = useState<'basic' | 'nonbasic' | null>(null)

  const clearSubState = () => {
    setErSub(null)
    setSpecialPkg(null)
    setYakapSub(null)
    setCancerStep(null)
    setCancerScreenType(null)
    setDetailView('main')
    setProcessStep(0)
    setGamotRx(null)
    setGamotBranch(null)
    setGamotDispensed(null)
    setAcrPackage(null)
    setZQualified(null)
    setNbbAccom(null)
  }

  const goBack = () => {
    if (screen === 1) return

    // --- Step back inside interactive process flows (stay on current detail) ---
    if (yakapSub === 'gamot' && processStep > 0) {
      // Clear decision state when backing into a decision step
      if (processStep === 3 && gamotRx) {
        setGamotRx(null)
        setProcessStep(2)
        return
      }
      if (processStep === 5 && gamotBranch) {
        setGamotBranch(null)
        setProcessStep(4)
        return
      }
      if (processStep === 7 && gamotDispensed) {
        setGamotDispensed(null)
        setProcessStep(6)
        return
      }
      setProcessStep((s) => s - 1)
      return
    }
    if (yakapSub === 'standard' && processStep > 0) {
      setProcessStep((s) => s - 1)
      return
    }
    if (detailView === 'acr-flow' && processStep > 0) {
      if (processStep === 4 && acrPackage) {
        setAcrPackage(null)
        setProcessStep(3)
        return
      }
      setProcessStep((s) => s - 1)
      return
    }
    if (detailView === 'z-flow' && processStep > 0) {
      if (processStep === 7 && zQualified) {
        setZQualified(null)
        setProcessStep(6)
        return
      }
      setProcessStep((s) => s - 1)
      return
    }
    if (
      (detailView === 'animal-flow' ||
        detailView === 'rehab-flow' ||
        detailView === 'dialysis-flow' ||
        detailView === 'nbb-flow') &&
      processStep > 0
    ) {
      if (detailView === 'nbb-flow' && processStep === 4 && nbbAccom) {
        setNbbAccom(null)
        setProcessStep(3)
        return
      }
      setProcessStep((s) => s - 1)
      return
    }

    // --- Exit detail sub-view back to package summary (screen 5 main) ---
    if (detailView !== 'main') {
      setDetailView('main')
      setProcessStep(0)
      setAcrPackage(null)
      setZQualified(null)
      setNbbAccom(null)
      return
    }

    // --- Cancer screening step back ---
    if (cancerStep) {
      if (cancerStep === 'confirmed') {
        setCancerStep('result-abnormal')
        setPath((p) => p.slice(0, -1))
        return
      }
      if (cancerStep === 'result-abnormal' || cancerStep === 'result-normal') {
        setCancerStep('screen-checklist')
        setPath((p) => p.slice(0, -1))
        return
      }
      if (cancerStep === 'screen-checklist') {
        setCancerStep('screen-type')
        setPath((p) => p.slice(0, -1))
        return
      }
      if (cancerStep === 'screen-type') {
        setCancerStep('risk')
        setCancerScreenType(null)
        setPath((p) => p.slice(0, -1))
        return
      }
      // Leaving cancer risk → back to YAKAP choice screen (4)
      if (cancerStep === 'risk') {
        setCancerStep(null)
        setCancerScreenType(null)
        setYakapSub(null)
        setPath((p) => p.slice(0, 4))
        setScreen(4)
        return
      }
    }

    // --- Screen-level back ---
    if (screen === 2) {
      setScreen(1)
      setPath(['Start'])
      setEntryType(null)
      return
    }

    if (screen === 3) {
      setScreen(2)
      setPath((p) => p.slice(0, 2))
      return
    }

    if (screen === 4) {
      // Intermediate choice screens → Clinical Classification
      setScreen(3)
      setPath((p) => p.slice(0, 3))
      setBenefitType(null)
      clearSubState()
      return
    }

    if (screen === 5) {
      // Leave detail / package screen → intermediate choice (screen 4)
      // Always land on a renderable screen (never blank)
      clearSubState()
      // ER and Z-BEN have no intermediate choice screen — return to Clinical Classification
      if (benefitType === 'zbenefit' || benefitType === 'er') {
        setBenefitType(null)
        setPath((p) => p.slice(0, 3))
        setScreen(3)
      } else {
        setPath((p) => p.slice(0, 4))
        setScreen(4)
      }
      return
    }

    if (screen === 6) {
      setScreen(5)
      setPath((p) => p.slice(0, -1))
      return
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
    setCancerStep(null)
    setCancerScreenType(null)
    setOecbTab('overview')
    setDetailView('main')
    setProcessStep(0)
    setGamotRx(null)
    setGamotBranch(null)
    setGamotDispensed(null)
    setAcrPackage(null)
    setZQualified(null)
    setNbbAccom(null)
  }

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

  const goToClassification = () => {
    setPath((p) => [...p, 'Clinical Classification'])
    setScreen(3)
  }

  const selectBenefit = (type: BenefitType) => {
    if (!type) return
    const labels: Record<string, string> = {
      er: 'Emergency Room',
      yakap: 'YAKAP',
      daysurgery: 'Day Surgery / Procedure',
      specialized: 'Specialized Therapy Services',
      zbenefit: 'Z-BEN',
    }
    setBenefitType(type)
    // ER goes directly to Admissible inpatient pathway (no Non-Admissible choice)
    if (type === 'er') {
      setErSub('admissible')
      setPath((p) => [...p, labels[type], 'Admissible (ACR / NBB)'])
      setScreen(5)
      return
    }
    setPath((p) => [...p, labels[type]])
    setScreen(4)
  }

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
      woundcare: 'Woundcare',
      endoscopy: 'Endoscopy',
      hsg: 'HSG',
      dialysis: 'Hemodialysis',
      chemo: 'Chemotherapy',
      radio: 'Radiotherapy',
      blood: 'Blood Transfusion',
      animalbite: 'Animal Bite',
      rehab: 'Rehab',
      ami: 'AMI Package',
      maternity: 'Maternity & New Born',
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
      gamot: 'Gamot Ecosystem',
    }
    setYakapSub(sub)
    setPath((p) => [...p, labels[sub]])
    setScreen(5)
    setProcessStep(0)
    setGamotRx(null)
    setGamotBranch(null)
    setGamotDispensed(null)
    if (sub === 'cancer') {
      setCancerStep('risk')
      setCancerScreenType(null)
    }
  }

  const goToCoordination = () => {
    setPath((p) => [...p, 'Benefit Coordination'])
    setScreen(6)
  }

  // ---------- SCREEN 1 ----------
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
            <li>OECB screening for every ER patient</li>
          </ul>
        </button>
        <button className="choice-card green-card" onClick={() => selectEntry('opd')}>
          <div className="icon">🏥</div>
          <h3>OPD</h3>
          <p>Outpatient Department</p>
          <ul>
            <li>YAKAP primary care</li>
            <li>Gamot · Labs · Cancer Screening</li>
          </ul>
        </button>
        <button className="choice-card" onClick={() => selectEntry('direct')}>
          <div className="icon">📋</div>
          <h3>Direct Admission / Procedure / Maternity</h3>
          <p>Planned or specialty pathways</p>
          <ul>
            <li>Direct Admission → Inpatient ACR</li>
            <li>Procedure · Maternity · Z-Benefit</li>
          </ul>
        </button>
      </div>
    </div>
  )

  // ---------- SCREEN 2 ----------
  const renderScreen2 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">GCC PhilHealth Screening Coordinator</div>
      <p className="section-desc">Eligibility check and initial screening (from overall GCC PhilHealth Ecosystem).</p>

      <div className="navigator-panel">
        <h3>🧭 Screening Coordinator</h3>
        <ul className="navigator-list">
          <li><span>✓</span> Identity Verify</li>
          <li><span>✓</span> PIN / PBEF Validation</li>
          <li><span>✓</span> Program Screen</li>
          <li><span>✓</span> Determine applicable PhilHealth benefit/s</li>
          <li><span>✓</span> Route to Clinical Classification</li>
        </ul>
      </div>

      <div className="note-box blue" style={{ marginTop: 14 }}>
        Every patient (ER / OPD / Direct) is screened for eligibility before clinical classification.
        Coordinator routes to the correct benefit pathway.
      </div>

      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>← Back</button>
        <button className="btn btn-primary" onClick={goToClassification}>
          Proceed to Clinical Classification →
        </button>
      </div>
    </div>
  )

  // ---------- SCREEN 3 ----------
  const renderScreen3 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="section-title">Clinical Classification</div>
      <p className="section-desc">Which PhilHealth benefit is applicable?</p>

      <div className="card-grid">
        <button className="choice-card er-card" onClick={() => selectBenefit('er')}>
          <div className="icon">🚨</div>
          <h3>Emergency Room</h3>
          <p>
            <strong>Admissible:</strong> Paying ACR · Indigent NBB · Enhanced Special Inpatient
            Packages
          </p>
        </button>
        <button className="choice-card green-card" onClick={() => selectBenefit('yakap')}>
          <div className="icon">💚</div>
          <h3>YAKAP</h3>
          <p>1. Consultation · 2. Diagnostics/Lab · 3. Gamot · 4. Cancer Screening</p>
        </button>
        <button className="choice-card" onClick={() => selectBenefit('daysurgery')}>
          <div className="icon">🏥</div>
          <h3>Day Surgery / Procedure</h3>
          <p>1. Woundcare · 2. Endoscopy · 3. HSG</p>
        </button>
        <button className="choice-card" onClick={() => selectBenefit('specialized')}>
          <div className="icon">🩺</div>
          <h3>Specialized Therapy Services</h3>
          <p>
            1. Hemodialysis · 2. Chemotherapy · 3. Radiotherapy · 4. Blood Transfusion · 5. Animal
            Bite · 6. Rehab
          </p>
        </button>
        <button className="choice-card" onClick={() => selectBenefit('zbenefit')}>
          <div className="icon">💜</div>
          <h3>Z-BEN</h3>
          <p>Z-Package for catastrophic cases</p>
        </button>
      </div>

      <div className="nav-row">
        <button className="btn btn-outline" onClick={goBack}>← Back</button>
      </div>
    </div>
  )

  // ---------- SCREEN 4: intermediate choices ----------
  const renderScreen4 = () => {
    if (benefitType === 'er') {
      // ER skips intermediate choice and goes straight to Admissible detail
      return renderBenefitDetail()
    }

    if (benefitType === 'yakap') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="section-title">YAKAP</div>
          <p className="section-desc">
            1. Consultation · 2. Diagnostics/Lab · 3. Gamot · 4. Cancer Screening
          </p>
          <div className="card-grid">
            <button className="choice-card green-card" onClick={() => selectYakap('standard')}>
              <div className="icon">💚</div>
              <h3>1–2. Consultation & Diagnostics/Lab</h3>
              <p>Standard YAKAP primary care benefits</p>
            </button>
            <button className="choice-card" onClick={() => selectYakap('gamot')}>
              <div className="icon">💊</div>
              <h3>3. Gamot</h3>
              <p>54 Gamot · 21 Core · Prescription flow · MedPure / Hospital Pharmacy</p>
            </button>
            <button className="choice-card" onClick={() => selectYakap('cancer')}>
              <div className="icon">🎗️</div>
              <h3>4. Cancer Screening</h3>
              <p>Risk profiling → Appropriate screen → Result → Z Screen if confirmed</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    if (benefitType === 'daysurgery') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="section-title">Day Surgery / Procedure</div>
          <p className="section-desc">Select the applicable day surgery / procedure.</p>
          <div className="card-grid">
            <button className="choice-card" onClick={() => selectSpecial('woundcare')}>
              <div className="icon">🩹</div>
              <h3>1. Woundcare</h3>
              <p>Wound care procedure package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('endoscopy')}>
              <div className="icon">🔬</div>
              <h3>2. Endoscopy</h3>
              <p>Endoscopic procedure package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('hsg')}>
              <div className="icon">📋</div>
              <h3>3. HSG</h3>
              <p>Hysterosalpingography package</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    if (benefitType === 'specialized') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="section-title">Specialized Therapy Services</div>
          <p className="section-desc">Select the applicable specialized therapy service.</p>
          <div className="card-grid">
            <button className="choice-card" onClick={() => selectSpecial('dialysis')}>
              <div className="icon">🩺</div>
              <h3>1. Hemodialysis</h3>
              <p>Hemodialysis / peritoneal dialysis</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('chemo')}>
              <div className="icon">💉</div>
              <h3>2. Chemotherapy</h3>
              <p>Chemotherapy service package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('radio')}>
              <div className="icon">☢️</div>
              <h3>3. Radiotherapy</h3>
              <p>Radiotherapy service package</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('blood')}>
              <div className="icon">🩸</div>
              <h3>4. Blood Transfusion</h3>
              <p>Blood transfusion service</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('animalbite')}>
              <div className="icon">🐶</div>
              <h3>5. Animal Bite</h3>
              <p>Animal Bite Treatment Package (₱5,850)</p>
            </button>
            <button className="choice-card" onClick={() => selectSpecial('rehab')}>
              <div className="icon">🦾</div>
              <h3>6. Rehab</h3>
              <p>Physical Medicine, Rehabilitation & Assistive Devices</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    if (benefitType === 'zbenefit') {
      return renderBenefitDetail()
    }

    // Safety: never leave a blank screen
    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="note-box blue">
          Session step reset. Please continue from Clinical Classification.
        </div>
        <div className="nav-row">
          <button
            className="btn btn-primary"
            onClick={() => {
              setScreen(3)
              setPath((p) => (p.length >= 3 ? p.slice(0, 3) : ['Start', '…', 'Clinical Classification']))
              setBenefitType(null)
              clearSubState()
            }}
          >
            Go to Clinical Classification →
          </button>
        </div>
      </div>
    )
  }

  // ---------- OECB TABLES ----------
  const renderOecbTables = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="result-header teal">
        <h2>OECB – Clinical Reference Tables</h2>
        <p>Outpatient Emergency Care Benefit · Core presentations, covered services & pathways</p>
        <div className="badge">OECB Reference</div>
      </div>

      <div className="tab-row">
        {(['overview', 'groups', 'covered', 'pathways', 'exclusions'] as OecbTab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn ${oecbTab === t ? 'active' : ''}`}
            onClick={() => setOecbTab(t)}
          >
            {t === 'overview' && 'Overview'}
            {t === 'groups' && 'Clinical Groups'}
            {t === 'covered' && 'Covered Services'}
            {t === 'pathways' && 'Sample Pathways'}
            {t === 'exclusions' && 'Exclusions'}
          </button>
        ))}
      </div>

      {oecbTab === 'overview' && (
        <div className="section-block">
          <h4>Emergency Ecosystem – Disposition</h4>
          <ul className="flow-steps">
            <li><span className="step-num">1</span> ER Patient → Triage + Stabilize</li>
            <li><span className="step-num">2</span> ER Physician Assessment</li>
            <li><span className="step-num">3</span> Urgent / Emergent? → Treat + Investigate</li>
            <li><span className="step-num">4</span> Disposition:
              <ul style={{ marginTop: 6, paddingLeft: 12, fontSize: '0.82rem' }}>
                <li>• Discharge / Resolved within 24 hours with OECB signs & symptoms → <strong>OECB</strong></li>
                <li>• Admission Order → Inpatient ACR / Special Package</li>
                <li>• Procedure has existing case rate → Applicable Procedure ACR</li>
              </ul>
            </li>
          </ul>
          <div className="note-box blue">
            OECB may cover a qualifying assessment that resolves without admission. Most major
            conditions (true stroke, AMI, sepsis with organ dysfunction, major trauma, etc.)
            require admission or transfer.
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 12 }}
            onClick={() => setOecbTab('exclusions')}
          >
            View OECB Exclusions (Watch Out) →
          </button>
        </div>
      )}

      {oecbTab === 'exclusions' && (
        <div className="section-block">
          <h4 style={{ color: '#b71c1c' }}>WATCH OUT: Exclusion for OECB</h4>
          <p style={{ fontSize: '0.9rem', marginBottom: 12 }}>
            OECB should generally <strong>not</strong> be used when:
          </p>
          <ul className="checklist">
            <li>An admission order has been issued</li>
            <li>
              The patient remains in the ED beyond 24 hours because a necessary disposition was not
              completed
            </li>
            <li>
              The primary service is an outpatient or inpatient procedure with an existing case rate
            </li>
            <li>
              Another PhilHealth package, such as the Animal Bite Treatment Package, properly governs
              the episode
            </li>
            <li>
              The claim seeks payment for prehospital or home services under the facility-based
              component
            </li>
            <li>The claimed item is not on the current EECL</li>
            <li>
              Documentation cannot demonstrate that the service was clinically indicated and actually
              provided
            </li>
            <li>
              OECB and the resuscitation benefit are being filed for the same episode contrary to the
              no-double-filing rule
            </li>
          </ul>
          <div className="note-box blue" style={{ marginTop: 12 }}>
            Always verify eligibility, EECL coverage, disposition timing (within 24 hours), and that
            no other package already governs the episode before filing OECB.
          </div>
        </div>
      )}

      {oecbTab === 'groups' && (
        <div className="section-block">
          <h4>OECB Core Presentations (grouped for workflow)</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 10 }}>
            The OECB circular identifies 27 core presentations. Enter the nearest core presentation
            in the eCF4 chief-complaint field; document actual chief complaint in ordinary clinical language.
            Triage level must be included in the history of present illness.
          </p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Clinical group</th>
                  <th>OECB core presentations</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="group-label">Cardiopulmonary</td>
                  <td>Chest pain; difficulty breathing; palpitation; elevated blood pressure</td>
                </tr>
                <tr>
                  <td className="group-label">Neurologic</td>
                  <td>Change in sensorium; seizure; severe headache; dizziness; change in gait; generalized weakness or lethargy</td>
                </tr>
                <tr>
                  <td className="group-label">Gastrointestinal and abdominal</td>
                  <td>Abdominal pain or enlargement; persistent vomiting; diarrhea; difficulty swallowing</td>
                </tr>
                <tr>
                  <td className="group-label">Sensory and ENT</td>
                  <td>Change in vision; change in hearing; foreign body</td>
                </tr>
                <tr>
                  <td className="group-label">Infectious, inflammatory, dermatologic</td>
                  <td>Fever or chills; rash</td>
                </tr>
                <tr>
                  <td className="group-label">Trauma and pain</td>
                  <td>Burn; severe pain from other causes</td>
                </tr>
                <tr>
                  <td className="group-label">Bleeding and toxicologic</td>
                  <td>Non-traumatic bleeding; ingestion or substance abuse</td>
                </tr>
                <tr>
                  <td className="group-label">Pediatric</td>
                  <td>Incessant crying or inconsolable child</td>
                </tr>
                <tr>
                  <td className="group-label">Reproductive and safeguarding</td>
                  <td>Obstetric or gynecologic conditions; sexual assault</td>
                </tr>
                <tr>
                  <td className="group-label">Behavioral health</td>
                  <td>Mental-health presentation</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {oecbTab === 'covered' && (
        <div className="section-block">
          <h4>Covered services (examples listed in the OECB EECL when clinically indicated)</h4>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Clinical need</th>
                  <th>Examples</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="group-label">Initial emergency care</td>
                  <td>Emergent or urgent physician consultation; ED bed; cardiac or physiologic monitoring; IV cannulation; oxygen; suction; resuscitation services</td>
                </tr>
                <tr>
                  <td className="group-label">Airway and breathing</td>
                  <td>Intubation; mechanical ventilation by hour; high-flow oxygen; nebulization; arterial blood gas</td>
                </tr>
                <tr>
                  <td className="group-label">Cardiac evaluation</td>
                  <td>Twelve-lead ECG; troponin I; chest radiograph; selected coagulation and chemistry tests</td>
                </tr>
                <tr>
                  <td className="group-label">Neurologic evaluation</td>
                  <td>Plain CT head; CT angiography when listed and clinically indicated; glucose, CBC, coagulation tests</td>
                </tr>
                <tr>
                  <td className="group-label">Infection and shock</td>
                  <td>CBC; lactate; CRP; renal tests; IV crystalloids; selected antibiotics; norepinephrine and other listed emergency medicines</td>
                </tr>
                <tr>
                  <td className="group-label">Respiratory exacerbation</td>
                  <td>Salbutamol; ipratropium-salbutamol; systemic corticosteroids; oxygen; ABG; chest radiograph</td>
                </tr>
                <tr>
                  <td className="group-label">Obstetric emergency</td>
                  <td>Cardiotocography; pregnancy testing; IV access and fluids; listed oxytocin, magnesium sulfate, and tranexamic acid</td>
                </tr>
                <tr>
                  <td className="group-label">Pain and abdominal symptoms</td>
                  <td>CBC, urinalysis, pregnancy testing, ultrasound or CT where indicated; analgesics, antiemetics, IV fluids</td>
                </tr>
                <tr>
                  <td className="group-label">Anaphylaxis</td>
                  <td>Epinephrine; oxygen; IV fluids; nebulized bronchodilator; selected antihistamine or corticosteroid if listed</td>
                </tr>
                <tr>
                  <td className="group-label">Animal bite</td>
                  <td>Wound care, tetanus-related products if listed and required during emergency stabilization</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {oecbTab === 'pathways' && (
        <div className="section-block">
          <h4>Sample symptom-to-action pathways (complete)</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 10 }}>
            Full clinical pathways from Global Care Canlubang OECB reference. Scroll horizontally on small screens.
          </p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Presentation</th>
                  <th>Immediate ED actions</th>
                  <th>Priority diagnostics</th>
                  <th>Initial medications or interventions</th>
                  <th>Likely disposition and PhilHealth pathway</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="group-label">Chest pain or suspected acute coronary syndrome</td>
                  <td>Triage as high acuity when ischemia is possible; obtain ECG rapidly; cardiac monitoring; IV access; focused history; serial reassessments</td>
                  <td>ECG within approximately 10 minutes; troponin; CBC, glucose, renal and electrolyte tests; chest radiograph when indicated</td>
                  <td>Aspirin when ACS is suspected and no contraindication; nitroglycerin when appropriate; oxygen only for hypoxemia; analgesia; anticoagulation or antiplatelet therapy according to protocol</td>
                  <td>Low-risk causes that resolve and are discharged within 24 hours may qualify for OECB. Confirmed or strongly suspected AMI generally requires admission or transfer and the appropriate AMI/inpatient package.</td>
                </tr>
                <tr>
                  <td className="group-label">Acute stroke symptoms</td>
                  <td>Record last-known-well; FAST or equivalent screening; neurologic scale; glucose; airway assessment; activate stroke pathway</td>
                  <td>Non-contrast CT head urgently; CBC, platelets, PT/INR, aPTT, glucose, renal tests; CTA when thrombectomy evaluation is indicated</td>
                  <td>Maintain airway and oxygenation; treat hypoglycemia; keep nil by mouth until swallow assessment; evaluate for alteplase or tenecteplase and thrombectomy under stroke protocol</td>
                  <td>Most true acute strokes require admission or transfer. OECB may cover initial qualifying ED services only when no admission occurs and all package conditions are met; definitive acute-stroke packages take precedence where applicable.</td>
                </tr>
                <tr>
                  <td className="group-label">Sepsis or septic shock</td>
                  <td>Sepsis screen; ABC assessment; monitor perfusion, mental status, urine output, and oxygenation; obtain IV access</td>
                  <td>Lactate; CBC; renal and hepatic tests; glucose; cultures before antibiotics when this does not delay treatment; imaging for source</td>
                  <td>Broad-spectrum antibiotics promptly; crystalloid resuscitation for hypotension or hypoperfusion; vasopressor support to maintain adequate perfusion when shock persists</td>
                  <td>Suspected sepsis with organ dysfunction or shock normally requires admission or transfer. A transient febrile illness discharged within 24 hours may qualify for OECB if the criteria are otherwise met.</td>
                </tr>
                <tr>
                  <td className="group-label">Trauma</td>
                  <td>Primary survey using ABCDE; control external hemorrhage; protect cervical spine when indicated; expose and prevent hypothermia</td>
                  <td>Focused imaging based on injury; FAST, radiographs, CT, CBC, pregnancy test, coagulation tests and type/crossmatch as indicated</td>
                  <td>Hemorrhage control; oxygen; IV or intraosseous access; fluids or blood according to protocol; analgesia; tetanus prophylaxis; splinting</td>
                  <td>Minor trauma managed and discharged within 24 hours may be OECB. Major trauma, surgery, transfusion, admission, or an existing procedural case rate should use the applicable inpatient or procedural package.</td>
                </tr>
                <tr>
                  <td className="group-label">Acute abdomen</td>
                  <td>Assess shock, peritonitis, pregnancy possibility, GI bleeding, and testicular or gynecologic emergency; provide serial examinations</td>
                  <td>CBC, urinalysis, pregnancy test, renal and hepatic studies, lipase when indicated; ultrasound or CT depending on suspected disease</td>
                  <td>IV fluids; analgesia; antiemetic; antibiotics for suspected infection or perforation; surgical or obstetric consultation</td>
                  <td>Non-surgical disease resolved within 24 hours may be OECB. Appendicitis, perforation, obstruction, ectopic pregnancy, or another operative condition requires admission or transfer and the proper case rate.</td>
                </tr>
                <tr>
                  <td className="group-label">Obstetric emergency</td>
                  <td>Maternal ABC assessment; obstetric-team activation; estimate bleeding; establish IV access; assess fetal status when viable</td>
                  <td>CBC, type and crossmatch, coagulation tests, renal and hepatic tests, urine protein when relevant; ultrasound and cardiotocography as indicated</td>
                  <td>For postpartum hemorrhage, uterotonic treatment and tranexamic acid according to protocol; for eclampsia, magnesium sulfate, blood-pressure control, airway protection, and delivery planning</td>
                  <td>Most hemorrhage, eclampsia, ectopic pregnancy, preterm labor, and fetal emergencies require admission under maternity, surgical, or inpatient benefits. OECB may cover a qualifying assessment that resolves without admission.</td>
                </tr>
                <tr>
                  <td className="group-label">Severe asthma or COPD exacerbation</td>
                  <td>Assess work of breathing, mental status, pulse oximetry, silent chest, exhaustion, and need for ventilatory support</td>
                  <td>Peak flow when feasible; ABG for severe disease; chest radiograph and ECG when indicated; infection and chemistry tests as appropriate</td>
                  <td>Inhaled short-acting bronchodilator with ipratropium for severe attacks; systemic corticosteroid; antibiotics only when indicated; non-invasive ventilation for appropriate COPD respiratory failure; supplemental oxygen to the appropriate target</td>
                  <td>A patient who stabilizes and is safely discharged within 24 hours may qualify for OECB. Persistent hypoxemia, hypercapnia, exhaustion, or ventilatory support generally requires admission.</td>
                </tr>
                <tr>
                  <td className="group-label">Anaphylaxis</td>
                  <td>Recognize rapidly; call resuscitation team; place patient appropriately; airway and circulation assessment</td>
                  <td>Diagnosis is primarily clinical; ECG, glucose, ABG, or other testing only when indicated and without delaying epinephrine</td>
                  <td>Intramuscular epinephrine immediately; repeat as indicated; oxygen; IV fluids; airway preparation; bronchodilator for bronchospasm; adjunct antihistamine or steroid after epinephrine</td>
                  <td>Stable patients may be observed and discharged within 24 hours under OECB. Refractory shock, airway compromise, repeated epinephrine, or prolonged observation may require admission.</td>
                </tr>
                <tr>
                  <td className="group-label">Animal bite or rabies exposure</td>
                  <td>Wash and irrigate wounds immediately; assess bite site, severity, animal, exposure category, and neurovascular injury</td>
                  <td>Usually clinical; imaging for foreign body or bone injury; laboratory tests only when clinically indicated</td>
                  <td>Thorough washing with soap and water for approximately 15 minutes; rabies vaccine; rabies immunoglobulin for qualifying Category III exposures; tetanus prophylaxis and antibiotics when indicated</td>
                  <td>After emergency stabilization, route eligible cases through Global Care Canlubang&apos;s accredited Animal Bite Treatment service. Use OECB only for a separate qualifying emergency component that is not properly paid under the Animal Bite Package.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="nav-row">
        <button className="btn btn-outline" onClick={() => setDetailView('main')}>← Back to OECB</button>
        <button className="btn btn-primary" onClick={goToCoordination}>Continue to Benefit Coordination →</button>
      </div>
    </div>
  )

  // ---------- CANCER SCREENING FLOW ----------
  const renderCancerFlow = () => {
    if (cancerStep === 'risk') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header purple">
            <h2>Cancer Screening Pathway</h2>
            <p>YAKAP / OPD Patient → Risk Profiling</p>
            <div className="badge">YAKAP · Cancer Screening</div>
          </div>
          <div className="section-label">Cancer Risk?</div>
          <div className="card-grid">
            <button
              className="choice-card green-card"
              onClick={() => {
                setCancerStep('result-normal')
                setPath((p) => [...p, 'No Risk → Routine Prevention'])
              }}
            >
              <div className="icon">✅</div>
              <h3>NO</h3>
              <p>→ Routine Prevention</p>
            </button>
            <button
              className="choice-card"
              onClick={() => {
                setCancerStep('screen-type')
                setPath((p) => [...p, 'Yes → Appropriate Screen'])
              }}
            >
              <div className="icon">🎗️</div>
              <h3>YES</h3>
              <p>→ Appropriate Screen (Breast · Colorectal · Liver / Lung etc.)</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    // Step: select screen type (Breast / Colorectal / Liver-Lung)
    if (cancerStep === 'screen-type') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header purple">
            <h2>Appropriate Screen</h2>
            <p>Select the screening type</p>
            <div className="badge">Screening Type</div>
          </div>
          <div className="card-grid">
            {[
              { key: 'Breast', icon: '🎗️', desc: 'Breast cancer screening' },
              { key: 'Colorectal', icon: '🔬', desc: 'Colorectal cancer screening' },
              { key: 'Liver / Lung etc.', icon: '🫁', desc: 'Liver, lung, and other site screening' },
            ].map((s) => (
              <button
                key={s.key}
                className="choice-card"
                onClick={() => {
                  setCancerScreenType(s.key)
                  setCancerStep('screen-checklist')
                  setPath((p) => [...p, s.key])
                }}
              >
                <div className="icon">{s.icon}</div>
                <h3>{s.key}</h3>
                <p>{s.desc}</p>
              </button>
            ))}
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    // Step: PHIC requirements checklist then Result
    if (cancerStep === 'screen-checklist') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header purple">
            <h2>Appropriate Screen — {cancerScreenType || 'Selected'}</h2>
            <p>PHIC requirements / checklist · then Result</p>
            <div className="badge">PHIC Checklist</div>
          </div>

          <div className="section-label">Requirements / checklist for PHIC</div>
          <ul className="checklist">
            <li>Verify PhilHealth membership & eligibility (PIN / PBEF)</li>
            <li>Confirm YAKAP registration / primary care linkage</li>
            <li>Document risk profiling and indication for screening</li>
            <li>Complete clinical request / order for {cancerScreenType || 'selected screen'}</li>
            <li>Obtain informed consent for screening procedure</li>
            <li>Record screening type and date in clinical record</li>
            <li>Prepare claim / benefit documentation as required by PhilHealth</li>
          </ul>

          <div className="note-box blue" style={{ marginTop: 12, marginBottom: 14 }}>
            Complete the PHIC checklist before proceeding to result disposition.
          </div>

          <div className="section-label">Result</div>
          <div className="card-grid">
            <button
              className="choice-card green-card"
              onClick={() => {
                setCancerStep('result-normal')
                setPath((p) => [...p, 'Normal → YAKAP Follow-up'])
              }}
            >
              <div className="icon">✅</div>
              <h3>NORMAL</h3>
              <p>→ YAKAP Follow-up</p>
            </button>
            <button
              className="choice-card"
              onClick={() => {
                setCancerStep('result-abnormal')
                setPath((p) => [...p, 'Abnormal → Specialist Work-up'])
              }}
            >
              <div className="icon">⚠️</div>
              <h3>ABNORMAL</h3>
              <p>→ Specialist Work-up</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    if (cancerStep === 'result-normal') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header green">
            <h2>Normal Result / Routine Prevention</h2>
            <p>Continue under YAKAP primary care</p>
            <div className="badge">YAKAP Follow-up</div>
          </div>
          <div className="component-list">
            <div className="component-card green">
              <div className="comp-icon">💚</div>
              <div>
                <h4>YAKAP Follow-up</h4>
                <p>Schedule next risk assessment / screening interval as per guidelines.</p>
              </div>
            </div>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
            <button className="btn btn-primary" onClick={goToCoordination}>Continue to Benefit Coordination →</button>
          </div>
        </div>
      )
    }

    if (cancerStep === 'result-abnormal') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header purple">
            <h2>Abnormal → Specialist Work-up</h2>
            <p>Cancer Confirmed?</p>
            <div className="badge">Specialist Pathway</div>
          </div>
          <div className="card-grid">
            <button
              className="choice-card"
              onClick={() => {
                setCancerStep('confirmed')
                setPath((p) => [...p, 'Cancer Confirmed → Z Screen'])
              }}
            >
              <div className="icon">💜</div>
              <h3>YES – Cancer Confirmed</h3>
              <p>→ Z Screen (Z-Benefit pathway)</p>
            </button>
            <button
              className="choice-card green-card"
              onClick={() => {
                setCancerStep('result-normal')
                setPath((p) => [...p, 'Not Confirmed → Follow-up'])
              }}
            >
              <div className="icon">📋</div>
              <h3>Not Confirmed / Further Work-up</h3>
              <p>Continue specialist evaluation / YAKAP linkage</p>
            </button>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
          </div>
        </div>
      )
    }

    if (cancerStep === 'confirmed') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header purple">
            <h2>Z Screen – Cancer Confirmed</h2>
            <p>Proceed to Z Benefits Ecosystem</p>
            <div className="badge">Z-Benefit Pathway</div>
          </div>
          <ul className="flow-steps">
            <li><span className="step-num">1</span> Z Benefit Alert</li>
            <li><span className="step-num">2</span> Z Benefit Coordinator</li>
            <li><span className="step-num">3</span> Verify GCMCC Contracted Package</li>
            <li><span className="step-num">4</span> Check Clinical Criteria</li>
            <li><span className="step-num">5</span> Complete Pre-auth / Required Documentation</li>
            <li><span className="step-num">6</span> Qualified → Enroll Package → Treatment Plan → Tranche / Service Documentation → Claims + Follow-up</li>
            <li><span className="step-num">7</span> Not Qualified → ACR / Other Pathway</li>
          </ul>
          <div className="note-box blue">
            Multiple Z cancer packages include: Acute lymphocytic/lymphoblastic leukemia, Breast,
            Cervical, Prostate, Colon, Rectal cancer.
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setBenefitType('zbenefit')
                setYakapSub(null)
                setCancerStep(null)
                setProcessStep(0)
                setZQualified(null)
                setDetailView('z-flow')
                setScreen(5)
                setPath((p) => [...p, 'Z Benefits Process'])
              }}
            >
              Open Full Z Benefits Process →
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="screen">
        <div className="note-box blue">Cancer step unavailable. Returning to YAKAP choices.</div>
        <div className="nav-row">
          <button
            className="btn btn-primary"
            onClick={() => {
              setCancerStep(null)
              setCancerScreenType(null)
              setYakapSub(null)
              setScreen(4)
              setPath((p) => p.slice(0, 4))
            }}
          >
            Back to YAKAP →
          </button>
        </div>
      </div>
    )
  }

  // PhilHealth YAKAP medicine lists (CY 2026)
  const GAMOT_21 = [
    'Amoxicillin',
    'Ciprofloxacin',
    'Clarithromycin',
    'Co-amoxiclav',
    'Co-trimoxazole',
    'Nitrofurantoin',
    'Aspirin',
    'Fluticasone + Salmeterol',
    'Prednisone',
    'Salbutamol',
    'Simvastatin',
    'Chlorphenamine',
    'Oral Rehydration Salts',
    'Paracetamol',
    'Gliclazide',
    'Metformin',
    'Amlodipine',
    'Enalapril',
    'Hydrochlorothiazide',
    'Losartan',
    'Metoprolol',
  ]
  const EGAMOT_54 = [
    'Albendazole',
    'Azithromycin',
    'Cefixime',
    'Cefuroxime',
    'Clindamycin',
    'Clotrimazole',
    'Cloxacillin',
    'Doxycycline',
    'Erythromycin',
    'Fluconazole',
    'Ketoconazole',
    'Mebendazole',
    'Metronidazole',
    'Oseltamivir',
    'Tobramycin',
    'Clopidogrel',
    'Budesonide + Formoterol',
    'Ipratropium',
    'Montelukast',
    'Ipratropium + Salbutamol',
    'Tiotropium',
    'Aluminum Hydroxide + Magnesium Hydroxide',
    'Butamirate',
    'Celecoxib',
    'Cetirizine',
    'Colchicine',
    'Diphenhydramine',
    'Ferrous Salt (Iron Preparations)',
    'Folic acid + Iron Ferrous',
    'Ibuprofen',
    'Lagundi (Vitex Negundo)',
    'Loratadine',
    'Mefenamic Acid',
    'Naproxen',
    'Omeprazole',
    'Zinc',
    'Dapagliflozin',
    'Atorvastatin',
    'Fenofibrate',
    'Rosuvastatin',
    'Atenolol',
    'Captopril',
    'Clonidine',
    'Diltiazem',
    'Enalapril + Hydrochlorothiazide',
    'Isosorbide Dinitrate',
    'Isosorbide Mononitrate',
    'Methyldopa',
    'Tamsulosin',
    'Telmisartan',
    'Telmisartan + Hydrochlorothiazide',
    'Valsartan',
    'Valsartan + Hydrochlorothiazide',
    'Gabapentin',
  ]

  // ---------- GAMOT FLOW (matches YAKAP Medicine & Laboratory Process Flow) ----------
  const renderGamotFlow = () => {
    const totalSteps = 8
    const stepTitles = [
      'Start: Patient Arrival & Registration (Walk-in / OPD / ER)',
      'YAKAP Clinic Registration / FPE',
      'Physician Consultation: Existing Private Prescription?',
      'Consult path → Prescription / Request Generation',
      'Service branch (54 Gamot · 21 Core · Lab)',
      'Proceed to Medpure / Hospital Pharmacy / Lab',
      'Fully Dispensed?',
      'Accounting & Record Updates → End',
    ]

    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="result-header green">
          <h2>YAKAP Medicine and Laboratory Process Flow</h2>
          <p>End-to-End · Step {processStep + 1} of {totalSteps}</p>
          <div className="badge">YAKAP · Gamot / Lab</div>
        </div>

        <ProgressDots step={processStep + 1} total={totalSteps} />

        <ul className="flow-steps" style={{ marginBottom: 16 }}>
          {stepTitles.map((t, i) => (
            <li
              key={i}
              style={{
                opacity: i === processStep ? 1 : i < processStep ? 0.85 : 0.45,
                borderColor: i === processStep ? 'var(--green)' : undefined,
                background: i === processStep ? 'var(--green-light)' : undefined,
              }}
            >
              <span
                className="step-num"
                style={{ background: i <= processStep ? 'var(--green)' : 'var(--border)' }}
              >
                {i + 1}
              </span>
              <div>
                <strong>{t}</strong>
                {i < processStep && i === 2 && gamotRx && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    {gamotRx === 'new'
                      ? 'NO → New Consult → Initial Check-up → Gamot List / Lab Program Check'
                      : 'YES → Existing Private Prescription'}
                  </div>
                )}
                {i < processStep && i === 4 && gamotBranch && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Branch: {gamotBranch}</div>
                )}
                {i < processStep && i === 6 && gamotDispensed && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    {gamotDispensed === 'full' ? 'YES → No Further Action' : 'NO (Partial) → claim windows apply'}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="section-block">
          {processStep === 0 && (
            <>
              <h4>Start — Patient Arrival & Registration</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Patient arrives as <strong>Walk-in / OPD / ER</strong>. Register the encounter to begin the
                YAKAP Medicine and Laboratory process.
              </p>
              <button className="btn btn-primary" onClick={() => setProcessStep(1)}>
                Proceed to YAKAP Clinic Registration / FPE →
              </button>
            </>
          )}

          {processStep === 1 && (
            <>
              <h4>YAKAP Clinic Registration / FPE</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Complete YAKAP clinic registration and First Patient Encounter (FPE) documentation.
              </p>
              <button className="btn btn-primary" onClick={() => setProcessStep(2)}>
                Proceed to Physician Consultation →
              </button>
            </>
          )}

          {processStep === 2 && (
            <>
              <h4>Physician Consultation — Existing Private Prescription?</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Does the patient already have an existing private prescription?
              </p>
              {!gamotRx ? (
                <div className="card-grid">
                  <button
                    className="choice-card green-card"
                    onClick={() => {
                      setGamotRx('new')
                      setProcessStep(3)
                    }}
                  >
                    <h3>NO</h3>
                    <p>
                      → New Consult → Initial Check-up → YAKAP Gamot List / Lab Program Check →
                      Prescription / Request Generation
                    </p>
                  </button>
                  <button
                    className="choice-card"
                    onClick={() => {
                      setGamotRx('existing')
                      setProcessStep(3)
                    }}
                  >
                    <h3>YES</h3>
                    <p>→ Existing Private Prescription → Prescription / Request Generation</p>
                  </button>
                </div>
              ) : (
                <div className="note-box blue">
                  Selected:{' '}
                  {gamotRx === 'new' ? 'NO — New Consult path' : 'YES — Existing Private Prescription'}
                </div>
              )}
            </>
          )}

          {processStep === 3 && (
            <>
              <h4>
                {gamotRx === 'new'
                  ? 'New Consult path → Prescription / Request Generation'
                  : 'Existing Private Prescription → Prescription / Request Generation'}
              </h4>
              {gamotRx === 'new' ? (
                <ul className="flow-steps" style={{ marginBottom: 12 }}>
                  <li>
                    <span className="step-num">A</span> New Consult
                  </li>
                  <li>
                    <span className="step-num">B</span> Initial Check-up
                  </li>
                  <li>
                    <span className="step-num">C</span> YAKAP Gamot List / Lab Program Check
                  </li>
                  <li>
                    <span className="step-num">D</span> Prescription / Request Generation
                  </li>
                </ul>
              ) : (
                <ul className="flow-steps" style={{ marginBottom: 12 }}>
                  <li>
                    <span className="step-num">A</span> Existing Private Prescription
                  </li>
                  <li>
                    <span className="step-num">B</span> Prescription / Request Generation
                  </li>
                </ul>
              )}
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Generate the prescription or laboratory request, then choose the service branch.
              </p>
              <button className="btn btn-primary" onClick={() => setProcessStep(4)}>
                Continue to Service Branch →
              </button>
            </>
          )}

          {processStep === 4 && (
            <>
              <h4>Service Branch — after Prescription / Request Generation</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Select the applicable branch from the process flow:
              </p>
              {!gamotBranch ? (
                <div className="card-grid">
                  <button
                    className="choice-card green-card"
                    onClick={() => {
                      setGamotBranch('54 Gamot (Gamot App) → Medpure')
                      setProcessStep(5)
                    }}
                  >
                    <h3>54 Gamot</h3>
                    <p>Gamot App → Proceed to Medpure</p>
                  </button>
                  <button
                    className="choice-card"
                    onClick={() => {
                      setGamotBranch('21 Core (Epress) → Hospital Pharmacy')
                      setProcessStep(5)
                    }}
                  >
                    <h3>21 Core</h3>
                    <p>Epress → Proceed to Hospital Pharmacy</p>
                  </button>
                  <button
                    className="choice-card"
                    onClick={() => {
                      setGamotBranch('Lab / X-ray / ECG (EKAS) → Lab / Radiology')
                      setProcessStep(5)
                    }}
                  >
                    <h3>Lab / X-ray / ECG</h3>
                    <p>EKAS → Proceed to Lab / Radiology</p>
                  </button>
                </div>
              ) : (
                <div className="note-box blue">Selected: {gamotBranch}</div>
              )}
            </>
          )}

          {processStep === 5 && (
            <>
              <h4>Proceed to service point</h4>
              <div className="note-box blue" style={{ marginBottom: 12 }}>
                Selected branch: <strong>{gamotBranch || '—'}</strong>
              </div>
              {gamotBranch?.includes('Medpure') && (
                <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                  Patient proceeds to <strong>Medpure</strong> for 54 Gamot dispensing via Gamot App.
                </p>
              )}
              {gamotBranch?.includes('Hospital Pharmacy') && (
                <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                  Patient proceeds to <strong>Hospital Pharmacy</strong> for 21 Core (Epress) medicines.
                </p>
              )}
              {gamotBranch?.includes('Lab') && (
                <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                  Patient proceeds to <strong>Lab / Radiology</strong> for Lab / X-ray / ECG (EKAS).
                </p>
              )}
              <button className="btn btn-primary" onClick={() => setProcessStep(6)}>
                Continue to Fully Dispensed? →
              </button>
            </>
          )}

          {processStep === 6 && (
            <>
              <h4>Fully Dispensed?</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Was the prescription / request fully dispensed or completed?
              </p>
              {!gamotDispensed ? (
                <div className="card-grid">
                  <button
                    className="choice-card green-card"
                    onClick={() => {
                      setGamotDispensed('full')
                      setProcessStep(7)
                    }}
                  >
                    <h3>YES</h3>
                    <p>→ No Further Action → Accounting & Record Updates</p>
                  </button>
                  <button
                    className="choice-card"
                    onClick={() => {
                      setGamotDispensed('partial')
                      setProcessStep(7)
                    }}
                  >
                    <h3>NO (Partial)</h3>
                    <p>
                      <strong>Antibiotics:</strong> Claim within 2 days from prescription date
                      <br />
                      <strong>Maintenance Meds:</strong> Claim within 2 weeks from prescription date
                    </p>
                  </button>
                </div>
              ) : (
                <div className="note-box blue">
                  {gamotDispensed === 'full'
                    ? 'YES — fully dispensed. No further action beyond accounting.'
                    : 'NO (Partial) — apply antibiotic (2 days) or maintenance med (2 weeks) claim windows.'}
                </div>
              )}
            </>
          )}

          {processStep === 7 && (
            <>
              <h4>Accounting & Record Updates → End</h4>
              {gamotDispensed === 'partial' && (
                <div className="note-box blue" style={{ marginBottom: 12 }}>
                  Partial dispensing claim windows: Antibiotics within <strong>2 days</strong>; Maintenance
                  meds within <strong>2 weeks</strong> from prescription date.
                </div>
              )}
              <ul className="checklist">
                <li>
                  <strong>Gather Charge Slips</strong> (Next Day)
                </li>
                <li>
                  <strong>Update Monitoring Slip</strong> (Annex F)
                </li>
              </ul>
              <div className="note-box blue" style={{ marginTop: 12, marginBottom: 12 }}>
                Process complete (End). Continue to Benefit Coordination for billing / claims as needed.
              </div>
              <button className="btn btn-primary" onClick={goToCoordination}>
                Continue to Benefit Coordination →
              </button>
            </>
          )}
        </div>

        <div className="nav-row">
          <button className="btn btn-outline" onClick={goBack}>
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ---------- INPATIENT ACR FLOW (interactive process) ----------
  const renderAcrFlow = () => {
    const totalSteps = 8
    const stepTitles = [
      'Admission Order',
      'Final / Working Diagnosis',
      'ICD-10 + Procedures Identified',
      'Special Package Screen',
      'Second Case Rate Check',
      'CF2 / CF4 / CF5 / eSOA',
      'Benefit Deduction',
      'eClaims',
    ]
    const stepBodies = [
      'Patient requires admission. Issue the admission order to enter the inpatient ecosystem.',
      'Establish the final or working diagnosis that will drive case rate selection.',
      'Identify the applicable ICD-10 diagnosis code(s) and procedure code(s).',
      'Screen whether a special or enhanced package applies.',
      'Perform the second case rate check after primary package selection.',
      'Complete required claim forms: CF2 / CF4 / CF5 / eSOA as applicable.',
      'Apply the PhilHealth benefit deduction to the patient bill.',
      'Submit claims via eClaims. Process complete.',
    ]

    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="result-header red">
          <h2>Inpatient All Case Rates — ACR</h2>
          <p>Interactive process · Step {processStep + 1} of {totalSteps}</p>
          <div className="badge">Inpatient ACR</div>
        </div>

        <ProgressDots step={processStep + 1} total={totalSteps} />

        <ul className="flow-steps" style={{ marginBottom: 16 }}>
          {stepTitles.map((t, i) => (
            <li
              key={i}
              style={{
                opacity: i === processStep ? 1 : i < processStep ? 0.85 : 0.45,
                borderColor: i === processStep ? '#c62828' : undefined,
                background: i === processStep ? '#ffebee' : undefined,
              }}
            >
              <span
                className="step-num"
                style={{ background: i <= processStep ? '#c62828' : 'var(--border)' }}
              >
                {i + 1}
              </span>
              <div>
                <strong>{t}</strong>
                {i < processStep && i === 3 && acrPackage && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    Selected:{' '}
                    {acrPackage === 'standard'
                      ? 'NO → Standard ACR'
                      : 'YES → Special / Enhanced Package'}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="section-block">
          <h4>
            Step {processStep + 1} — {stepTitles[processStep]}
          </h4>
          <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>{stepBodies[processStep]}</p>

          {processStep === 3 && !acrPackage && (
            <div className="card-grid" style={{ marginBottom: 12 }}>
              <button
                className="choice-card"
                onClick={() => {
                  setAcrPackage('standard')
                  setProcessStep(4)
                }}
              >
                <h3>NO</h3>
                <p>→ Standard ACR</p>
              </button>
              <button
                className="choice-card er-card"
                onClick={() => {
                  setAcrPackage('special')
                  setProcessStep(4)
                }}
              >
                <h3>YES</h3>
                <p>→ Special / Enhanced Package</p>
              </button>
            </div>
          )}

          {processStep === 3 && acrPackage && (
            <div className="note-box blue" style={{ marginBottom: 12 }}>
              Selected:{' '}
              {acrPackage === 'standard'
                ? 'NO → Standard ACR'
                : 'YES → Special / Enhanced Package'}
            </div>
          )}

          {processStep === 7 && (
            <div className="component-list" style={{ marginBottom: 12 }}>
              <div className="component-card">
                <div className="comp-icon">📄</div>
                <div>
                  <h4>Paying: ACR</h4>
                  <p>All Case Rate based on final diagnosis and procedures.</p>
                </div>
              </div>
              <div className="component-card">
                <div className="comp-icon">🏥</div>
                <div>
                  <h4>Indigent: NBB</h4>
                  <p>No Balance Billing for qualified indigent members in basic accommodation.</p>
                </div>
              </div>
            </div>
          )}

          {processStep < totalSteps - 1 ? (
            processStep !== 3 && (
              <button className="btn btn-primary" onClick={() => setProcessStep((s) => s + 1)}>
                Next Step →
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          )}
        </div>

        <div className="nav-row">
          <button
            className="btn btn-outline"
            onClick={() => {
              if (processStep > 0) {
                if (processStep === 4 && acrPackage) {
                  setAcrPackage(null)
                  setProcessStep(3)
                } else {
                  setProcessStep((s) => s - 1)
                }
              } else {
                setDetailView('main')
                setProcessStep(0)
                setAcrPackage(null)
              }
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ---------- Z BENEFITS FLOW (interactive process) ----------
  const renderZFlow = () => {
    const totalSteps = 8
    const stepTitles = [
      'Suspected / Confirmed Z Condition',
      'Z Benefit Alert',
      'Z Benefit Coordinator',
      'Verify GCMCC Contracted Package',
      'Check Clinical Criteria',
      'Complete Pre-auth / Required Documentation',
      'Qualified?',
      'Outcome',
    ]
    const stepBodies = [
      'Patient has a suspected or confirmed Z-condition (catastrophic case).',
      'Trigger the Z Benefit Alert so the pathway is activated.',
      'Z Benefit Coordinator takes the case and guides documentation.',
      'Verify that GCMCC has a contracted package for this condition.',
      'Check clinical criteria against PhilHealth Z-Benefit requirements.',
      'Complete pre-authorization and all required documentation.',
      'Is the patient qualified for the Z package?',
      zQualified === 'yes'
        ? 'Qualified path: Enroll Package → Treatment Plan → Tranche / Service Documentation → Claims + Follow-up'
        : zQualified === 'no'
          ? 'Not Qualified → ACR / Other Pathway'
          : 'Select qualification outcome above.',
    ]

    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="result-header purple">
          <h2>Z Benefits Ecosystem</h2>
          <p>Interactive process · Step {processStep + 1} of {totalSteps}</p>
          <div className="badge">Z-Benefit</div>
        </div>

        <ProgressDots step={processStep + 1} total={totalSteps} />

        <div className="note-box blue" style={{ marginBottom: 12 }}>
          Multiple Z cancer packages, including: Acute lymphocytic/lymphoblastic leukemia,
          Breast cancer, Cervical cancer, Prostate cancer, Colon cancer, Rectal cancer.
        </div>

        <ul className="flow-steps" style={{ marginBottom: 16 }}>
          {stepTitles.map((t, i) => (
            <li
              key={i}
              style={{
                opacity: i === processStep ? 1 : i < processStep ? 0.85 : 0.45,
                borderColor: i === processStep ? '#7b1fa2' : undefined,
                background: i === processStep ? '#f3e5f5' : undefined,
              }}
            >
              <span
                className="step-num"
                style={{ background: i <= processStep ? '#7b1fa2' : 'var(--border)' }}
              >
                {i + 1}
              </span>
              <div>
                <strong>{t}</strong>
                {i < processStep && i === 6 && zQualified && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    Selected: {zQualified === 'yes' ? 'QUALIFIED' : 'NOT QUALIFIED'}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="section-block">
          <h4>
            Step {processStep + 1} — {stepTitles[processStep]}
          </h4>
          <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>{stepBodies[processStep]}</p>

          {processStep === 6 && !zQualified && (
            <div className="card-grid" style={{ marginBottom: 12 }}>
              <button
                className="choice-card green-card"
                onClick={() => {
                  setZQualified('yes')
                  setProcessStep(7)
                }}
              >
                <h3>QUALIFIED</h3>
                <p>→ Enroll Package → Treatment Plan → Tranche / Service Documentation → Claims + Follow-up</p>
              </button>
              <button
                className="choice-card"
                onClick={() => {
                  setZQualified('no')
                  setProcessStep(7)
                }}
              >
                <h3>NOT QUALIFIED</h3>
                <p>→ ACR / Other Pathway</p>
              </button>
            </div>
          )}

          {processStep === 7 && zQualified === 'yes' && (
            <ul className="flow-steps" style={{ marginBottom: 12 }}>
              <li><span className="step-num">A</span> Enroll Package</li>
              <li><span className="step-num">B</span> Treatment Plan</li>
              <li><span className="step-num">C</span> Tranche / Service Documentation</li>
              <li><span className="step-num">D</span> Claims + Follow-up</li>
            </ul>
          )}

          {processStep === 7 && zQualified === 'no' && (
            <div className="note-box blue" style={{ marginBottom: 12 }}>
              Patient is not qualified for Z-Benefit. Route to <strong>ACR / Other Pathway</strong> as
              clinically and administratively appropriate.
            </div>
          )}

          {processStep < totalSteps - 1 ? (
            processStep !== 6 && (
              <button className="btn btn-primary" onClick={() => setProcessStep((s) => s + 1)}>
                Next Step →
              </button>
            )
          ) : (
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          )}
        </div>

        <div className="nav-row">
          <button
            className="btn btn-outline"
            onClick={() => {
              if (processStep > 0) {
                if (processStep === 7 && zQualified) {
                  setZQualified(null)
                  setProcessStep(6)
                } else {
                  setProcessStep((s) => s - 1)
                }
              } else {
                setDetailView('main')
                setProcessStep(0)
                setZQualified(null)
              }
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ---------- ANIMAL BITE FLOW ----------
  // Shared interactive step renderer for specialized pathways
  const renderInteractivePathway = (
    title: string,
    subtitle: string,
    badge: string,
    steps: string[],
    note?: JSX.Element | null,
    extraAtEnd?: JSX.Element | null,
  ) => {
    const total = steps.length
    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="result-header blue">
          <h2>{title}</h2>
          <p>
            Interactive process · Step {processStep + 1} of {total}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
          <div className="badge">{badge}</div>
        </div>
        <ProgressDots step={processStep + 1} total={total} />
        <ul className="flow-steps" style={{ marginBottom: 16 }}>
          {steps.map((t, i) => (
            <li
              key={i}
              style={{
                opacity: i === processStep ? 1 : i < processStep ? 0.85 : 0.45,
                borderColor: i === processStep ? 'var(--blue)' : undefined,
                background: i === processStep ? 'var(--blue-light)' : undefined,
              }}
            >
              <span
                className="step-num"
                style={{ background: i <= processStep ? 'var(--blue)' : 'var(--border)' }}
              >
                {i + 1}
              </span>
              <strong>{t}</strong>
            </li>
          ))}
        </ul>
        <div className="section-block">
          <h4>
            Step {processStep + 1} — {steps[processStep]}
          </h4>
          {processStep === total - 1 && note}
          {processStep === total - 1 && extraAtEnd}
          {processStep < total - 1 ? (
            <button className="btn btn-primary" onClick={() => setProcessStep((s) => s + 1)}>
              Next Step →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          )}
        </div>
        <div className="nav-row">
          <button
            className="btn btn-outline"
            onClick={() => {
              if (processStep > 0) setProcessStep((s) => s - 1)
              else {
                setDetailView('main')
                setProcessStep(0)
              }
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  const renderAnimalFlow = () =>
    renderInteractivePathway(
      'Animal Bite Benefit Pathway',
      'Package ₱5,850',
      'Specialized · ABTC',
      [
        'Bite / Rabies Exposure',
        'Immediate wound care',
        'Exposure classification',
        'PhilHealth Animal Bite eligibility',
        'Accredited ABTC',
        'Rabies vaccine ± RIG',
        'Tetanus prophylaxis',
        'Antibiotics when indicated',
        'Complete vaccination schedule',
        'Claim filing',
      ],
      <div className="note-box blue" style={{ marginBottom: 12 }}>
        The current Animal Bite Treatment Package is <strong>₱5,850</strong> and covers applicable
        PEP services including rabies vaccine, rabies immunoglobulin, local wound care,
        tetanus-related treatment, antibiotics and supplies.
      </div>,
    )

  const renderRehabFlow = () =>
    renderInteractivePathway(
      'Rehabilitation Pathway',
      'PM&R / Assistive Devices (2025)',
      'Specialized · Rehab',
      [
        'Disabling Condition',
        'PM&R assessment',
        'Functional assessment',
        'Check PhilHealth rehab / Z / assistive-device package',
        'Preauthorization if required',
        'Therapy / device',
        'Outcome assessment',
        'Claim',
        'Follow-up rehabilitation',
      ],
      <>
        <div className="section-label">GCMCC should screen</div>
        <ul className="checklist" style={{ marginBottom: 12 }}>
          <li>Stroke survivors</li>
          <li>Spinal cord injuries</li>
          <li>Amputees</li>
          <li>Neurologic disease</li>
          <li>Post-trauma patients</li>
          <li>Post-ICU disability</li>
          <li>Cancer rehabilitation</li>
          <li>Patients requiring wheelchairs / walkers / crutches / canes</li>
        </ul>
        <div className="note-box blue" style={{ marginBottom: 12 }}>
          PhilHealth introduced a broader <strong>Physical Medicine, Rehabilitation Services and
          Assistive Mobility Devices</strong> benefit in 2025. GCMCC is currently not accredited but
          will apply for accreditation. The Rehab coordinator should make an appropriate referral to
          GMCL if there is a need.
        </div>
      </>,
    )

  const renderDialysisFlow = () =>
    renderInteractivePathway(
      'Hemodialysis Pathway',
      'CKD Stage 5 · up to 156 sessions/year',
      'Specialized · Hemodialysis',
      [
        'CKD Patient',
        'Nephrologist assessment',
        'CKD Stage 5 requiring HD?',
        'PhilHealth Dialysis Database requirements',
        'Accredited dialysis facility',
        'Treatment session',
        'Document clinically required: medications, laboratories, dialysis supplies, professional/facility services',
        'PhilHealth deduction',
        'eClaims',
        'Track yearly sessions',
      ],
      <div className="note-box blue" style={{ marginBottom: 12 }}>
        Current PhilHealth coverage provides up to <strong>156 hemodialysis sessions per calendar
        year</strong> for qualified CKD Stage 5 patients, at a package rate of{' '}
        <strong>₱6,350 per treatment session</strong>. GCMCC additionally screens renal patients for
        Arteriovenous fistula insertion and IJ catheter insertion.
      </div>,
    )

  // ---------- NBB FLOW (Adult PhilHealth No Balance Billing Ecosystem) ----------
  const renderNbbFlow = () => {
    const totalSteps = 10
    const stepTitles = [
      '1. Patient Entry Gate',
      '2. PhilHealth Eligibility Gate',
      '3. Accommodation Gate',
      '4. Adult Clinical Engine',
      '5. Ancillary Services',
      '6. Daily Utilization Review',
      '7. Discharge Readiness Gate',
      '8. NBB Billing Control',
      '9. Claims / eClaims 3.0',
      '10. Finance + Quality Audit',
    ]

    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="result-header teal">
          <h2>Adult PhilHealth No Balance Billing Ecosystem</h2>
          <p>Interactive process · Step {processStep + 1} of {totalSteps}</p>
          <div className="badge">Indigent · NBB</div>
        </div>

        <ProgressDots step={processStep + 1} total={totalSteps} />

        <ul className="flow-steps" style={{ marginBottom: 16 }}>
          {stepTitles.map((t, i) => (
            <li
              key={i}
              style={{
                opacity: i === processStep ? 1 : i < processStep ? 0.85 : 0.45,
                borderColor: i === processStep ? 'var(--teal, #00897b)' : undefined,
                background: i === processStep ? '#e0f2f1' : undefined,
              }}
            >
              <span
                className="step-num"
                style={{ background: i <= processStep ? '#00897b' : 'var(--border)' }}
              >
                {i + 1}
              </span>
              <div>
                <strong>{t}</strong>
                {i < processStep && i === 2 && nbbAccom && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    {nbbAccom === 'basic'
                      ? 'YES Basic/Ward → NBB ACTIVE ZERO CO-PAY'
                      : 'NO → Non-Basic / Co-Pay Path'}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="section-block">
          {processStep === 0 && (
            <>
              <h4>1. Patient Entry Gate</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 10 }}>
                Adult patient enters via <strong>ER</strong>, <strong>Direct Admission</strong>, or{' '}
                <strong>Transfer-In</strong>.
              </p>
              <ul className="flow-steps" style={{ marginBottom: 12 }}>
                <li>
                  <span className="step-num">A</span> Triage + Stabilization
                </li>
                <li>
                  <span className="step-num">B</span> Physician Assessment
                </li>
                <li>
                  <span className="step-num">C</span> Inpatient Admission Needed?
                </li>
              </ul>
              <div className="card-grid" style={{ marginBottom: 12 }}>
                <button
                  className="choice-card"
                  onClick={() => {
                    setDetailView('main')
                    setErSub('non-admissible')
                    setProcessStep(0)
                    setPath((p) => [...p.slice(0, 4), 'Non-Admissible (OECB)'])
                  }}
                >
                  <h3>NO</h3>
                  <p>→ Outpatient / OECB if applicable</p>
                </button>
                <button
                  className="choice-card green-card"
                  onClick={() => setProcessStep(1)}
                >
                  <h3>YES</h3>
                  <p>→ Admission Order → continue NBB path</p>
                </button>
              </div>
            </>
          )}

          {processStep === 1 && (
            <>
              <h4>2. PhilHealth Eligibility Gate</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Verify member status and PhilHealth eligibility for NBB (indigent / sponsored /
                applicable membership category).
              </p>
              <ul className="checklist">
                <li>Verify member / eligibility (PIN, membership type, benefit availability)</li>
                <li>Confirm patient qualifies for No Balance Billing rules</li>
              </ul>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setProcessStep(2)}>
                Proceed to Accommodation Gate →
              </button>
            </>
          )}

          {processStep === 2 && (
            <>
              <h4>3. Accommodation Gate — Basic / Ward?</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                NBB applies when the patient is admitted to <strong>basic / ward</strong> accommodation.
              </p>
              {!nbbAccom ? (
                <div className="card-grid">
                  <button
                    className="choice-card green-card"
                    onClick={() => {
                      setNbbAccom('basic')
                      setProcessStep(3)
                    }}
                  >
                    <h3>YES — Basic / Ward</h3>
                    <p>→ NBB ACTIVE · ZERO CO-PAY</p>
                  </button>
                  <button
                    className="choice-card"
                    onClick={() => {
                      setNbbAccom('nonbasic')
                      setProcessStep(3)
                    }}
                  >
                    <h3>NO — Non-Basic</h3>
                    <p>→ Non-Basic / Co-Pay Path</p>
                  </button>
                </div>
              ) : (
                <div className="note-box blue">
                  Selected:{' '}
                  {nbbAccom === 'basic'
                    ? 'Basic / Ward → NBB ACTIVE ZERO CO-PAY'
                    : 'Non-Basic / Co-Pay Path'}
                </div>
              )}
            </>
          )}

          {processStep === 3 && (
            <>
              <h4>4. Adult Clinical Engine</h4>
              {nbbAccom === 'basic' && (
                <div className="note-box blue" style={{ marginBottom: 12 }}>
                  <strong>NBB ACTIVE · ZERO CO-PAY</strong> — continue clinical management under NBB
                  rules.
                </div>
              )}
              {nbbAccom === 'nonbasic' && (
                <div className="note-box blue" style={{ marginBottom: 12 }}>
                  Non-basic accommodation follows the <strong>co-pay path</strong> (NBB may not fully
                  apply).
                </div>
              )}
              <p style={{ fontSize: '0.88rem', marginBottom: 10 }}>Service lines:</p>
              <ul className="checklist">
                <li>Internal Medicine</li>
                <li>Surgery</li>
                <li>Specialty Care</li>
              </ul>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setProcessStep(4)}>
                Proceed to Ancillary Services →
              </button>
            </>
          )}

          {processStep === 4 && (
            <>
              <h4>5. Ancillary Services</h4>
              <ul className="checklist">
                <li>Pharmacy</li>
                <li>Lab</li>
                <li>Radiology</li>
                <li>Blood Bank</li>
                <li>Respiratory / Other Services</li>
              </ul>
              <div className="note-box blue" style={{ marginTop: 12, marginBottom: 12 }}>
                <strong>NO DIRECT NBB COLLECTION</strong> at ancillary service points for covered NBB
                patients.
              </div>
              <button className="btn btn-primary" onClick={() => setProcessStep(5)}>
                Proceed to Daily Utilization Review →
              </button>
            </>
          )}

          {processStep === 5 && (
            <>
              <h4>6. Daily Utilization Review</h4>
              <ul className="checklist">
                <li>Medical necessity</li>
                <li>Comorbidity review</li>
                <li>Antibiotic stewardship</li>
                <li>LOS review</li>
                <li>Specialist need</li>
                <li>ICU escalation</li>
              </ul>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setProcessStep(6)}>
                Proceed to Discharge Readiness Gate →
              </button>
            </>
          )}

          {processStep === 6 && (
            <>
              <h4>7. Discharge Readiness Gate</h4>
              <ul className="flow-steps" style={{ marginBottom: 12 }}>
                <li>
                  <span className="step-num">A</span> Final Diagnosis + Procedures
                </li>
                <li>
                  <span className="step-num">B</span> ICD-10 / RVS Coding
                </li>
              </ul>
              <button className="btn btn-primary" onClick={() => setProcessStep(7)}>
                Proceed to NBB Billing Control →
              </button>
            </>
          )}

          {processStep === 7 && (
            <>
              <h4>8. NBB Billing Control</h4>
              <ul className="flow-steps" style={{ marginBottom: 12 }}>
                <li>
                  <span className="step-num">A</span> Apply applicable PhilHealth benefit
                </li>
                <li>
                  <span className="step-num">B</span> NBB Reconciliation
                </li>
                <li>
                  <span className="step-num">C</span> Covered patient payable = <strong>₱0</strong>
                </li>
                <li>
                  <span className="step-num">D</span> Discharge
                </li>
              </ul>
              <div className="note-box blue" style={{ marginBottom: 12 }}>
                For qualified NBB patients in basic accommodation, covered services should result in{' '}
                <strong>₱0 patient payable</strong> after PhilHealth benefit application.
              </div>
              <button className="btn btn-primary" onClick={() => setProcessStep(8)}>
                Proceed to Claims / eClaims →
              </button>
            </>
          )}

          {processStep === 8 && (
            <>
              <h4>9. Claims / eClaims 3.0</h4>
              <ul className="checklist">
                <li>CF4 + CF5</li>
                <li>eSOA</li>
                <li>PhilHealth adjudication</li>
              </ul>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setProcessStep(9)}>
                Proceed to Finance + Quality Audit →
              </button>
            </>
          )}

          {processStep === 9 && (
            <>
              <h4>10. Finance + Quality Audit</h4>
              <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                Close the loop with finance and quality review, then feed results into the KPI /
                Management Loop.
              </p>
              <ul className="checklist">
                <li>Finance + Quality Audit</li>
                <li>KPI / Management Loop</li>
              </ul>
              <div className="note-box blue" style={{ marginTop: 12, marginBottom: 12 }}>
                NBB ecosystem process complete.
              </div>
              <button className="btn btn-primary" onClick={goToCoordination}>
                Continue to Benefit Coordination →
              </button>
            </>
          )}
        </div>

        <div className="nav-row">
          <button
            className="btn btn-outline"
            onClick={() => {
              if (processStep > 0) {
                if (processStep === 3 && nbbAccom) {
                  setNbbAccom(null)
                  setProcessStep(2)
                } else {
                  setProcessStep((s) => s - 1)
                }
              } else {
                setDetailView('main')
                setProcessStep(0)
                setNbbAccom(null)
              }
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ---------- BENEFIT DETAIL (SCREEN 5) ----------
  const renderBenefitDetail = () => {
    if (detailView === 'oecb-tables') return renderOecbTables()
    if (detailView === 'acr-flow') return renderAcrFlow()
    if (detailView === 'z-flow') return renderZFlow()
    if (detailView === 'animal-flow') return renderAnimalFlow()
    if (detailView === 'rehab-flow') return renderRehabFlow()
    if (detailView === 'dialysis-flow') return renderDialysisFlow()
    if (detailView === 'nbb-flow') return renderNbbFlow()
    if (yakapSub === 'cancer' && cancerStep) return renderCancerFlow()
    if (yakapSub === 'gamot') return renderGamotFlow()

    // ER Admissible
    if (benefitType === 'er' && erSub === 'admissible') {
      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header red">
            <h2>Admissible – ER → Inpatient</h2>
            <p>Patient will be admitted · Emergency Ecosystem disposition: Admission Order</p>
            <div className="badge">Inpatient Pathway</div>
          </div>
          <div className="section-label">PhilHealth benefits to apply</div>
          <div className="component-list">
            <button
              type="button"
              className="component-card"
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => {
                setProcessStep(0)
                setAcrPackage(null)
                setDetailView('acr-flow')
              }}
            >
              <div className="comp-icon">📄</div>
              <div>
                <h4>1. Paying: ACR →</h4>
                <p>All Case Rate based on final diagnosis and procedures. Click to open ACR flow.</p>
              </div>
            </button>
            <button
              type="button"
              className="component-card"
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: '2px solid #00897b',
              }}
              onClick={() => {
                setProcessStep(0)
                setNbbAccom(null)
                setDetailView('nbb-flow')
              }}
            >
              <div className="comp-icon">🏥</div>
              <div>
                <h4>2. Indigent: NBB →</h4>
                <p>
                  No Balance Billing for qualified indigent members in basic accommodation. Click to
                  open Adult NBB Ecosystem.
                </p>
              </div>
            </button>
            <div className="component-card">
              <div className="comp-icon">📦</div>
              <div>
                <h4>3. Enhanced Special Inpatient Packages</h4>
                <p>When applicable after Special Package Screen.</p>
              </div>
            </div>
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setProcessStep(0)
                setAcrPackage(null)
                setDetailView('acr-flow')
              }}
            >
              View Inpatient ACR Flow →
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setProcessStep(0)
                setNbbAccom(null)
                setDetailView('nbb-flow')
              }}
            >
              View NBB Ecosystem →
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
            <p>Outpatient Emergency Care Benefit · Patient discharged / resolved within 24 hours</p>
            <div className="badge">ER Outpatient · No Admission</div>
          </div>
          <div className="section-label">OECB covers</div>
          <div className="component-list">
            <div className="component-card">
              <div className="comp-icon">🚑</div>
              <div>
                <h4>Emergency Department Care</h4>
                <p>Treatment at accredited ER without admission for qualifying presentations.</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">💊</div>
              <div>
                <h4>Medicines & Supplies</h4>
                <p>Used during the ER stay for covered emergency symptoms (EECL).</p>
              </div>
            </div>
            <div className="component-card">
              <div className="comp-icon">🔬</div>
              <div>
                <h4>Diagnostics</h4>
                <p>Labs and imaging needed for emergency management when listed.</p>
              </div>
            </div>
          </div>
          <div className="note-box blue">
            Based on PhilHealth’s list of emergency symptoms / 27 core presentations. Patient is
            treated and discharged within 24 hours with OECB signs and symptoms.
          </div>
          <div
            className="note-box"
            style={{
              marginTop: 10,
              background: '#fff8e1',
              borderColor: '#f9a825',
              color: '#5d4037',
            }}
          >
            <strong>WATCH OUT:</strong> Do not use OECB if an admission order was issued, stay exceeds
            24 hours without disposition, another package (e.g. Animal Bite) governs the episode, the
            item is not on the EECL, or OECB is double-filed with resuscitation for the same episode.
            See full exclusions in OECB Tables → Exclusions.
          </div>
          <div className="nav-row">
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setOecbTab('exclusions')
                setDetailView('oecb-tables')
              }}
            >
              View OECB Exclusions →
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setOecbTab('overview')
                setDetailView('oecb-tables')
              }}
            >
              View OECB Tables →
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    // YAKAP Standard
    if (benefitType === 'yakap' && yakapSub === 'standard') {
      const yakapSteps = [
        {
          title: 'OPD / Discharged Patient',
          body: 'Patient presents as OPD or after discharge. Begin YAKAP pathway.',
        },
        {
          title: 'YAKAP Check (Registered / Not Registered)',
          body: 'Verify whether the patient is already registered under YAKAP.',
          choices: [
            { label: 'Registered', nextNote: 'Proceed to Access YAKAP Care' },
            { label: 'NOT Registered', nextNote: 'Assist with Selection / Registration' },
          ],
        },
        {
          title: 'Access YAKAP Care or Assist with Selection / Registration',
          body: 'Registered patients access YAKAP care. Unregistered patients are assisted with program selection and registration.',
        },
        {
          title: 'First Patient Encounter / Risk Assessment',
          body: 'Complete first encounter documentation and risk assessment (including cancer risk profiling when indicated).',
          riskLink: true,
        },
        {
          title: 'Consultation → Labs · Gamot · Cancer Screening',
          body: 'Physician consultation. Route to Labs, Gamot ecosystem, and/or Cancer Screening pathway as clinically indicated.',
          services: true,
        },
        {
          title: 'Follow-up / Referral',
          body: 'Schedule YAKAP follow-up or refer to specialty / higher-level care as needed.',
        },
      ]
      const total = yakapSteps.length
      const current = yakapSteps[processStep] || yakapSteps[0]

      return (
        <div className="screen">
          <PathBreadcrumb path={path} />
          <div className="result-header green">
            <h2>YAKAP PHIC Benefits</h2>
            <p>Interactive process · Step {processStep + 1} of {total}</p>
            <div className="badge">YAKAP · Primary Care</div>
          </div>

          <ProgressDots step={processStep + 1} total={total} />

          <ul className="flow-steps" style={{ marginBottom: 16 }}>
            {yakapSteps.map((s, i) => (
              <li
                key={i}
                style={{
                  opacity: i === processStep ? 1 : i < processStep ? 0.85 : 0.45,
                  borderColor: i === processStep ? 'var(--green)' : undefined,
                  background: i === processStep ? 'var(--green-light)' : undefined,
                }}
              >
                <span
                  className="step-num"
                  style={{ background: i <= processStep ? 'var(--green)' : 'var(--border)' }}
                >
                  {i + 1}
                </span>
                <strong>{s.title}</strong>
              </li>
            ))}
          </ul>

          <div className="section-block">
            <h4>
              Step {processStep + 1} — {current.title}
            </h4>
            <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>{current.body}</p>

            {current.choices && processStep === 1 && (
              <div className="card-grid" style={{ marginBottom: 12 }}>
                {current.choices.map((c) => (
                  <button
                    key={c.label}
                    className="choice-card green-card"
                    onClick={() => setProcessStep(2)}
                  >
                    <h3>{c.label}</h3>
                    <p>{c.nextNote}</p>
                  </button>
                ))}
              </div>
            )}

            {current.riskLink && (
              <button
                type="button"
                className="choice-card"
                style={{ marginBottom: 12, width: '100%' }}
                onClick={() => {
                  setYakapSub('cancer')
                  setCancerStep('risk')
                  setCancerScreenType(null)
                  setProcessStep(0)
                  setPath((p) => {
                    const base = p.slice(0, 4)
                    return [...base, 'YAKAP Cancer Screening']
                  })
                }}
              >
                <div className="icon">🎗️</div>
                <h3>Open Cancer Screening Pathway →</h3>
                <p>If cancer risk is identified during risk assessment</p>
              </button>
            )}

            {current.services && (
              <div className="component-list" style={{ marginBottom: 12 }}>
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
                    <h4>Diagnostics / Lab</h4>
                    <p>CBC, urinalysis, FBS, lipid profile, chest X-ray, and other YAKAP labs.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="component-card green"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '2px solid var(--green)',
                    fontFamily: 'inherit',
                  }}
                  onClick={() => {
                    setYakapSub('gamot')
                    setProcessStep(0)
                    setGamotRx(null)
                    setGamotBranch(null)
                    setGamotDispensed(null)
                    setPath((p) => {
                      const base = p.slice(0, 4)
                      return [...base, 'Gamot Ecosystem']
                    })
                  }}
                >
                  <div className="comp-icon">💊</div>
                  <div>
                    <h4>Gamot (Medicines) →</h4>
                    <p>Essential outpatient medicines under the GAMOT benefit. Click to open Gamot pathway.</p>
                  </div>
                </button>
                <button
                  type="button"
                  className="component-card"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '2px solid var(--blue)',
                    fontFamily: 'inherit',
                  }}
                  onClick={() => {
                    setYakapSub('cancer')
                    setCancerStep('risk')
                    setCancerScreenType(null)
                    setProcessStep(0)
                    setPath((p) => {
                      const base = p.slice(0, 4)
                      return [...base, 'YAKAP Cancer Screening']
                    })
                  }}
                >
                  <div className="comp-icon">🎗️</div>
                  <div>
                    <h4>Cancer Screening →</h4>
                    <p>Risk profiling and appropriate screen when indicated. Click to open Cancer Screening pathway.</p>
                  </div>
                </button>
              </div>
            )}

            {processStep < total - 1 ? (
              processStep !== 1 && (
                <button className="btn btn-primary" onClick={() => setProcessStep((s) => s + 1)}>
                  Next Step →
                </button>
              )
            ) : (
              <button className="btn btn-primary" onClick={goToCoordination}>
                Continue to Benefit Coordination →
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
    }

    // Special Packages
    if (
      (benefitType === 'daysurgery' || benefitType === 'specialized') &&
      specialPkg
    ) {
      const titles: Record<string, string> = {
        woundcare: 'Woundcare',
        endoscopy: 'Endoscopy',
        hsg: 'HSG',
        dialysis: 'Hemodialysis',
        chemo: 'Chemotherapy',
        radio: 'Radiotherapy',
        blood: 'Blood Transfusion',
        animalbite: 'Animal Bite Package',
        rehab: 'Rehab Package',
        ami: 'AMI Package',
        maternity: 'Maternity & New Born Package',
      }

      if (specialPkg === 'animalbite') {
        return (
          <div className="screen">
            <PathBreadcrumb path={path} />
            <div className="result-header blue">
              <h2>Animal Bite Package</h2>
              <p>₱5,850 · Accredited ABTC pathway</p>
              <div className="badge">Specialized Therapy</div>
            </div>
            <div className="component-list">
              <div className="component-card">
                <div className="comp-icon">🐶</div>
                <div>
                  <h4>Package Application</h4>
                  <p>Apply the PhilHealth Animal Bite Treatment Package rates and rules.</p>
                </div>
              </div>
            </div>
            <div className="nav-row">
              <button className="btn btn-outline" onClick={goBack}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setProcessStep(0)
                  setDetailView('animal-flow')
                }}
              >
                Start Animal Bite Pathway →
              </button>
            </div>
          </div>
        )
      }

      if (specialPkg === 'rehab') {
        return (
          <div className="screen">
            <PathBreadcrumb path={path} />
            <div className="result-header blue">
              <h2>Rehab Package</h2>
              <p>Physical Medicine, Rehabilitation & Assistive Devices</p>
              <div className="badge">Specialized Therapy</div>
            </div>
            <div className="component-list">
              <div className="component-card">
                <div className="comp-icon">🦾</div>
                <div>
                  <h4>Package Application</h4>
                  <p>Screen for rehab / Z / assistive-device package eligibility.</p>
                </div>
              </div>
            </div>
            <div className="nav-row">
              <button className="btn btn-outline" onClick={goBack}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setProcessStep(0)
                  setDetailView('rehab-flow')
                }}
              >
                Start Rehabilitation Pathway →
              </button>
            </div>
          </div>
        )
      }

      if (specialPkg === 'dialysis') {
        return (
          <div className="screen">
            <PathBreadcrumb path={path} />
            <div className="result-header blue">
              <h2>Hemodialysis</h2>
              <p>CKD Stage 5 · ₱6,350 per session · up to 156 sessions/year</p>
              <div className="badge">Specialized Therapy</div>
            </div>
            <div className="component-list">
              <div className="component-card">
                <div className="comp-icon">🩺</div>
                <div>
                  <h4>Package Application</h4>
                  <p>PhilHealth Dialysis Database requirements and accredited facility pathway.</p>
                </div>
              </div>
            </div>
            <div className="nav-row">
              <button className="btn btn-outline" onClick={goBack}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setProcessStep(0)
                  setDetailView('dialysis-flow')
                }}
              >
                Start Hemodialysis Pathway →
              </button>
            </div>
          </div>
        )
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
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
            <button className="btn btn-primary" onClick={goToCoordination}>Continue to Benefit Coordination →</button>
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
            <button className="btn btn-outline" onClick={goBack}>← Back</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setProcessStep(0)
                setZQualified(null)
                setDetailView('z-flow')
              }}
            >
              View Full Z Benefits Process →
            </button>
            <button className="btn btn-primary" onClick={goToCoordination}>
              Continue to Benefit Coordination →
            </button>
          </div>
        </div>
      )
    }

    // Safety: never blank
    return (
      <div className="screen">
        <PathBreadcrumb path={path} />
        <div className="note-box blue">
          This step could not be displayed. Use Back or return to classification.
        </div>
        <div className="nav-row">
          <button className="btn btn-outline" onClick={goBack}>
            ← Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setScreen(3)
              setPath((p) => (p.length >= 3 ? p.slice(0, 3) : ['Start', '…', 'Clinical Classification']))
              setBenefitType(null)
              clearSubState()
            }}
          >
            Clinical Classification →
          </button>
        </div>
      </div>
    )
  }

  const renderScreen5 = () => renderBenefitDetail()

  // ---------- SCREEN 6 ----------
  const renderScreen6 = () => (
    <div className="screen">
      <PathBreadcrumb path={path} />
      <div className="result-header blue">
        <h2>Benefit Coordination Engine</h2>
        <p>From package identification to post-discharge continuity</p>
        <div className="badge">Coordination · Billing · Claims</div>
      </div>

      <div className="section-label">Process flow (from overall GCC PhilHealth Ecosystem)</div>
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
        <button
          type="button"
          className="choice-card green-card"
          onClick={() => {
            setBenefitType('yakap')
            setYakapSub('standard')
            setProcessStep(0)
            setDetailView('main')
            setCancerStep(null)
            setScreen(5)
            setPath(['Start', 'Post-Discharge', 'YAKAP Follow-up'])
          }}
        >
          <div className="icon">💚</div>
          <h3>YAKAP Follow-up →</h3>
          <p>Primary care follow-up under YAKAP</p>
        </button>
        <button
          type="button"
          className="choice-card"
          onClick={() => {
            setBenefitType('yakap')
            setYakapSub('gamot')
            setProcessStep(0)
            setGamotRx(null)
            setGamotBranch(null)
            setGamotDispensed(null)
            setDetailView('main')
            setCancerStep(null)
            setScreen(5)
            setPath(['Start', 'Post-Discharge', 'Gamot Ecosystem'])
          }}
        >
          <div className="icon">💊</div>
          <h3>Gamot Medicines →</h3>
          <p>Thru Pharmacy & MedPure · Open Gamot pathway</p>
        </button>
        <button
          type="button"
          className="choice-card"
          onClick={() => {
            setBenefitType('yakap')
            setYakapSub('standard')
            setProcessStep(5)
            setDetailView('main')
            setCancerStep(null)
            setScreen(5)
            setPath(['Start', 'Post-Discharge', 'Follow-up / Referral'])
          }}
        >
          <div className="icon">🔗</div>
          <h3>Follow-up / Referral →</h3>
          <p>Specialty or higher-level care linkage</p>
        </button>
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
        <button className="btn btn-outline" onClick={goBack}>← Back</button>
        <button className="btn btn-primary" onClick={restart}>New Patient</button>
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

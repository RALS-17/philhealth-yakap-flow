import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  COMPLETION_EDIT_WINDOW_MS,
  canEditCompletion,
  CANCEL_REASONS,
  deleteBenefitsCompletion,
  findSameDayRecords,
  deleteBenefitsSession,
  extendBenefitsSession,
  fetchRecentBenefitsCompletions,
  formatBenefitsDisplayPath,
  formatTimeLeft,
  isSessionExpiringSoon,
  listBenefitsSessions,
  logBenefitsEvent,
  newBenefitsSessionId,
  renameBenefitsCompletion,
  saveBenefitsCompletion,
  sessionTimeLeftMs,
  upsertBenefitsSession,
  type BenefitsCompletion,
  type BenefitsSession,
  type BenefitsSnapshot,
} from './lib/benefitsStore'
import SyncBadge from './SyncBadge'
import { EGAMOT_54_BY_CATEGORY, GAMOT_21_BY_CATEGORY } from './lib/gamotLists'

type PayType = 'cash' | 'hmo' | null

type ProgramDef = {
  id: string
  name: string
  short: string
  /** Included benefits / notes shown on the program card */
  includes?: string[]
  steps: { title: string; body: string }[]
}

/** Free Cancer Screening options (notes = who can avail; steps = how to avail) */
type FreeCancerScreenId =
  | 'breast-ultrasound'
  | 'mammogram'
  | 'afp'
  | 'liver-ultrasound'
  | 'ldct'
  | 'colonoscopy'

type FreeCancerScreen = {
  id: FreeCancerScreenId
  name: string
  short: string
  whoCanAvail: string[]
  howToAvail: { title: string; body: string }[]
  /** After how-to-avail steps, open Inter Global Referral */
  linkToInterGlobal?: boolean
}

const HOW_TO_AVAIL_COMMON: { title: string; body: string }[] = [
  {
    title: 'Physician evaluation',
    body: 'Undergo evaluation with a physician to determine eligibility based on PhilHealth YAKAP guidelines.',
  },
  {
    title: 'Cancer Screening Request Form',
    body: 'Receive a Cancer Screening Request Form if qualified.',
  },
  {
    title: 'Present form & PhilHealth details',
    body: 'Present the request form and PhilHealth details to proceed with the screening test.',
  },
  {
    title: 'Avail screening — NO CASH-OUT / NO BALANCE BILLING',
    body: 'Avail the screening with NO CASH-OUT and NO BALANCE BILLING.',
  },
]

const FREE_CANCER_SCREENS: FreeCancerScreen[] = [
  {
    id: 'breast-ultrasound',
    name: 'Breast Ultrasound',
    short: 'Free Cancer Screening',
    whoCanAvail: [
      'Women aged 50–69 years old (every year)',
      'Women aged 40–49 years old (every 2 years) with:',
      '• Family history of breast cancer',
      '• Previous history of breast cancer',
    ],
    howToAvail: HOW_TO_AVAIL_COMMON,
  },
  {
    id: 'mammogram',
    name: 'Mammogram',
    short: 'Free Cancer Screening → then Inter Global Referral',
    whoCanAvail: [
      'Women aged 50–69 years old (every year)',
      'Women aged 40–49 years old (every 2 years) with:',
      '• Family history of breast cancer',
      '• Previous history of breast cancer',
    ],
    howToAvail: HOW_TO_AVAIL_COMMON,
    linkToInterGlobal: true,
  },
  {
    id: 'afp',
    name: 'Alpha Fetoprotein (AFP) Blood Test',
    short: 'Free Cancer Screening',
    whoCanAvail: [
      'Individuals with any of the following:',
      '• Hepatitis B or C',
      '• Heavy alcohol consumption',
      '• Diabetes',
      '• Fatty liver disease',
      '• Cirrhosis',
      '• Inherited metabolic diseases',
    ],
    howToAvail: HOW_TO_AVAIL_COMMON,
  },
  {
    id: 'liver-ultrasound',
    name: 'Liver Ultrasound',
    short: 'Free Cancer Screening',
    whoCanAvail: [
      'Individuals with any of the following:',
      '• Hepatitis B or C',
      '• Heavy alcohol consumption',
      '• Diabetes',
      '• Fatty liver disease',
      '• Cirrhosis',
      '• Inherited metabolic diseases',
    ],
    howToAvail: HOW_TO_AVAIL_COMMON,
  },
  {
    id: 'ldct',
    name: 'Low-Dose Chest CT Scan',
    short: 'Free Cancer Screening',
    whoCanAvail: [
      'Adults 50 years old and above (recommended every year)',
      'With any of the following:',
      '• Current smoker',
      '• Former smoker',
      '• Family history of lung cancer',
    ],
    howToAvail: HOW_TO_AVAIL_COMMON,
  },
  {
    id: 'colonoscopy',
    name: 'Colonoscopy',
    short: 'Free Cancer Screening',
    whoCanAvail: [
      'Adults 50 years old and above (recommended every year)',
      'With any of the following:',
      '• Current smoker',
      '• Former smoker',
      '• Family history of lung cancer',
    ],
    howToAvail: HOW_TO_AVAIL_COMMON,
  },
]

/** Steps copied from the flow guide (App.tsx) for each matching package. */
const PROGRAMS: ProgramDef[] = [
  {
    id: 'oecb',
    name: 'OECB',
    short: 'Outpatient Emergency Care Benefit · Non-Admissible ER (27 emergency symptoms)',
    steps: [
      { title: 'OECB overview', body: 'Non-Admissible OECB covers and watch-outs.' },
      { title: 'OECB tables', body: 'Reference tables and exclusions.' },
      { title: 'Benefit coordination', body: 'Coordinate billing and claims.' },
      { title: 'Complete', body: 'End pathway.' },
    ],
  },
  {
    id: 'acr',
    name: 'Inpatient ACR',
    short: 'Admissible · All Case Rates (paying / standard inpatient ACR)',
    steps: [
      {
        title: 'Admission Order',
        body: 'Patient requires admission. Issue the admission order to enter the inpatient ecosystem.',
      },
      {
        title: 'Final / Working Diagnosis',
        body: 'Establish the final or working diagnosis that will drive case rate selection.',
      },
      {
        title: 'ICD-10 + Procedures Identified',
        body: 'Identify the applicable ICD-10 diagnosis code(s) and procedure code(s).',
      },
      {
        title: 'Special Package Screen',
        body: 'Screen whether a special or enhanced package applies (YES → Special / Enhanced Package; NO → Standard ACR).',
      },
      {
        title: 'Second Case Rate Check',
        body: 'Perform the second case rate check after primary package selection.',
      },
      {
        title: 'PBEF / CF2 / CF4 / CF5 / eSOA',
        body: 'Complete required claim forms: PBEF / CF2 / CF4 / CF5 / eSOA as applicable.',
      },
      {
        title: 'Benefit Deduction',
        body: 'Apply the PhilHealth benefit deduction to the patient bill.',
      },
      {
        title: 'eClaims',
        body: 'Submit claims via eClaims. Process complete.',
      },
    ],
  },
  {
    id: 'nbb',
    name: 'NBB',
    short: 'Indigent · No Balance Billing (Adult PhilHealth NBB Ecosystem)',
    includes: [
      'NSD',
      'CS',
      'Mastectomy',
      'Curettage',
      'Basic Sleep Study',
      'Others (as applicable under NBB)',
    ],
    steps: [
      {
        title: '1. Patient Entry Gate',
        body: 'Patient enters the facility. Confirm presentation for admission pathway under NBB screening.',
      },
      {
        title: '2. PhilHealth Eligibility Gate',
        body: 'Verify member status and PhilHealth eligibility for NBB (indigent / sponsored / eligible category).',
      },
      {
        title: '3. Endorsement to Social Worker',
        body: 'Endorse the patient to the Social Worker for interview on socio-economic status (socio status) to support NBB classification and documentation.',
      },
      {
        title: '4. Accommodation Gate',
        body: 'NBB applies when admitted to basic / ward accommodation (YES → NBB ACTIVE ZERO CO-PAY; non-basic follows co-pay path).',
      },
      {
        title: '5. Adult Clinical Engine',
        body: 'Continue clinical management under NBB rules for the adult inpatient episode.',
      },
      {
        title: '6. Ancillary Services',
        body: 'NO DIRECT NBB COLLECTION at ancillary service points for covered NBB services.',
      },
      {
        title: '7. Daily Utilization Review',
        body: 'Review daily utilization to keep the case aligned with NBB coverage and documentation.',
      },
      {
        title: '8. Discharge Readiness Gate',
        body: 'Confirm discharge readiness and complete clinical discharge documentation.',
      },
      {
        title: '9. NBB Billing Control',
        body: 'Apply PhilHealth benefit · NBB reconciliation · Covered patient payable = ₱0 · Discharge.',
      },
      {
        title: '10. Claims / eClaims 3.0',
        body: 'Complete CF4 + CF5, eSOA, and PhilHealth adjudication.',
      },
      {
        title: '11. Finance + Quality Audit',
        body: 'Finance + Quality Audit · KPI / Management Loop. NBB ecosystem process complete.',
      },
    ],
  },
  {
    id: 'yakap-standard',
    name: 'YAKAP Standard',
    short: 'YAKAP Standard Benefits (OPD / primary care pathway)',
    includes: [
      'Primary care / consultation',
      'Laboratory',
      'Gamot lists & Cancer screening available at step 5 (optional)',
    ],
    steps: [
      {
        title: 'OPD / Discharged Patient',
        body: 'Patient presents as OPD or after discharge. Begin YAKAP pathway.',
      },
      {
        title: 'YAKAP Check (Registered / Not Registered)',
        body: 'Verify whether the patient is already registered under YAKAP. Registered → Access YAKAP Care. NOT Registered → Assist with Selection / Registration.',
      },
      {
        title: 'Access YAKAP Care or Assist with Selection / Registration',
        body: 'Registered patients access YAKAP care. Unregistered patients are assisted with program selection and registration.',
      },
      {
        title: 'First Patient Encounter / Risk Assessment',
        body: 'Complete first encounter documentation and risk assessment (including cancer risk profiling when indicated).',
      },
      {
        title: 'Consultation → Labs · Gamot · Cancer Screening',
        body: 'Physician consultation. Route to Labs, Gamot ecosystem, and/or Cancer Screening pathway as clinically indicated.',
      },
      {
        title: 'Follow-up / Referral',
        body: 'Schedule YAKAP follow-up or refer to specialty / higher-level care as needed.',
      },
    ],
  },
  {
    id: 'yakap-cancer',
    name: 'YAKAP Cancer Screening',
    short: 'YAKAP cancer screening pathway (risk → screen → result → referral / Z-Benefit)',
    steps: [
      {
        title: 'Cancer Risk Profiling',
        body: 'Complete cancer risk assessment as part of YAKAP first encounter / risk profiling.',
      },
      {
        title: 'Select Screening Type',
        body: 'Choose the screening type: Breast, Cervical, Colorectal, Prostate, or Free Cancer Screening (Breast Ultrasound, Mammogram, AFP, Liver Ultrasound, LDCT, Colonoscopy).',
      },
      {
        title: 'Screening Checklist',
        body: 'Complete pre-screening checklist, counseling, and required documentation before the test.',
      },
      {
        title: 'Perform Screening',
        body: 'Perform or schedule the approved screening test under YAKAP cancer screening rules.',
      },
      {
        title: 'Results Review',
        body: 'Review results: Normal → routine YAKAP follow-up. Abnormal → further work-up / referral.',
      },
      {
        title: 'Referral / Z-Benefit Gate',
        body: 'If confirmed malignancy or package-eligible condition, route to specialty care or open the Z Benefits Process as indicated. Optional: use the button below to open Z-Benefit (not required to finish this path).',
      },
    ],
  },
  {
    id: 'z-benefit',
    name: 'Z-Benefit',
    short: 'Z Benefits Process (catastrophic packages)',
    steps: [
      {
        title: '1. Identify Candidate Condition',
        body: 'Identify whether the patient condition is under an approved Z-Benefit package (e.g. selected cancers and other catastrophic packages).',
      },
      {
        title: '2. Confirm Package Match',
        body: 'Match the clinical case to the specific Z package criteria and documentation list.',
      },
      {
        title: '3. Onco Doctor Screening (ZBEN)',
        body: 'Oncology doctor screens the case to determine if the patient qualifies (pasok) for Z-Benefit (ZBEN).',
      },
      {
        title: '4. Check Clinical Criteria',
        body: 'Verify clinical criteria required by the package circular before pre-authorization.',
      },
      {
        title: '5. Complete Pre-auth / Required Documentation',
        body: 'Complete pre-authorization and all required Z-Benefit forms and supporting documents.',
      },
      {
        title: '6. Qualified → Enroll Package',
        body: 'Qualified → Enroll package → Treatment plan → Tranche / service documentation → Claims + follow-up.',
      },
      {
        title: '7. Not Qualified → ACR / Other Pathway',
        body: 'If not qualified for Z-Benefit, route to Inpatient ACR or the other applicable PhilHealth pathway.',
      },
    ],
  },
  {
    id: 'hemodialysis',
    name: 'Hemodialysis',
    short: 'Specialized Therapy · CKD Stage 5 · up to 156 sessions/year',
    steps: [
      {
        title: 'Hemodialysis',
        body: 'Specialized Therapy — Hemodialysis pathway selected. Coverage: up to 156 sessions/year for qualified CKD Stage 5 (package rate per session per current PhilHealth rules).',
      },
      {
        title: 'PHIC Coordinator',
        body: 'PhilHealth Coordinator screens the patient for hemodialysis benefit.',
      },
      {
        title: 'CKD-5 Patient',
        body: 'Confirm patient is CKD Stage 5 requiring hemodialysis.',
      },
      {
        title: 'Registration at Hemodialysis Unit',
        body: 'Patient registers at the Hemodialysis Unit.',
      },
      {
        title: 'Completion of PHIC Document',
        body: 'Complete required PhilHealth documents for the session.',
      },
      {
        title: 'Hemodialysis Session',
        body: 'Hemodialysis treatment session is performed. Document clinically required medications, laboratories, dialysis supplies, and professional/facility services.',
      },
      {
        title: 'Signing of PHIC Document',
        body: 'Patient/authorized person signs PhilHealth documents.',
      },
      {
        title: 'PhilHealth Deduction / eClaims',
        body: 'Apply PhilHealth deduction and submit eClaims. Track yearly sessions remaining.',
      },
      {
        title: 'Discharge / END',
        body: 'Patient is discharged after the hemodialysis session. Pathway complete for this session.',
      },
    ],
  },
  {
    id: 'chemo',
    name: 'Chemotherapy',
    short: 'Specialized Therapy · Chemotherapy (ZBEN screening path)',
    steps: [
      {
        title: 'Chemotherapy',
        body: 'Specialized Therapy — Chemotherapy pathway selected.',
      },
      {
        title: 'PHIC Coordinator — Z-Benefit Screen',
        body: 'PhilHealth Coordinator assesses Z-Benefit eligibility for chemotherapy. YES → endorse to ZBen Coordinator. NO → proceed as regular chemotherapy procedure.',
      },
      {
        title: 'Endorsed to ZBen-Coordinator',
        body: 'Case is endorsed to the Z-Benefit Coordinator (when ZBEN-eligible).',
      },
      {
        title: 'Consultation (Oncologist)',
        body: 'Patient consults with the Oncologist.',
      },
      {
        title: 'ZBen Coordinator processes application',
        body: 'Z-Benefit Coordinator processes the ZBEN application.',
      },
      {
        title: 'PHIC Approval of ZBen',
        body: 'Await PhilHealth approval of the Z-Benefit application. Approved → chemo per Oncologist schedule. Not approved → cash / HMO paying path.',
      },
      {
        title: 'Chemotherapy per schedule / END',
        body: 'ZBEN approved: chemotherapy proceeds per Oncologist schedule. Pathway complete for this cycle guidance.',
      },
    ],
  },
  {
    id: 'day-surgery',
    name: 'Day Surgery',
    short: 'Day Surgery / Procedure · doctor’s order required',
    includes: [
      'AVF',
      'Colonoscopy',
      'Nasal Endoscopy',
      'IJ Cut (with special endorsement)',
      'Woundcare · Endoscopy · HSG & similar',
    ],
    steps: [
      {
        title: 'Day Surgery pathway selected',
        body: 'Select the day-surgery / procedure track (e.g. Woundcare, Endoscopy, HSG, or other same-day procedure with PhilHealth case rate). Note: Patient must already bring the ORDER from the doctor (dapat dala na ang doctor’s order).',
      },
      {
        title: 'PHIC Coordinator Screening',
        body: 'PhilHealth Coordinator screens eligibility.',
      },
      {
        title: 'Pre-procedure requirements',
        body: 'Complete clearances, consent, member verification, and required pre-op documents.',
      },
      {
        title: 'Procedure performed',
        body: 'Same-day procedure is performed in the accredited facility.',
      },
      {
        title: 'Post-procedure documentation',
        body: 'Document operative notes, supplies, and discharge instructions.',
      },
      {
        title: 'Benefit deduction / eClaims',
        body: 'Apply PhilHealth benefit deduction and prepare eClaims / case rate filing.',
      },
      {
        title: 'Discharge / END',
        body: 'Patient discharged same day when clinically appropriate. Pathway complete.',
      },
    ],
  },
  {
    id: 'inter-global-referral',
    name: 'Inter Global Referral',
    short: 'Inter-Global Referral for Diagnostic Procedures (GCMCC NSD-ER-PF-004/N)',
    includes: [
      'In-Patient · ER · OPD / Walk-In',
      'Scheduler / CRO coordination',
      'Self-conduction or GCMCC / Global ambulance',
      'Radiation Therapy',
      'Brachy Therapy',
      'Cath Lab (Angiogram, Angioplasty)',
      'Eye Center (soon to open)',
      'Refer to QMS_MD-F-061/N for procedure list',
    ],
    steps: [
      {
        title: 'START — Patient type',
        body: 'Select entry: A. In-Patient · B. E.R. Patient · C. OPD / Walk-In. Attending Physician / NOD orders diagnostic procedures available at other Global hospitals (10–20 min).',
      },
      {
        title: 'Consultation',
        body: 'Complete consultation. For OPD/Walk-In: after consultation, AP/Consultant gives request for diagnostic procedures available at other Global Hospitals.',
      },
      {
        title: 'AP will give order / instruction',
        body: 'Attending Physician / Consultant / Patient / OPD Secretary — AP issues order or instruction (about 3–5 minutes).',
      },
      {
        title: 'Route desk (JCON / ROD / OPD)',
        body: 'A. In-Patient → JCON/NOD · B. ER → ROD/NOD · C. OPD/Walk-In → OPD Common Sec. Then proceed to Call Scheduler/CRO.',
      },
      {
        title: 'Call Scheduler / CRO',
        body: 'JCON/ROD/NOD/OPD Common Sec calls Scheduler/CRO to arrange schedule with other Global hospital (10–20 min). Scheduler/CRO informs GCMCC HA/AO for Medical and updates Viber Chat Group.',
      },
      {
        title: 'Inform GCMCC HA / AO for Medical',
        body: 'Scheduler/CRO Hospital Administrator / AO for Medical is informed of the inter-global diagnostic referral.',
      },
      {
        title: 'Coordinate with other Global hospital team',
        body: 'Scheduler/CRO coordinates schedule with other Global hospital team and updates the Viber Chat Group.',
      },
      {
        title: 'OPD/Walk-In — Self-Conduction?',
        body: 'For OPD/Walk-In only: Is this Self-Conduction? YES → Path B (patient/relative transport). NO → GCMCC Ambulance / Other Global Hospital Ambulance / Patient Transport Vehicle path. (ER / In-Patient use conduction path.)',
      },
      {
        title: 'Path B — Confirm final schedule (Self-Conduction YES)',
        body: 'Scheduler/CRO confirms final schedule of patient with the other Global Hospital and informs the patient.',
      },
      {
        title: 'Path B — Patient / relative arranges transportation',
        body: 'Patient or patient’s relative arranges their own transportation to the other Global Hospital.',
      },
      {
        title: 'Path B — Arrival at other Global Hospital → END',
        body: 'Patient arrives at the other Global Hospital for the diagnostic procedure. Self-conduction path complete (END).',
      },
      {
        title: 'Conduction — GCMCC / Global ambulance path (Self-Conduction NO)',
        body: 'Use GCMCC Ambulance, Other Global Hospital Ambulance, or Patient Transport Vehicle. Scheduler/CRO informs NOD of final schedule. NOD fills out Ambulance Conduction Form (must be approved/signed by SHO/Chief Nurse/Nurse Supervisor on duty). Form: GCMCC-QMS-NS-F-057.',
      },
      {
        title: 'Conduction — Facilitate & endorse',
        body: 'Conduction team facilitates conduction. Endorse patient to ER staff / section of the other Global Hospital in charge of the diagnostic procedure. Update Viber Chat Group and Inter-Global Hospital Scheduler Spreadsheet.',
      },
      {
        title: 'Conduction — Accounting & payment → END',
        body: 'After conduction, submit Ambulance Conduction Form to Accounting. Accounting issues payment to the conduction team. Pathway complete (END).',
      },
    ],
  },
  {
    id: 'direct-admission',
    name: 'Direct Admission',
    short: 'Planned inpatient · Elective procedure pathway',
    includes: [
      'Elective / planned admission',
      'Admitting · Coordinator · PCU Phil Benefits',
      'OR · Monitoring · Billing · Discharge',
    ],
    steps: [
      {
        title: 'Direct Admission',
        body: 'Patient enters via Direct Admission.',
      },
      {
        title: 'Elective Procedure',
        body: 'Planned / elective procedure pathway.',
      },
      {
        title: 'Admitting section (registration)',
        body: 'Patient registers at the Admitting section.',
      },
      {
        title: 'Coordinator',
        body: 'Case is coordinated for elective admission and procedure.',
      },
      {
        title: 'PCU Phil Benefits · Fill up form · Submit Reqs',
        body: 'PCU completes PhilHealth benefits forms and submits requirements. ER triage (vital signs) is also done as needed.',
      },
      {
        title: 'ER triage (Vital Signs)',
        body: 'Vital signs taken / ER triage as required before transfer.',
      },
      {
        title: 'Transfer (room of choice)',
        body: 'Patient is transferred to the room of choice.',
      },
      {
        title: 'Scheduled OR (For Procedure)',
        body: 'Patient proceeds to the scheduled Operating Room for the procedure.',
      },
      {
        title: 'For Monitoring (1–2 days)',
        body: 'Post-procedure monitoring for 1–2 days.',
      },
      {
        title: 'Order For Discharged',
        body: 'Physician issues the discharge order.',
      },
      {
        title: 'Billing · Deduct PHIC BEN',
        body: 'Billing prepares the account and deducts PhilHealth benefits. Choose mode of payment to continue: HMO or Cash.',
      },
      {
        title: 'Payment · Cashier',
        body: 'Settle remaining balance at Cashier (HMO with approved LOA, or Cash payment as applicable).',
      },
      {
        title: 'Clearance',
        body: 'Clearance is completed.',
      },
      {
        title: 'Discharged',
        body: 'Patient is discharged. Direct Admission pathway complete.',
      },
    ],
  },
]

type Screen = 'pay' | 'entry-options' | 'hmo-guide' | 'name' | 'programs' | 'steps' | 'done'

function pausedStepLabel(row: BenefitsSession): string {
  const snap = row.snapshot
  if (!snap.programId) return 'Program selection'
  const prog = PROGRAMS.find((x) => x.id === snap.programId)
  const name = snap.programName || prog?.name || 'Program'
  const total = prog?.steps?.length || 0
  const step = (snap.stepIndex || 0) + 1
  const stepTitle = prog?.steps?.[snap.stepIndex || 0]?.title
  if (stepTitle) return `${name} · Step ${step}${total ? ` of ${total}` : ''}: ${stepTitle}`
  return `${name} · Step ${step}`
}


/** Step progress bar (percent + current step title). */
function StepProgress({
  current,
  total,
  label,
}: {
  current: number
  total: number
  label?: string
}) {
  const safeTotal = Math.max(total, 1)
  const safeCurrent = Math.min(Math.max(current, 1), safeTotal)
  const pct = Math.round((safeCurrent / safeTotal) * 100)
  return (
    <div
      className="ben-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`Step ${safeCurrent} of ${safeTotal}`}
    >
      <div className="ben-progress-head">
        <strong>
          Step {safeCurrent} of {safeTotal}
        </strong>
        <span>{pct}%</span>
      </div>
      <div className="ben-progress-track">
        <div className="ben-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {label && <div className="ben-progress-label">{label}</div>}
    </div>
  )
}

/** "Recently used" programs are remembered per branch on this device. */
const RECENT_PROGRAMS_KEY = 'gcare-benefits-recent-programs-v1'
const RECENT_PROGRAMS_MAX = 4

function readRecentPrograms(siteCode: string): string[] {
  try {
    const raw = localStorage.getItem(`${RECENT_PROGRAMS_KEY}-${siteCode}`)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function rememberProgram(siteCode: string, programId: string): string[] {
  const next = [programId, ...readRecentPrograms(siteCode).filter((x) => x !== programId)].slice(
    0,
    RECENT_PROGRAMS_MAX,
  )
  try {
    localStorage.setItem(`${RECENT_PROGRAMS_KEY}-${siteCode}`, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** Saved position when branching into another program (Back returns here) */
type NavFrame = {
  programId: string
  stepIndex: number
  path: string[]
  oecbView: 'overview' | 'tables' | 'coordination'
  oecbTab: 'overview' | 'exclusions' | 'groups' | 'covered' | 'pathways'
  igrEntry: 'inpatient' | 'er' | 'opd' | null
  igrSelfConduction: 'yes' | 'no' | null
  cancerScreenType: 'breast' | 'cervical' | 'colorectal' | 'prostate' | FreeCancerScreenId | null
  cancerHowToIndex: number | null
  showGamotList: null | 'picker' | '54' | '21'
}

type Props = {
  onLogout?: () => void
  staffEmail?: string
  siteCode?: string
  siteName?: string
}

export default function BenefitsApp({
  onLogout,
  staffEmail,
  siteCode = 'gcmcc',
  siteName = 'Global Care',
}: Props) {
  const [screen, setScreen] = useState<Screen>('pay')
  const [payType, setPayType] = useState<PayType>(null)
  const [directAdmission, setDirectAdmission] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [programId, setProgramId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [path, setPath] = useState<string[]>(['Start'])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [paused, setPaused] = useState<BenefitsSession[]>([])
  const [pausedSearch, setPausedSearch] = useState('')
  const [pausedProgram, setPausedProgram] = useState('') // '' = all benefits, '__none' = not chosen yet
  const [pausedDateFrom, setPausedDateFrom] = useState('')
  const [pausedDateTo, setPausedDateTo] = useState('')
  const [sessionMsg, setSessionMsg] = useState<string | null>(null)
  const [staffMenuOpen, setStaffMenuOpen] = useState(false)
  const finishingRef = useRef(false)
  const [oecbView, setOecbView] = useState<'overview' | 'tables' | 'coordination'>('overview')
  const [oecbTab, setOecbTab] = useState<'overview' | 'exclusions' | 'groups' | 'covered' | 'pathways'>('overview')
  /** Inter Global Referral: entry type + OPD self-conduction branch */
  const [igrEntry, setIgrEntry] = useState<'inpatient' | 'er' | 'opd' | null>(null)
  const [igrSelfConduction, setIgrSelfConduction] = useState<'yes' | 'no' | null>(null)
  /** YAKAP step 5: show Gamot medicine lists (same as flow guide) */
  const [showGamotList, setShowGamotList] = useState<null | 'picker' | '54' | '21'>(null)
  const [cancerScreenType, setCancerScreenType] = useState<
    | 'breast'
    | 'cervical'
    | 'colorectal'
    | 'prostate'
    | FreeCancerScreenId
    | null
  >(null)
  /** When set, user is in Free Cancer Screening “How to avail” steps */
  const [cancerHowToIndex, setCancerHowToIndex] = useState<number | null>(null)
  const [navStack, setNavStack] = useState<NavFrame[]>([])
  const [offlineBanner, setOfflineBanner] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const [infoModal, setInfoModal] = useState<string | null>(null)
  const [cancelModal, setCancelModal] = useState<{ id: string; label: string; reason: string; note: string } | null>(null)
  const [programSearch, setProgramSearch] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentPrograms(siteCode))
  const [recentDone, setRecentDone] = useState<BenefitsCompletion[]>([])
  const [lastCompleted, setLastCompleted] = useState<BenefitsCompletion | null>(null)
  const [renameModal, setRenameModal] = useState<{
    target: BenefitsCompletion
    value: string
  } | null>(null)

  useEffect(() => {
    const logoPath = `${import.meta.env.BASE_URL}global-care-logo.svg`
    document.documentElement.style.setProperty('--logo-url', `url("${logoPath}")`)
  }, [])

  const program = useMemo(
    () => PROGRAMS.find((p) => p.id === programId) ?? null,
    [programId],
  )

  const filteredPaused = useMemo(() => {
    const q = pausedSearch.trim().toLowerCase()
    const fromMs = pausedDateFrom ? new Date(pausedDateFrom + 'T00:00:00').getTime() : null
    const toMs = pausedDateTo ? new Date(pausedDateTo + 'T23:59:59.999').getTime() : null
    return paused.filter((row) => {
      if (pausedProgram === '__none') {
        if (row.snapshot.programId) return false
      } else if (pausedProgram && row.snapshot.programId !== pausedProgram) return false
      if (q) {
        const name = (row.patientName || '').toLowerCase()
        const meta = pausedStepLabel(row).toLowerCase()
        if (!name.includes(q) && !meta.includes(q)) return false
      }
      const t = new Date(row.updatedAt || row.createdAt).getTime()
      if (fromMs !== null && Number.isFinite(fromMs) && t < fromMs) return false
      if (toMs !== null && Number.isFinite(toMs) && t > toMs) return false
      return true
    })
  }, [paused, pausedSearch, pausedProgram, pausedDateFrom, pausedDateTo])

  /** Benefits that currently have ongoing patients, with how many each. */
  const pausedProgramOptions = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>()
    let none = 0
    for (const row of paused) {
      const id = row.snapshot.programId
      if (!id) {
        none += 1
        continue
      }
      const name = row.snapshot.programName || PROGRAMS.find((x) => x.id === id)?.name || id
      const cur = counts.get(id)
      if (cur) cur.n += 1
      else counts.set(id, { name, n: 1 })
    }
    const list = [...counts.entries()]
      .map(([id, v]) => ({ id, name: v.name, n: v.n }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { list, none }
  }, [paused])


  /** Inter Global Referral steps filtered by entry + self-conduction branch */
  const activeProgramSteps = useMemo(() => {
    if (!program) return []
    if (program.id !== 'inter-global-referral') return program.steps
    const all = program.steps
    // indices: 0 entry, 1 consult, 2 AP order, 3 route, 4 call sched, 5 HA/AO, 6 coordinate,
    // 7 self-conduction question, 8-10 path B, 11-13 ambulance
    const common = all.slice(0, 7)
    const askSelf = all[7]
    const pathB = all.slice(8, 11)
    const ambulance = all.slice(11, 14)

    if (igrEntry === null) {
      return [all[0]]
    }
    // After entry chosen, show common through coordinate
    if (igrEntry === 'opd') {
      if (igrSelfConduction === null) {
        return [...common, askSelf]
      }
      if (igrSelfConduction === 'yes') {
        return [...common, askSelf, ...pathB]
      }
      return [...common, askSelf, ...ambulance]
    }
    // In-patient / ER → skip self-conduction question; use ambulance/conduction path
    return [...common, ...ambulance]
  }, [program, igrEntry, igrSelfConduction])

  const locationLabel = siteName.replace(/^Global Care\s*/i, '') || siteName

  const getSnapshot = useCallback((): BenefitsSnapshot => {
    return {
      payType,
      patientName,
      programId,
      programName: program?.name ?? null,
      stepIndex,
      path,
      startedAt: startedAt || new Date().toISOString(),
    }
  }, [payType, patientName, programId, program, stepIndex, path, startedAt])

  const refreshPaused = useCallback(async () => {
    const rows = await listBenefitsSessions(siteCode)
    setPaused(rows)
  }, [siteCode])

  useEffect(() => {
    void refreshPaused()
  }, [refreshPaused])

  const refreshRecentDone = useCallback(async () => {
    setRecentDone(await fetchRecentBenefitsCompletions(siteCode))
  }, [siteCode])

  useEffect(() => {
    if (screen === 'pay') void refreshRecentDone()
  }, [screen, refreshRecentDone])

  const expiringSoon = useMemo(() => paused.filter(isSessionExpiringSoon), [paused])

  /** Resets the 15-day expiry of a paused patient. */
  const keepSession = async (row: BenefitsSession) => {
    await extendBenefitsSession(row)
    await refreshPaused()
    setSessionMsg(`Kept "${row.patientName}" for another 15 days.`)
  }

  const keepAllExpiring = async () => {
    for (const row of expiringSoon) await extendBenefitsSession(row)
    await refreshPaused()
    setSessionMsg(`Kept ${expiringSoon.length} paused patient(s) for another 15 days.`)
  }

  useEffect(() => {
    // Never auto-save on pay/hmo/done, or while finishing a path
    if (
      !sessionId ||
      finishingRef.current ||
      screen === 'pay' ||
      screen === 'hmo-guide' ||
      screen === 'done'
    ) {
      return
    }
    const t = window.setTimeout(() => {
      if (finishingRef.current) return
      void upsertBenefitsSession(sessionId, patientName || 'Patient', getSnapshot(), siteCode).then(
        (res) => {
          // Silent local fallback on auto-save (no modal spam)
          if (!(res as { localOnly?: boolean }).localOnly) {
            setOfflineBanner(null)
          }
        },
      )
    }, 400)
    return () => window.clearTimeout(t)
  }, [sessionId, patientName, getSnapshot, siteCode, screen])

  const startCash = () => {
    setPayType('cash')
    setPath(['Start', 'Cash'])
    setNavStack([])
    setDirectAdmission(false)
    setScreen('entry-options')
    setSessionMsg(null)
  }

  const startHmo = () => {
    setPayType('hmo')
    setPath(['Start', 'HMO'])
    setNavStack([])
    setDirectAdmission(false)
    setScreen('entry-options')
    setSessionMsg(null)
  }

  const startDirect = () => {
    if (!payType) return
    setDirectAdmission(true)
    setPath(['Start', payType === 'cash' ? 'Cash' : 'HMO', 'Direct Admission'])
    setNavStack([])
    setScreen('name')
    setSessionMsg(null)
  }

  const submitName = (e: FormEvent) => {
    e.preventDefault()
    const label = nameInput.trim()
    if (!label) {
      setSessionMsg('Please enter the patient full name.')
      return
    }
    // Warn (never block) when the same patient was already started today.
    void (async () => {
      let hits: Awaited<ReturnType<typeof findSameDayRecords>> = []
      try {
        hits = await findSameDayRecords(siteCode, label, paused)
      } catch {
        /* the check must never stop staff from working */
      }
      if (!hits.length) {
        proceedName(label)
        return
      }
      const t = (iso: string) =>
        new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
      const lines = hits.slice(0, 4).map((h) =>
        h.kind === 'completed'
          ? `• Finished ${h.programName} at ${t(h.at)}${h.by ? ` (by ${h.by.split('@')[0]})` : ''}`
          : `• Paused — ${h.programName} (last saved ${t(h.at)})`,
      )
      const hasPaused = hits.some((h) => h.kind === 'paused')
      setConfirmModal({
        title: 'Same patient already today',
        message:
          `"${label}" already has a record today:\n${lines.join('\n')}\n\n` +
          (hasPaused
            ? 'A paused case exists — you can Resume it from the list instead. Start a new one anyway?'
            : 'Start another one anyway?'),
        confirmLabel: 'Start anyway',
        onConfirm: () => proceedName(label),
      })
    })()
  }

  const proceedName = (label: string) => {
    const id = newBenefitsSessionId()
    const now = new Date().toISOString()
    setSessionId(id)
    setPatientName(label)
    setStartedAt(now)
    setNavStack([])
    setSessionMsg(null)

    // Direct Admission → name then straight into Direct Admission steps
    if (directAdmission) {
      const directProg = PROGRAMS.find((x) => x.id === 'direct-admission')
      const pathArr = ['Start', payType === 'cash' ? 'Cash' : 'HMO', 'Direct Admission', label]
      setPath(pathArr)
      setProgramId('direct-admission')
      setStepIndex(0)
      setScreen('steps')
      void upsertBenefitsSession(
        id,
        label,
        {
          payType,
          patientName: label,
          programId: 'direct-admission',
          programName: directProg?.name || 'Direct Admission',
          stepIndex: 0,
          path: pathArr,
          startedAt: now,
        },
        siteCode,
      ).then(() => refreshPaused())
      return
    }

    // Cash → programs list
    const pathArr = ['Start', 'Cash', label]
    setPath(pathArr)
    setProgramId(null)
    setScreen('programs')
    void upsertBenefitsSession(
      id,
      label,
      {
        payType: 'cash',
        patientName: label,
        programId: null,
        programName: null,
        stepIndex: 0,
        path: pathArr,
        startedAt: now,
      },
      siteCode,
    ).then(() => refreshPaused())
  }

  const captureNavFrame = (): NavFrame | null => {
    if (!programId || screen !== 'steps') return null
    return {
      programId,
      stepIndex,
      path: [...path],
      oecbView,
      oecbTab,
      igrEntry,
      igrSelfConduction,
      cancerScreenType,
      cancerHowToIndex,
      showGamotList,
    }
  }

  const restoreNavFrame = (frame: NavFrame) => {
    setProgramId(frame.programId)
    setStepIndex(frame.stepIndex)
    setPath(frame.path)
    setOecbView(frame.oecbView)
    setOecbTab(frame.oecbTab)
    setIgrEntry(frame.igrEntry)
    setIgrSelfConduction(frame.igrSelfConduction)
    setCancerScreenType(frame.cancerScreenType)
    setCancerHowToIndex(frame.cancerHowToIndex)
    setShowGamotList(frame.showGamotList)
    setScreen('steps')
  }

  /** fromList = true when picking from programs grid (clears branch stack) */
  const openProgram = (p: ProgramDef, opts?: { fromList?: boolean }) => {
    setRecentIds(rememberProgram(siteCode, p.id))
    if (opts?.fromList) {
      setNavStack([])
    } else if (screen === 'steps' && programId) {
      const frame = captureNavFrame()
      if (frame) setNavStack((prev) => [...prev, frame])
    }

    setIgrEntry(null)
    setIgrSelfConduction(null)
    setShowGamotList(null)
    // Keep cancer type only if branching within cancer; otherwise clear when switching programs
    if (p.id !== 'yakap-cancer') {
      setCancerScreenType(null)
      setCancerHowToIndex(null)
    } else if (opts?.fromList) {
      setCancerScreenType(null)
      setCancerHowToIndex(null)
    }

    setProgramId(p.id)
    setStepIndex(0)
    setPath((prev) => [...prev.filter((x) => x !== p.name), p.name])
    if (p.id === 'oecb') {
      setOecbView('overview')
      setOecbTab('overview')
    }
    setScreen('steps')
  }

  /** Unified Back for step screens — restores previous program when stack has frames */
  const performBackSteps = () => {
    // --- Inter Global internal ---
    if (programId === 'inter-global-referral') {
      if (stepIndex > 0) {
        const prevTitle = activeProgramSteps[stepIndex - 1]?.title || ''
        // Back onto Self-Conduction question → clear YES/NO so choices show again
        if (prevTitle.startsWith('OPD/Walk-In')) {
          setIgrSelfConduction(null)
          setStepIndex(stepIndex - 1)
          return
        }
        const next = stepIndex - 1
        setStepIndex(next)
        if (next === 0) {
          setIgrEntry(null)
          setIgrSelfConduction(null)
        }
        return
      }
      // step 0 of Inter Global → previous program (e.g. Mammogram) or programs list
      if (navStack.length > 0) {
        const frame = navStack[navStack.length - 1]
        setNavStack((prev) => prev.slice(0, -1))
        restoreNavFrame(frame)
        return
      }
      setScreen('programs')
      return
    }

    // --- Generic ---
    if (stepIndex > 0) {
      // Returning to cancer type picker from pathway steps
      if (programId === 'yakap-cancer' && stepIndex === 2) {
        setStepIndex(1)
        setCancerScreenType(null)
        setCancerHowToIndex(null)
        return
      }
      setStepIndex((i) => i - 1)
      return
    }

    // step 0 of any program → previous branch or programs list
    if (navStack.length > 0) {
      const frame = navStack[navStack.length - 1]
      setNavStack((prev) => prev.slice(0, -1))
      restoreNavFrame(frame)
      return
    }
    if (programId === 'direct-admission') {
      setProgramId(null)
      setStepIndex(0)
      setScreen('entry-options')
      return
    }
    setScreen('programs')
  }

  /** Back inside a program is instant; leaving the program asks first so the place is not lost by accident. */
  const goBackSteps = () => {
    if (stepIndex > 0) {
      performBackSteps()
      return
    }
    const dest =
      navStack.length > 0
        ? 'the previous program'
        : programId === 'direct-admission'
          ? 'the pathway options'
          : 'the program list'
    setConfirmModal({
      title: 'Leave this program?',
      message: `Going back leaves "${program?.name ?? 'this program'}" and returns to ${dest}.

Your place in this program will not be remembered. ${
        patientName ? `"${patientName}" stays active and nothing is deleted.` : ''
      }`,
      confirmLabel: 'Yes, go back',
      onConfirm: () => performBackSteps(),
    })
  }

  const nextStep = async () => {
    if (!program) return
    // OECB uses dedicated screens; Finish is only from Benefit Coordination
    if (program.id === 'oecb' && oecbView !== 'coordination') {
      if (oecbView === 'overview') {
        setOecbView('tables')
        setStepIndex(1)
        return
      }
      setOecbView('coordination')
      setStepIndex(2)
      return
    }
    if (program.id !== 'oecb' && stepIndex < activeProgramSteps.length - 1) {
      setStepIndex((i) => i + 1)
      return
    }
    // Centered confirm before marking Done
    setConfirmModal({
      title: 'Finish path?',
      message: `Finish this path for "${patientName || 'Patient'}"?

Program: ${program.name}
This will mark the case as Done.`,
      confirmLabel: 'Finish',
      onConfirm: () => {
        void (async () => {
          if (finishingRef.current) return
          finishingRef.current = true
          try {
            const idToClear = sessionId
            const fullPath = formatBenefitsDisplayPath([...path, 'END'])
            setSessionId(null)
            setScreen('done')
            const sync = await saveBenefitsCompletion({
              patient_name: patientName || 'Patient',
              program_id: program.id,
              program_name: program.name,
              path: fullPath,
              site_code: siteCode,
              started_at: startedAt || undefined,
            })
            if (sync.row) setLastCompleted(sync.row)
            logBenefitsEvent({
              site_code: siteCode,
              session_id: idToClear,
              event: 'finish',
              patient_name: patientName || 'Patient',
              program_id: program.id,
              program_name: program.name,
              step_index: stepIndex,
            })
            if (sync.localOnly) {
              const msg =
                sync.message || 'Saved on this device only — will sync when online'
              setInfoModal(msg)
              setSessionMsg(msg)
            }
            if (idToClear) await deleteBenefitsSession(idToClear)
            await refreshPaused()
          } finally {
            window.setTimeout(() => {
              finishingRef.current = false
            }, 800)
          }
        })()
      },
    })
  }

  const pauseAndSave = async () => {
    if (!sessionId) {
      setSessionMsg('Start a Cash patient first.')
      return
    }
    const label = patientName || 'Patient'
    const saved = await upsertBenefitsSession(sessionId, label, getSnapshot(), siteCode)
    logBenefitsEvent({
      site_code: siteCode,
      session_id: sessionId,
      event: 'pause',
      patient_name: label,
      program_id: programId,
      program_name: program?.name ?? null,
      step_index: programId ? stepIndex : null,
    })
    if ((saved as { localOnly?: boolean }).localOnly) {
      setInfoModal('Saved on this device only — will sync when online')
    }
    await refreshPaused()
    setSessionId(null)
    setPatientName('')
    setNameInput('')
    setProgramId(null)
    setStepIndex(0)
    setPayType(null)
    setDirectAdmission(false)
    setPath(['Start'])
    setStartedAt(null)
    setNavStack([])
    setCancerScreenType(null)
    setCancerHowToIndex(null)
    setIgrEntry(null)
    setIgrSelfConduction(null)
    setShowGamotList(null)
    setScreen('pay')
    setSessionMsg(`Paused and saved "${label}". You can resume anytime.`)
  }

  const resumeSession = (s: BenefitsSession) => {
    const snap = s.snapshot
    setSessionId(s.id)
    setPatientName(s.patientName)
    setNameInput(s.patientName)
    setPayType(snap.payType)
    setDirectAdmission(snap.programId === 'direct-admission')
    setProgramId(snap.programId)
    setStepIndex(snap.stepIndex || 0)
    setPath(snap.path?.length ? snap.path : ['Start', 'Cash', s.patientName])
    setStartedAt(snap.startedAt || s.createdAt)
    setNavStack([])
    setCancerScreenType(null)
    setCancerHowToIndex(null)
    setIgrEntry(null)
    setIgrSelfConduction(null)
    setShowGamotList(null)
    if (snap.programId) setScreen('steps')
    else setScreen('programs')
    setSessionMsg(null)
  }

  /** Opens the "why is this patient being cancelled?" form. */
  const removePaused = (id: string, label: string) => {
    setCancelModal({ id, label, reason: '', note: '' })
  }

  const confirmCancel = () => {
    if (!cancelModal) return
    const { id, reason, note } = cancelModal
    if (!reason) return
    if (reason === 'Other' && !note.trim()) return
    setCancelModal(null)
    void (async () => {
      const row = paused.find((p) => p.id === id)
      logBenefitsEvent({
        site_code: siteCode,
        session_id: id,
        event: 'abandon',
        patient_name: row?.patientName ?? cancelModal.label,
        reason,
        note: note.trim() || null,
        program_id: row?.snapshot.programId ?? null,
        program_name: row?.snapshot.programName ?? null,
        step_index: row?.snapshot.programId ? (row.snapshot.stepIndex ?? 0) : null,
      })
      await deleteBenefitsSession(id)
      if (sessionId === id) {
        setSessionId(null)
        setScreen('pay')
      }
      await refreshPaused()
    })()
  }

  /** Correct the name on a just-finished record (30-minute window). */
  const openRename = (c: BenefitsCompletion) => {
    if (!canEditCompletion(c)) {
      setInfoModal('The 30-minute edit window for this record has passed.')
      return
    }
    setRenameModal({ target: c, value: c.patient_name })
  }

  const submitRename = async () => {
    if (!renameModal) return
    const name = renameModal.value.trim()
    const target = renameModal.target
    if (!name) return
    if (!canEditCompletion(target)) {
      setRenameModal(null)
      setInfoModal('The 30-minute edit window for this record has passed.')
      return
    }
    setRenameModal(null)
    const res = await renameBenefitsCompletion(target, name)
    if (!res.ok) {
      setInfoModal(res.message || 'Could not rename this record.')
      return
    }
    if (res.row) {
      const updated = res.row
      setLastCompleted((prev) => (prev && prev.id === target.id ? updated : prev))
    }
    setSessionMsg(
      res.localOnly
        ? res.message || 'Name changed on this device — will sync when online.'
        : `Patient name changed to "${name}".`,
    )
    await refreshRecentDone()
  }

  /** Puts a just-finished record back to its last step so it can be corrected. */
  const reopenCompletion = (c: BenefitsCompletion) => {
    if (!canEditCompletion(c)) {
      setInfoModal('The 30-minute edit window for this record has passed.')
      return
    }
    const prog = PROGRAMS.find((x) => x.id === c.program_id)
    if (!prog) {
      setInfoModal('This program is no longer available, so the record cannot be reopened.')
      return
    }
    setConfirmModal({
      title: 'Reopen this record?',
      message: `Reopen "${c.patient_name}" — ${c.program_name}?

The finished record is removed and the patient goes back to the last step. Finish it again to record it.`,
      confirmLabel: 'Reopen',
      onConfirm: () => {
        void (async () => {
          const del = await deleteBenefitsCompletion(c)
          if (!del.ok) {
            setInfoModal('Could not reopen this record. Please try again.')
            return
          }
          const id = newBenefitsSessionId()
          const pay: PayType = c.path.includes('HMO') ? 'hmo' : 'cash'
          let pathArr = c.path
            .split('→')
            .map((x) => x.trim())
            .filter((x) => x && x.toUpperCase() !== 'END')
          if (!pathArr.length) {
            pathArr = ['Start', pay === 'hmo' ? 'HMO' : 'Cash', c.patient_name, prog.name]
          }
          // Flows driven by on-screen choices (Inter Global, YAKAP cancer) restart at step 1.
          const lastIdx =
            prog.id === 'oecb'
              ? 2
              : prog.id === 'inter-global-referral' || prog.id === 'yakap-cancer'
                ? 0
                : Math.max(prog.steps.length - 1, 0)

          finishingRef.current = false
          setLastCompleted(null)
          setSessionId(id)
          setPatientName(c.patient_name)
          setNameInput(c.patient_name)
          setPayType(pay)
          setDirectAdmission(prog.id === 'direct-admission')
          setProgramId(prog.id)
          setStepIndex(lastIdx)
          setPath(pathArr)
          setStartedAt(c.started_at)
          setNavStack([])
          setCancerScreenType(null)
          setCancerHowToIndex(null)
          setIgrEntry(null)
          setIgrSelfConduction(null)
          setShowGamotList(null)
          setOecbView(prog.id === 'oecb' ? 'coordination' : 'overview')
          setOecbTab('overview')
          setScreen('steps')
          setSessionMsg(`Reopened "${c.patient_name}" — finish again to record the corrected case.`)

          await upsertBenefitsSession(
            id,
            c.patient_name,
            {
              payType: pay,
              patientName: c.patient_name,
              programId: prog.id,
              programName: prog.name,
              stepIndex: lastIdx,
              path: pathArr,
              startedAt: c.started_at,
            },
            siteCode,
          )
          logBenefitsEvent({
            site_code: siteCode,
            session_id: id,
            event: 'reopen',
            patient_name: c.patient_name,
            program_id: prog.id,
            program_name: prog.name,
            step_index: lastIdx,
          })
          await refreshPaused()
        })()
      },
    })
  }

  const newPatient = () => {
    setLastCompleted(null)
    setProgramSearch('')
    setSessionId(null)
    setPatientName('')
    setNameInput('')
    setProgramId(null)
    setStepIndex(0)
    setPayType(null)
    setDirectAdmission(false)
    setPath(['Start'])
    setStartedAt(null)
    setNavStack([])
    setCancerScreenType(null)
    setCancerHowToIndex(null)
    setIgrEntry(null)
    setIgrSelfConduction(null)
    setShowGamotList(null)
    setScreen('pay')
    setSessionMsg(null)
  }

  return (
    <div className="app ben-app">

      {confirmModal && (
        <div className="ben-modal-overlay" role="presentation" onClick={() => setConfirmModal(null)}>
          <div
            className="ben-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ben-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ben-confirm-title">{confirmModal.title}</h3>
            <p className="ben-modal-message" style={{ whiteSpace: 'pre-line' }}>{confirmModal.message}</p>
            <div className="ben-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmModal(null)}>
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className={confirmModal.danger ? 'btn btn-outline ben-modal-danger' : 'btn btn-green'}
                onClick={() => {
                  const fn = confirmModal.onConfirm
                  setConfirmModal(null)
                  void fn()
                }}
              >
                <span>{confirmModal.confirmLabel || 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {infoModal && (
        <div className="ben-modal-overlay" role="presentation" onClick={() => setInfoModal(null)}>
          <div
            className="ben-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="ben-modal-message">{infoModal}</p>
            <div className="ben-modal-actions ben-modal-actions-center">
              <button type="button" className="btn btn-green" onClick={() => setInfoModal(null)}>
                <span>OK</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {cancelModal && (
        <div className="ben-modal-overlay" role="presentation" onClick={() => setCancelModal(null)}>
          <form
            className="ben-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ben-cancel-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              confirmCancel()
            }}
          >
            <h3 id="ben-cancel-title">Cancel this patient?</h3>
            <p className="ben-modal-message">
              Remove paused patient <b>{cancelModal.label}</b>. This cannot be undone. Why is this case being cancelled?
            </p>
            <select
              className="ben-rename-input ben-cancel-field"
              value={cancelModal.reason}
              required
              autoFocus
              aria-label="Reason for cancelling"
              onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
            >
              <option value="">Choose a reason…</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="ben-rename-input ben-cancel-field"
              value={cancelModal.note}
              maxLength={160}
              required={cancelModal.reason === 'Other'}
              placeholder={cancelModal.reason === 'Other' ? 'Please explain (required)' : 'Note (optional)'}
              aria-label="Note"
              onChange={(e) => setCancelModal({ ...cancelModal, note: e.target.value })}
            />
            <div className="ben-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setCancelModal(null)}>
                <span>Keep patient</span>
              </button>
              <button
                type="submit"
                className="btn btn-outline ben-modal-danger"
                disabled={!cancelModal.reason || (cancelModal.reason === 'Other' && !cancelModal.note.trim())}
              >
                <span>Cancel patient</span>
              </button>
            </div>
          </form>
        </div>
      )}
      {renameModal && (
        <div className="ben-modal-overlay" role="presentation" onClick={() => setRenameModal(null)}>
          <form
            className="ben-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ben-rename-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              void submitRename()
            }}
          >
            <h3 id="ben-rename-title">Edit patient name</h3>
            <input
              type="text"
              className="ben-rename-input"
              value={renameModal.value}
              maxLength={80}
              autoFocus
              required
              onChange={(e) => setRenameModal({ ...renameModal, value: e.target.value })}
              aria-label="Patient full name"
            />
            <div className="ben-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setRenameModal(null)}>
                <span>Cancel</span>
              </button>
              <button type="submit" className="btn btn-green">
                <span>Save name</span>
              </button>
            </div>
          </form>
        </div>
      )}
      <header className="app-header">
        <div className="header-top">
          <div className="brand">
            <img
              src={`${import.meta.env.BASE_URL}global-care-logo.svg`}
              alt="Global Care"
            />
            <div className="brand-text">
              <strong>GLOBAL CARE</strong>
              <span>{locationLabel}</span>
            </div>
          </div>
          <div className="header-staff-actions">
            <SyncBadge />
            <div className="staff-profile">
              <button
                type="button"
                className="staff-profile-trigger"
                onClick={() => setStaffMenuOpen((v) => !v)}
                aria-expanded={staffMenuOpen}
                aria-haspopup="menu"
              >
                <span className="staff-avatar">B</span>
                <span className="staff-profile-label">
                  {staffEmail ? staffEmail.split('@')[0] : 'Staff'}
                </span>
                <span className="staff-profile-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {staffMenuOpen && (
                <>
                  <div
                    className="staff-profile-backdrop"
                    onClick={() => setStaffMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="staff-profile-dropdown" role="menu">
                    <div className="staff-profile-head">
                      <strong>{staffEmail || 'Staff'}</strong>
                      <em>Benefits Programs</em>
                    </div>
                    {onLogout && (
                      <button
                        type="button"
                        className="staff-profile-item staff-profile-logout"
                        role="menuitem"
                        onClick={() => {
                          setStaffMenuOpen(false)
                          onLogout()
                        }}
                      >
                        Log out
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        <header className="page-title-block">
          <h1>GCare PhilHealth Benefits Utilization Program</h1>
          <p className="tagline">{siteName} · PhilHealth Ecosystem</p>
        </header>

        {sessionId && (
          <div className="session-active-bar">
            <div className="session-active-info">
              <span className="session-active-label">Active patient</span>
              <strong className="session-active-name">{patientName || 'Patient'}</strong>
            </div>
            <div className="session-active-actions">
              <button type="button" className="btn session-park-btn" onClick={() => void pauseAndSave()}>
                Pause &amp; save
              </button>
            </div>
          </div>
        )}

        {sessionMsg && (
          <div className="session-toast" role="status">
            <span>{sessionMsg}</span>
            <button type="button" className="session-toast-close" onClick={() => setSessionMsg(null)}>
              ×
            </button>
          </div>
        )}

        {screen === 'pay' && (
          <>
            <div className="section-title">Entry type</div>
            <p className="hint" style={{ marginBottom: 14 }}>
              Select Cash or HMO first, then choose the appropriate admission pathway.
            </p>
            <div className="card-grid">
              <button type="button" className="choice-card green-card" onClick={startCash}>
                <div className="icon">💵</div>
                <h3>Cash</h3>
                <p>PhilHealth benefits path</p>
                <ul>
                  <li>Choose benefit programs or Direct Admission</li>
                  <li>Enter patient full name</li>
                  <li>Follow program steps to end</li>
                </ul>
              </button>
              <button type="button" className="choice-card" onClick={startHmo}>
                <div className="icon">🏥</div>
                <h3>HMO</h3>
                <p>HMO guidance or direct admission</p>
                <ul>
                  <li>Staff guidance only</li>
                  <li>Endorse to HMO / LOA desk</li>
                  <li>Choose standard HMO or Direct Admission</li>
                </ul>
              </button>
            </div>

            {recentDone.filter(canEditCompletion).length > 0 && (
              <div className="ben-recent-done" style={{ marginTop: 28 }}>
                <h3 className="session-hub-heading">
                  Recently completed
                  <span className="ben-recent-note">
                    last {COMPLETION_EDIT_WINDOW_MS / 60000} min · fix a mistake
                  </span>
                </h3>
                <ul className="ben-recent-list">
                  {recentDone.filter(canEditCompletion).map((c) => (
                    <li key={c.id} className="ben-recent-item">
                      <div className="ben-recent-info">
                        <strong>{c.patient_name}</strong>
                        <span>
                          {c.program_name} ·{' '}
                          {new Date(c.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="ben-recent-actions">
                        <button type="button" className="staff-patient-edit" onClick={() => openRename(c)}>
                          Edit name
                        </button>
                        <button
                          type="button"
                          className="staff-patient-keep"
                          onClick={() => reopenCompletion(c)}
                        >
                          Reopen
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="session-parked-block session-parked-flat" style={{ marginTop: 28 }}>
              <h3 className="session-hub-heading">
                Paused patients
                {paused.length > 0 && (
                  <span className="session-count-badge">
                    {filteredPaused.length === paused.length
                      ? paused.length
                      : `${filteredPaused.length}/${paused.length}`}
                  </span>
                )}
              </h3>

              {expiringSoon.length > 0 && (
                <div className="ben-expiry-banner" role="alert">
                  <div>
                    <strong>
                      {expiringSoon.length} paused patient{expiringSoon.length === 1 ? '' : 's'} will be
                      removed within 2 days.
                    </strong>
                    <span>Continue them, or keep them for another 15 days.</span>
                  </div>
                  <button type="button" className="btn btn-outline" onClick={() => void keepAllExpiring()}>
                    <span>Keep all</span>
                  </button>
                </div>
              )}

              {paused.length > 0 && (
                <div className="paused-filters">
                  <input
                    type="search"
                    className="paused-search-input"
                    placeholder="Search patient name…"
                    value={pausedSearch}
                    onChange={(e) => setPausedSearch(e.target.value)}
                    aria-label="Search paused patients by name"
                  />
                  <label className="paused-date-label paused-program-label">
                    <span>Benefit</span>
                    <select
                      className="paused-program-select"
                      value={pausedProgram}
                      onChange={(e) => setPausedProgram(e.target.value)}
                      aria-label="Filter paused patients by benefit"
                    >
                      <option value="">All benefits ({paused.length})</option>
                      {pausedProgramOptions.list.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.n})
                        </option>
                      ))}
                      {pausedProgramOptions.none > 0 && (
                        <option value="__none">No benefit chosen yet ({pausedProgramOptions.none})</option>
                      )}
                    </select>
                  </label>
                  <div className="paused-date-filters">
                    <label className="paused-date-label">
                      <span>From</span>
                      <input
                        type="date"
                        value={pausedDateFrom}
                        onChange={(e) => setPausedDateFrom(e.target.value)}
                        aria-label="Paused from date"
                      />
                    </label>
                    <label className="paused-date-label">
                      <span>To</span>
                      <input
                        type="date"
                        value={pausedDateTo}
                        onChange={(e) => setPausedDateTo(e.target.value)}
                        aria-label="Paused to date"
                      />
                    </label>
                    {(pausedSearch || pausedProgram || pausedDateFrom || pausedDateTo) && (
                      <button
                        type="button"
                        className="btn btn-outline paused-clear-filters"
                        onClick={() => {
                          setPausedSearch('')
                          setPausedProgram('')
                          setPausedDateFrom('')
                          setPausedDateTo('')
                        }}
                      >
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {paused.length === 0 ? (
                <p className="session-empty">
                  No paused patients. Progress is kept when you Pause &amp; save.
                </p>
              ) : filteredPaused.length === 0 ? (
                <p className="session-empty">No paused patients match your search, benefit or date filter.</p>
              ) : (
                <div className="staff-patient-table-wrap">
                  <table className="staff-patient-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th className="staff-patient-actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPaused.map((row) => (
                        <tr
                          key={row.id}
                          className="staff-patient-row"
                          onClick={() => resumeSession(row)}
                          title={`Resume ${row.patientName}`}
                        >
                          <td className="staff-patient-name-cell">
                            <span className="staff-patient-name">{row.patientName}</span>
                            <span className="staff-patient-meta">{pausedStepLabel(row)}</span>
                            <span className="staff-patient-resume-hint">
                              Continue where left off
                              {row.updatedAt
                                ? ` · ${new Date(row.updatedAt).toLocaleDateString()}`
                                : ''}
                            </span>
                            {isSessionExpiringSoon(row) && (
                              <span className="staff-patient-expiry">
                                ⚠ Removed in {formatTimeLeft(sessionTimeLeftMs(row))} unless kept
                              </span>
                            )}
                          </td>
                          <td className="staff-patient-actions-cell">
                            <button
                              type="button"
                              className="staff-patient-edit"
                              onClick={(e) => {
                                e.stopPropagation()
                                resumeSession(row)
                              }}
                            >
                              Continue
                            </button>
                            {isSessionExpiringSoon(row) && (
                              <button
                                type="button"
                                className="staff-patient-keep"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void keepSession(row)
                                }}
                              >
                                Keep 15 more days
                              </button>
                            )}
                            <button
                              type="button"
                              className="staff-patient-delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                void removePaused(row.id, row.patientName)
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {screen === 'entry-options' && (
          <>
            <div className="section-title">{payType === 'cash' ? 'Cash' : 'HMO'} — choose pathway</div>
            <p className="hint" style={{ marginBottom: 14 }}>
              Select the appropriate pathway for this {payType === 'cash' ? 'Cash' : 'HMO'} patient.
            </p>
            <div className="card-grid">
              <button
                type="button"
                className="choice-card green-card"
                onClick={() => {
                  setDirectAdmission(false)
                  if (payType === 'hmo') setScreen('hmo-guide')
                  else setScreen('name')
                }}
              >
                <div className="icon">{payType === 'cash' ? '💵' : '🏥'}</div>
                <h3>{payType === 'cash' ? 'Benefit Programs' : 'Standard HMO'}</h3>
                <p>{payType === 'cash' ? 'Enter patient details and select a program' : 'HMO / LOA desk guidance'}</p>
              </button>
              <button type="button" className="choice-card" onClick={startDirect}>
                <div className="icon">📋</div>
                <h3>Direct Admission</h3>
                <p>Planned inpatient pathway under {payType === 'cash' ? 'Cash' : 'HMO'}</p>
                <ul>
                  <li>Enter patient full name</li>
                  <li>Follow elective admission steps</li>
                  <li>Billing · Clearance · Discharge</li>
                </ul>
              </button>
            </div>
            <div className="action-row" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={newPatient}>Back to payment method</button>
            </div>
          </>
        )}

        {screen === 'hmo-guide' && (
          <>
            <div className="section-title">HMO — staff guidance only</div>
            <div className="info-card" style={{ marginBottom: 16 }}>
              <p>
                This patient has an <strong>HMO</strong>. Do <strong>not</strong> encode them under
                the PhilHealth Benefits Programs path in this system.
              </p>
              <ul>
                <li>Endorse to the HMO / LOA desk or your branch partner process.</li>
                <li>Explain coverage and co-pay using your hospital HMO SOP (outside this app).</li>
                <li>Do not enter a patient name or open a benefit program card for HMO here.</li>
              </ul>
            </div>
            <div className="action-row">
              <button type="button" className="btn btn-primary" onClick={() => setScreen('entry-options')}>
                <span>Back to HMO options</span>
              </button>
            </div>
          </>
        )}

        {screen === 'name' && (
          <div className="screen">
            <div className="section-title">Patient full name</div>
            <p className="hint">
              {directAdmission
                ? `${payType === 'cash' ? 'Cash' : 'HMO'} Direct Admission — enter the patient full name to continue.`
                : 'Cash path — enter the patient full name to continue.'}
            </p>
            <form className="ben-name-simple" onSubmit={submitName}>
              <label htmlFor="ben-name">Full name</label>
              <input
                id="ben-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                maxLength={80}
                autoComplete="off"
                autoFocus
                required
              />
              <div className="ben-name-simple-actions">
                <button type="button" className="btn btn-outline" onClick={() => setScreen('entry-options')}>
                  <span>Back</span>
                </button>
                <button type="submit" className="btn btn-green">
                  <span>{directAdmission ? 'Continue to Direct Admission' : 'Continue to programs'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {screen === 'programs' && (() => {
          const q = programSearch.trim().toLowerCase()
          const selectable = PROGRAMS.filter((p) => p.id !== 'direct-admission')
          const matches = q
            ? selectable.filter((p) =>
                [p.name, p.short, ...(p.includes ?? []), ...p.steps.map((st) => st.title)]
                  .join(' ')
                  .toLowerCase()
                  .includes(q),
              )
            : selectable
          const recent = recentIds
            .map((id) => selectable.find((p) => p.id === id))
            .filter((p): p is ProgramDef => Boolean(p))
          return (
            <>
              <div className="section-title">PhilHealth benefit programs</div>
              <p className="hint">
                Patient: <strong>{patientName}</strong> · Cash — select a program (placeholder steps until official list is provided).
              </p>

              <div className="ben-program-search">
                <input
                  type="search"
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                  placeholder="Search programs (e.g. dialysis, cancer, referral)…"
                  aria-label="Search programs"
                  autoFocus
                />
                {programSearch && (
                  <button type="button" className="btn btn-outline" onClick={() => setProgramSearch('')}>
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {!q && recent.length > 0 && (
                <div className="ben-recent-programs">
                  <span className="ben-recent-programs-label">Recently used</span>
                  <div className="ben-recent-chips">
                    {recent.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="ben-recent-chip"
                        onClick={() => openProgram(p, { fromList: true })}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {q && (
                <p className="hint ben-search-count" role="status">
                  {matches.length} of {selectable.length} programs match “{programSearch.trim()}”
                </p>
              )}

              {matches.length === 0 ? (
                <div className="info-card">
                  <p>No program matches your search. Try a different word, or clear the search.</p>
                </div>
              ) : (
                <div className="card-grid">
                  {matches.map((p) => (
                    <div key={p.id} className="choice-card ben-program-card">
                      <button
                        type="button"
                        className="ben-program-card-main"
                        onClick={() => openProgram(p, { fromList: true })}
                      >
                        <div className="icon">📋</div>
                        <h3>{p.name}</h3>
                        <p>{p.short}</p>
                        {p.includes && p.includes.length > 0 && (
                          <div className="ben-program-includes">
                            <span className="ben-program-includes-label">Includes / notes</span>
                            <ul>
                              {p.includes.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="action-row" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-primary" onClick={newPatient}>
                  <span>Cancel / new patient</span>
                </button>
              </div>
            </>
          )
        })()}

        {screen === 'steps' && program && program.id === 'oecb' && (
          <>
            <StepProgress
              current={oecbView === 'overview' ? 1 : oecbView === 'tables' ? 2 : 3}
              total={3}
              label={
                oecbView === 'overview'
                  ? 'Overview'
                  : oecbView === 'tables'
                    ? 'Coverage tables'
                    : 'Benefit coordination'
              }
            />
            {oecbView === 'overview' && (
              <div className="screen">
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
                      <h4>Medicines &amp; Supplies</h4>
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
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={goBackSteps}
                  >
                    <span>← Back</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setOecbTab('exclusions')
                      setOecbView('tables')
                      setStepIndex(1)
                    }}
                  >
                    <span>View OECB Exclusions →</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setOecbTab('overview')
                      setOecbView('tables')
                      setStepIndex(1)
                    }}
                  >
                    <span>View OECB Tables →</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setOecbView('coordination')
                      setStepIndex(2)
                    }}
                  >
                    <span>Continue to Benefit Coordination →</span>
                  </button>
                </div>
              </div>
            )}

            {oecbView === 'tables' && (
              <div className="screen">
                <div className="result-header teal">
                  <h2>OECB – Clinical Reference Tables</h2>
                  <p>Outpatient Emergency Care Benefit · Core presentations, covered services &amp; pathways</p>
                  <div className="badge">OECB Reference</div>
                </div>
                <div className="tab-row">
                  {(
                    [
                      ['overview', 'Overview'],
                      ['groups', 'Clinical Groups'],
                      ['covered', 'Covered Services'],
                      ['pathways', 'Sample Pathways'],
                      ['exclusions', 'Exclusions'],
                    ] as const
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      className={`tab-btn ${oecbTab === t ? 'active' : ''}`}
                      onClick={() => setOecbTab(t)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {oecbTab === 'overview' && (
                  <div className="section-block">
                    <h4>Emergency Ecosystem – Disposition</h4>
                    <ul className="flow-steps">
                      <li>
                        <span className="step-num">1</span> ER Patient → Triage + Stabilize
                      </li>
                      <li>
                        <span className="step-num">2</span> ER Physician Assessment
                      </li>
                      <li>
                        <span className="step-num">3</span> Urgent / Emergent? → Treat + Investigate
                      </li>
                      <li>
                        <span className="step-num">4</span> Disposition:
                        <ul style={{ marginTop: 6, paddingLeft: 12, fontSize: '0.82rem' }}>
                          <li>
                            • Discharge / Resolved within 24 hours with OECB signs &amp; symptoms →{' '}
                            <strong>OECB</strong>
                          </li>
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
                        The patient remains in the ED beyond 24 hours because a necessary disposition was
                        not completed
                      </li>
                      <li>
                        The primary service is an outpatient or inpatient procedure with an existing case
                        rate
                      </li>
                      <li>
                        Another PhilHealth package, such as the Animal Bite Treatment Package, properly
                        governs the episode
                      </li>
                      <li>
                        The claim seeks payment for prehospital or home services under the facility-based
                        component
                      </li>
                      <li>The claimed item is not on the current EECL</li>
                      <li>
                        Documentation cannot demonstrate that the service was clinically indicated and
                        actually provided
                      </li>
                      <li>
                        OECB and the resuscitation benefit are being filed for the same episode contrary
                        to the no-double-filing rule
                      </li>
                    </ul>
                    <div className="note-box blue" style={{ marginTop: 12 }}>
                      Always verify eligibility, EECL coverage, disposition timing (within 24 hours), and
                      that no other package already governs the episode before filing OECB.
                    </div>
                  </div>
                )}

                {oecbTab === 'groups' && (
                  <div className="section-block">
                    <h4>OECB Core Presentations (grouped for workflow)</h4>
                    <p style={{ fontSize: '0.9rem' }}>
                      The OECB circular identifies 27 core presentations. Enter the nearest core
                      presentation that matches the clinical picture when the patient is discharged /
                      resolved within 24 hours without admission.
                    </p>
                    <div className="note-box blue">
                      Use full OECB tables in the flow guide for the complete clinical groups grid when
                      needed. Confirm against PhilHealth Circular 2024-0027.
                    </div>
                  </div>
                )}

                {oecbTab === 'covered' && (
                  <div className="section-block">
                    <h4>Covered services (examples listed in the OECB EECL when clinically indicated)</h4>
                    <div className="component-list">
                      <div className="component-card">
                        <div className="comp-icon">🚑</div>
                        <div>
                          <h4>ER professional services</h4>
                          <p>Assessment and management in the accredited ER without admission.</p>
                        </div>
                      </div>
                      <div className="component-card">
                        <div className="comp-icon">💊</div>
                        <div>
                          <h4>Medicines &amp; supplies</h4>
                          <p>Items used during the ER stay that appear on the EECL.</p>
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
                  </div>
                )}

                {oecbTab === 'pathways' && (
                  <div className="section-block">
                    <h4>Sample clinical pathways</h4>
                    <p style={{ fontSize: '0.9rem' }}>
                      Low-risk presentations that resolve and are discharged within 24 hours may qualify
                      for OECB. Confirmed AMI, true stroke, sepsis with organ dysfunction, or major trauma
                      generally require admission or transfer and the applicable inpatient package.
                    </p>
                    <div className="note-box" style={{ background: '#fff8e1', borderColor: '#f9a825', color: '#5d4037' }}>
                      <strong>WATCH OUT:</strong> Do not file OECB when another package already governs the
                      episode or when disposition exceeds 24 hours without discharge.
                    </div>
                  </div>
                )}

                <div className="nav-row">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setOecbView('overview')
                      setStepIndex(0)
                    }}
                  >
                    <span>← Back</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setOecbView('coordination')
                      setStepIndex(2)
                    }}
                  >
                    <span>Continue to Benefit Coordination →</span>
                  </button>
                </div>
              </div>
            )}

            {oecbView === 'coordination' && (
              <div className="screen">
                <div className="result-header blue">
                  <h2>Benefit Coordination</h2>
                  <p>OECB · Finalize documentation and claims handoff</p>
                  <div className="badge">PhilHealth desk</div>
                </div>
                <div className="component-list">
                  <div className="component-card">
                    <div className="comp-icon">📋</div>
                    <div>
                      <h4>Verify eligibility &amp; forms</h4>
                      <p>Member data, clinical notes, OECB indication, and EECL alignment.</p>
                    </div>
                  </div>
                  <div className="component-card">
                    <div className="comp-icon">🧾</div>
                    <div>
                      <h4>Encode / submit claim</h4>
                      <p>Coordinate with billing / PhilHealth benefits desk for OECB filing.</p>
                    </div>
                  </div>
                  <div className="component-card">
                    <div className="comp-icon">✅</div>
                    <div>
                      <h4>Advise patient</h4>
                      <p>Explain coverage and any remaining charges, then close the path.</p>
                    </div>
                  </div>
                </div>
                <div className="nav-row">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setOecbView('tables')
                      setStepIndex(1)
                    }}
                  >
                    <span>← Back</span>
                  </button>
                  <button type="button" className="btn btn-green" onClick={() => void nextStep()}>
                    <span>Finish program</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {screen === 'steps' && program && program.id !== 'oecb' && (
          <div className="screen">
            <div className="result-header blue">
              <h2>{program.name}</h2>
              <p>
                Patient: <strong>{patientName}</strong> · Step {stepIndex + 1} of{' '}
                {activeProgramSteps.length}
              </p>
              <div className="badge">{program.short}</div>
            </div>

            {!(program.id === 'yakap-cancer' && cancerHowToIndex !== null) && (
              <StepProgress
                current={stepIndex + 1}
                total={activeProgramSteps.length}
                label={activeProgramSteps[stepIndex]?.title}
              />
            )}

            {!(program.id === 'yakap-cancer' && cancerHowToIndex !== null) && (
            <ul className="flow-steps" style={{ marginBottom: 16 }}>
              {activeProgramSteps.map((st, i) => (
                <li
                  key={`${st.title}-${i}`}
                  style={{
                    opacity: i === stepIndex ? 1 : i < stepIndex ? 0.85 : 0.45,
                    borderColor: i === stepIndex ? 'var(--blue)' : undefined,
                    background: i === stepIndex ? 'var(--blue-light)' : undefined,
                  }}
                >
                  <span
                    className="step-num"
                    style={{
                      background: i <= stepIndex ? 'var(--blue)' : 'var(--border)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <strong>{st.title}</strong>
                    {i === stepIndex && (
                      <div style={{ fontSize: '0.88rem', marginTop: 6, fontWeight: 500 }}>
                        {st.body}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            )}

            {program.id === 'inter-global-referral' && stepIndex === 0 && (
              <div className="card-grid" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="choice-card"
                  onClick={() => {
                    setIgrEntry('inpatient')
                    setIgrSelfConduction(null)
                    setStepIndex(1)
                    setPath((prev) => [...prev, 'In-Patient'])
                  }}
                >
                  <h3>A. In-Patient</h3>
                  <p>Attending Physician / NOD orders diagnostics at other Global hospitals</p>
                </button>
                <button
                  type="button"
                  className="choice-card"
                  onClick={() => {
                    setIgrEntry('er')
                    setIgrSelfConduction(null)
                    setStepIndex(1)
                    setPath((prev) => [...prev, 'E.R. Patient'])
                  }}
                >
                  <h3>B. E.R. Patient</h3>
                  <p>ER pathway — conduction / ambulance coordination</p>
                </button>
                <button
                  type="button"
                  className="choice-card"
                  onClick={() => {
                    setIgrEntry('opd')
                    setIgrSelfConduction(null)
                    setStepIndex(1)
                    setPath((prev) => [...prev, 'OPD / Walk-In'])
                  }}
                >
                  <h3>C. OPD / Walk-In</h3>
                  <p>Self-conduction YES → Path B · NO → ambulance path</p>
                </button>
              </div>
            )}

            {program.id === 'inter-global-referral' &&
              igrEntry === 'opd' &&
              activeProgramSteps[stepIndex]?.title.startsWith('OPD/Walk-In') && (
              <div className="card-grid" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="choice-card green-card"
                  onClick={() => {
                    setIgrSelfConduction('yes')
                    setStepIndex((i) => i + 1)
                    setPath((prev) => [...prev, 'Self-Conduction YES'])
                  }}
                >
                  <h3>YES — Self-Conduction</h3>
                  <p>Proceed to letter B: confirm schedule → relative transport → arrival → END</p>
                </button>
                <button
                  type="button"
                  className="choice-card"
                  onClick={() => {
                    setIgrSelfConduction('no')
                    setStepIndex((i) => i + 1)
                    setPath((prev) => [...prev, 'Self-Conduction NO'])
                  }}
                >
                  <h3>NO — Ambulance / Transport Vehicle</h3>
                  <p>GCMCC Ambulance / Other Global Hospital Ambulance / Patient Transport Vehicle → END</p>
                </button>
              </div>
            )}

            {program.id === 'yakap-cancer' && stepIndex === 1 && cancerHowToIndex === null && (
              <div className="ben-cancer-type-options">
                <div className="card-grid" style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="choice-card"
                    onClick={() => {
                      setCancerScreenType('breast')
                      setPath((prev) => [...prev, 'Breast'])
                      const igr = PROGRAMS.find((x) => x.id === 'inter-global-referral')
                      if (igr) openProgram(igr)
                    }}
                  >
                    <h3>Breast</h3>
                  </button>
                  <button
                    type="button"
                    className={`choice-card${cancerScreenType === 'cervical' ? ' green-card' : ''}`}
                    onClick={() => {
                      setCancerScreenType('cervical')
                      setPath((prev) => [...prev, 'Cervical screening'])
                      setStepIndex(2)
                    }}
                  >
                    <h3>Cervical</h3>
                  </button>
                  <button
                    type="button"
                    className={`choice-card${cancerScreenType === 'colorectal' ? ' green-card' : ''}`}
                    onClick={() => {
                      setCancerScreenType('colorectal')
                      setPath((prev) => [...prev, 'Colorectal screening'])
                      setStepIndex(2)
                    }}
                  >
                    <h3>Colorectal</h3>
                  </button>
                  <button
                    type="button"
                    className={`choice-card${cancerScreenType === 'prostate' ? ' green-card' : ''}`}
                    onClick={() => {
                      setCancerScreenType('prostate')
                      setPath((prev) => [...prev, 'Prostate screening'])
                      setStepIndex(2)
                    }}
                  >
                    <h3>Prostate</h3>
                  </button>
                  {FREE_CANCER_SCREENS.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      className={`choice-card${cancerScreenType === sc.id ? ' green-card' : ''}`}
                      onClick={() => {
                        setCancerScreenType(sc.id)
                        setCancerHowToIndex(0)
                        setPath((prev) => [...prev, sc.name])
                      }}
                    >
                      <h3>{sc.name}</h3>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {program.id === 'yakap-cancer' &&
              stepIndex === 1 &&
              cancerHowToIndex !== null &&
              (() => {
                const sc = FREE_CANCER_SCREENS.find((x) => x.id === cancerScreenType)
                if (!sc) return null
                const total = sc.howToAvail.length
                const cur = sc.howToAvail[cancerHowToIndex] || sc.howToAvail[0]
                return (
                  <div className="ben-cancer-howto">
                    <div className="result-header teal" style={{ marginBottom: 12 }}>
                      <h2>{sc.name}</h2>
                      <p>Free Cancer Screening · How to avail · Step {cancerHowToIndex + 1} of {total}</p>
                      <div className="badge">{sc.short}</div>
                    </div>

                    <div className="ben-program-includes" style={{ marginBottom: 14 }}>
                      <span className="ben-program-includes-label">Who can avail</span>
                      <ul>
                        {sc.whoCanAvail.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="progress-wrap" aria-hidden="true">
                      {sc.howToAvail.map((_, i) => (
                        <div
                          key={i}
                          className={`progress-dot${i === cancerHowToIndex ? ' active' : ''}${i < cancerHowToIndex ? ' done' : ''}`}
                        />
                      ))}
                    </div>

                    <ul className="flow-steps" style={{ marginBottom: 16 }}>
                      {sc.howToAvail.map((st, i) => (
                        <li
                          key={st.title}
                          style={{
                            opacity: i === cancerHowToIndex ? 1 : i < cancerHowToIndex ? 0.85 : 0.45,
                            borderColor: i === cancerHowToIndex ? 'var(--blue)' : undefined,
                            background: i === cancerHowToIndex ? 'var(--blue-light)' : undefined,
                          }}
                        >
                          <span
                            className="step-num"
                            style={{
                              background: i <= cancerHowToIndex ? 'var(--blue)' : 'var(--border)',
                            }}
                          >
                            {i + 1}
                          </span>
                          <div>
                            <strong>{st.title}</strong>
                            {i === cancerHowToIndex && (
                              <div style={{ fontSize: '0.88rem', marginTop: 6, fontWeight: 500 }}>
                                {st.body}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="nav-row">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          if (cancerHowToIndex > 0) {
                            setCancerHowToIndex((i) => (i === null ? 0 : i - 1))
                          } else {
                            setCancerHowToIndex(null)
                            setCancerScreenType(null)
                          }
                        }}
                      >
                        <span>← Back</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-green"
                        onClick={() => {
                          if (cancerHowToIndex < total - 1) {
                            setCancerHowToIndex((i) => (i === null ? 1 : i + 1))
                            return
                          }
                          // Last how-to step
                          if (sc.linkToInterGlobal) {
                            setPath((prev) => [...prev, 'Inter Global Referral'])
                            const igr = PROGRAMS.find((x) => x.id === 'inter-global-referral')
                            if (igr) openProgram(igr)
                            return
                          }
                          setCancerHowToIndex(null)
                          setStepIndex(2)
                        }}
                      >
                        <span>
                          {cancerHowToIndex < total - 1
                            ? 'Next step →'
                            : sc.linkToInterGlobal
                              ? 'Continue to Inter Global Referral →'
                              : 'Continue pathway →'}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })()}

            {program.id === 'yakap-cancer' &&
              stepIndex === program.steps.length - 1 &&
              cancerHowToIndex === null && (
              <div className="ben-yakap-step5-options">
                <p className="ben-yakap-step5-label">
                  Optional — if the case qualifies for a Z package, open Z-Benefit. You may also
                  finish this cancer screening path without opening Z-Benefit.
                </p>
                <div className="ben-yakap-step5-btns">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      const zb = PROGRAMS.find((x) => x.id === 'z-benefit')
                      if (zb) openProgram(zb)
                    }}
                  >
                    <span>Open Z-Benefit →</span>
                  </button>
                </div>
              </div>
            )}

            {program.id === 'yakap-standard' && stepIndex === 4 && (
              <div className="ben-yakap-step5-options">
                <p className="ben-yakap-step5-label">
                  Optional (not required) — show the Gamot medicine lists, open Cancer Screening, or
                  continue to step 6 (Follow-up / Referral).
                </p>
                <div className="ben-yakap-step5-btns">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowGamotList('picker')}
                  >
                    <span>Show Gamot List</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      const ca = PROGRAMS.find((x) => x.id === 'yakap-cancer')
                      if (ca) openProgram(ca)
                    }}
                  >
                    <span>Open Cancer screening →</span>
                  </button>
                </div>

                {showGamotList && (
                  <div className="ben-gamot-list-panel">
                    <div className="ben-gamot-list-head">
                      <strong>YAKAP Gamot Lists</strong>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setShowGamotList(null)}
                      >
                        <span>Close</span>
                      </button>
                    </div>

                    {showGamotList === 'picker' && (
                      <div className="card-grid" style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="choice-card green-card"
                          onClick={() => setShowGamotList('54')}
                        >
                          <h3>54 Gamot (E-GAMOT)</h3>
                          <p>MedPure / Gamot App · under ₱20,000 annual limit</p>
                        </button>
                        <button
                          type="button"
                          className="choice-card"
                          onClick={() => setShowGamotList('21')}
                        >
                          <h3>21 Core (GAMOT)</h3>
                          <p>Hospital Pharmacy / Epress · always in stock</p>
                        </button>
                      </div>
                    )}

                    {showGamotList === '54' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ marginBottom: 10 }}
                          onClick={() => setShowGamotList('picker')}
                        >
                          <span>← Back to list choice</span>
                        </button>
                        <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                          Patient proceeds to <strong>Medpure</strong> for E-GAMOT (54) dispensing via
                          Gamot App.
                        </p>
                        <div className="section-label">E-GAMOT (54) medicine list — by category</div>
                        {EGAMOT_54_BY_CATEGORY.map((cat) => (
                          <div key={cat.category} className="med-category">
                            <div className="med-cat-title">{cat.category}</div>
                            <div className="med-grid med-grid-3">
                              {cat.items.map((name, i) => (
                                <div key={name} className="med-item">
                                  <span className="med-num">{i + 1}</span>
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="section-desc" style={{ marginTop: 8 }}>
                          Covered under PhilHealth YAKAP for CY 2026
                        </p>
                      </>
                    )}

                    {showGamotList === '21' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ marginBottom: 10 }}
                          onClick={() => setShowGamotList('picker')}
                        >
                          <span>← Back to list choice</span>
                        </button>
                        <p style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                          Patient proceeds to <strong>Hospital Pharmacy</strong> for GAMOT (21 Core)
                          via Epress.
                        </p>
                        <div className="section-label">GAMOT (21 Core) medicine list — by category</div>
                        {GAMOT_21_BY_CATEGORY.map((cat) => (
                          <div key={cat.category} className="med-category">
                            <div className="med-cat-title">{cat.category}</div>
                            <div className="med-grid med-grid-3">
                              {cat.items.map((name, i) => (
                                <div key={name} className="med-item">
                                  <span className="med-num">{i + 1}</span>
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="section-desc" style={{ marginTop: 8 }}>
                          Covered under PhilHealth YAKAP for CY 2026
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {!(program.id === 'yakap-cancer' && cancerHowToIndex !== null) && (
            <div className="nav-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={goBackSteps}
              >
                <span>← Back</span>
              </button>
              {!(
                (program.id === 'inter-global-referral' && stepIndex === 0) ||
                (program.id === 'inter-global-referral' &&
                  igrEntry === 'opd' &&
                  igrSelfConduction === null &&
                  activeProgramSteps[stepIndex]?.title.startsWith('OPD/Walk-In')) ||
                (program.id === 'yakap-cancer' && stepIndex === 1) ||
                (program.id === 'yakap-cancer' && cancerHowToIndex !== null)
              ) && (
                <button type="button" className="btn btn-green" onClick={() => void nextStep()}>
                  <span>
                    {stepIndex < activeProgramSteps.length - 1
                      ? 'Next step →'
                      : 'Finish program'}
                  </span>
                </button>
              )}
            </div>
            )}
          </div>
        )}

        {screen === 'done' && (
          <>
            <div className="section-title">Program completed</div>
            <div className="info-card">
              <p>
                <strong>{lastCompleted?.patient_name ?? patientName}</strong> —{' '}
                {lastCompleted?.program_name ?? program?.name ?? 'Program'} was recorded on the
                Benefits dashboard (separate from the flow guide census).
              </p>
            </div>
            {lastCompleted && canEditCompletion(lastCompleted) && (
              <div className="ben-edit-window">
                <p>
                  Made a mistake? For {COMPLETION_EDIT_WINDOW_MS / 60000} minutes you can fix this
                  record.
                </p>
                <div className="action-row">
                  <button type="button" className="btn btn-outline" onClick={() => openRename(lastCompleted)}>
                    <span>Edit patient name</span>
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => reopenCompletion(lastCompleted)}>
                    <span>Reopen</span>
                  </button>
                </div>
              </div>
            )}
            <div className="action-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-green" onClick={newPatient}>
                <span>New patient</span>
              </button>
            </div>
          </>
        )}

        <div className="footer-bar">
          <strong>OUR COMMITMENT:</strong> Right Benefit. Right Patient. Right Time.
          <br />
          We Care. We Guide. We Serve. · {siteName}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useApp } from '../../contexts/AppContext'
import { ApiService } from '../../services/api-service'
import { isoCountries } from '../../constants/isoCountries'
import { WEWIRE_SUPPORTED_CURRENCIES, WEWIRE_MAX_ACCOUNTS } from '../../types/app'
import '../../styles/AuthPage.css'

// ── PaymentsOnboarding ───────────────────────────────────────────
// Purpose: Skippable post-signup wizard that registers the company as a WeWire business
// sub-customer, submits its business KYC, and requests up to WEWIRE_MAX_ACCOUNTS currency
// virtual accounts. Reached right after AuthPage.tsx's signup success, and re-enterable any
// time from Settings > Payments (which is also where accounts/beneficiaries/hold-vs-disburse
// stay manageable after this wizard is done).
// State: step (1-4), businessType/country/kyc fields, selected currencies, loading/error.
// API: ApiService.registerWeWireSubCustomer, submitWeWireKyc, createWeWireAccount.

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function PaymentsOnboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toastAction } = useApp()

  const [step, setStep] = useState(1)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // The wizard can be re-entered after a partial attempt — e.g. the KYC submission actually
  // went through on WeWire's side (see WeWireOnboardingController::submitKyc) but the request
  // errored out client-side before the frontend heard back (a slow document upload can outlast
  // an axios/proxy timeout even though Laravel finishes the job and updates wewire_kyc_status).
  // Without this check the wizard always restarts at step 1, forcing the whole KYC form —
  // documents included — to be redone even though nothing was actually lost. Skip ahead based
  // on what's already recorded server-side instead.
  useEffect(() => {
    Promise.all([ApiService.getWeWireStatus(), ApiService.getWeWireAccounts()])
      .then(([status, accounts]) => {
        const already = accounts.map(a => a.currency)
        setExistingCurrencies(already)

        const needsKycForm = status.wewire_kyc_status === 'not_started'
          || status.wewire_kyc_status === 'draft'
          || status.wewire_kyc_status === 'rejected'
          || status.wewire_kyc_status === 'resubmission'

        if (!status.wewire_subcustomer_id) {
          setStep(1) // never registered — start from the intro.
        } else if (needsKycForm) {
          setStep(2) // never submitted, or WeWire rejected/asked for resubmission — (re)do the form.
        } else if (already.length >= WEWIRE_MAX_ACCOUNTS) {
          setStep(4) // KYC accepted (in review/approved) and every currency slot already requested.
        } else {
          setStep(3) // KYC accepted (in review/approved) — pick currencies.
        }
      })
      .catch(() => setStep(1))
      .finally(() => setCheckingStatus(false))
  }, [])

  // Step 2 — business registration + KYC
  const [country, setCountry] = useState('')
  const [businessType, setBusinessType] = useState<'GENERAL_BUSINESS' | 'SOLE_PROPRIETORSHIP'>('GENERAL_BUSINESS')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [incorporatedOn, setIncorporatedOn] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState('')
  const [incorporationDoc, setIncorporationDoc] = useState<File | null>(null)

  // Beneficial owner
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [ownerDob, setOwnerDob] = useState('')
  const [ownerGender, setOwnerGender] = useState<'M' | 'F'>('M')
  const [ownerNationality, setOwnerNationality] = useState('')
  const [ownerEmail, setOwnerEmail] = useState(user?.email ?? '')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [ownerIdFront, setOwnerIdFront] = useState<File | null>(null)

  // Step 3 — currency accounts
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])
  const [existingCurrencies, setExistingCurrencies] = useState<string[]>([])

  const goDashboard = () => navigate('/app/dashboard')

  const remainingSlots = WEWIRE_MAX_ACCOUNTS - existingCurrencies.length

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies(prev => {
      if (prev.includes(currency)) return prev.filter(c => c !== currency)
      if (prev.length >= remainingSlots) return prev
      return [...prev, currency]
    })
  }

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incorporationDoc || !ownerIdFront) {
      setError('Please attach both required documents.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await ApiService.registerWeWireSubCustomer({
        email: user?.email ?? ownerEmail,
        country,
        business_type: businessType,
      })

      const [incorporationDataUri, ownerIdDataUri] = await Promise.all([
        readFileAsDataUri(incorporationDoc),
        readFileAsDataUri(ownerIdFront),
      ])

      await ApiService.submitWeWireKyc({
        company: {
          registrationNumber,
          incorporatedOn,
          phone,
          address: { addressLine1, city, country },
        },
        questionnaire: {
          businessDescription,
          expectedMonthlyVolume,
        },
        documents: [{ docType: 'INCORPORATION_CERT', file: incorporationDataUri }],
        beneficial_owner: {
          firstName: ownerFirstName,
          lastName: ownerLastName,
          dateOfBirth: ownerDob,
          gender: ownerGender,
          nationality: ownerNationality,
          email: ownerEmail,
          phone: ownerPhone,
          address: { addressLine1, city, country },
          idType: 'NATIONAL_ID',
          idFileFront: ownerIdDataUri,
          shareSize: 100,
        },
      })

      toastAction('Business details submitted for review')
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your business details.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestAccounts = async () => {
    setError('')
    setLoading(true)
    try {
      await Promise.all(selectedCurrencies.map(c => ApiService.createWeWireAccount(c)))
      toastAction('Currency accounts requested')
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request currency accounts.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingStatus) {
    return (
      <div className="page">
        <div className="form-container" style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
          <div className="form-wrap">
            <p className="subtitle">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="form-container" style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
        <div className="form-wrap">
          {step > 1 && step < 4 && (
            <button type="button" className="back-btn" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          <div className="step-content" key={step}>
            {step === 1 && (
              <>
                <h1 className="title">Get paid faster with Meridian Payments</h1>
                <p className="subtitle">
                  Set up multi-currency accounts (USD, EUR, GBP, GHS) so your customers can pay trip
                  costs directly, in lump sums or installments. Money stays held in your Meridian
                  account by default — you decide when and where it moves.
                </p>
                <div className="form" style={{ gap: 12 }}>
                  <button type="button" className="btn" onClick={() => setStep(2)}>Set up now</button>
                  <button type="button" className="link-btn" onClick={goDashboard} style={{ textAlign: 'center' }}>
                    Skip for now — I'll do this later in Settings
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="title">Business details</h1>
                <p className="subtitle">This information is submitted to WeWire, our payments partner, for verification.</p>
                <form className="form" onSubmit={handleSubmitKyc}>
                  <div className="row-2" style={{ display: 'flex', gap: 12 }}>
                    <div className="field">
                      <label>Country</label>
                      <select value={country} onChange={e => setCountry(e.target.value)} required>
                        <option value="" disabled>Select country</option>
                        {isoCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Business type</label>
                      <select value={businessType} onChange={e => setBusinessType(e.target.value as typeof businessType)}>
                        <option value="GENERAL_BUSINESS">General business</option>
                        <option value="SOLE_PROPRIETORSHIP">Sole proprietorship</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Company registration number</label>
                    <input placeholder="e.g. CS123456789" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} required />
                    <p className="field-hint">As it appears on your certificate of incorporation.</p>
                  </div>
                  <div className="field">
                    <label>Date of incorporation</label>
                    <input type="date" value={incorporatedOn} onChange={e => setIncorporatedOn(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Business phone</label>
                    <input placeholder="e.g. +233 20 123 4567" value={phone} onChange={e => setPhone(e.target.value)} required />
                    <p className="field-hint">Include the country code.</p>
                  </div>
                  <div className="field">
                    <label>Address</label>
                    <input placeholder="Street address" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>City</label>
                    <input placeholder="e.g. Accra" value={city} onChange={e => setCity(e.target.value)} required />
                  </div>
                  <div className="field">
                    <label>What does your business do?</label>
                    <input placeholder="e.g. We plan and sell guided tours across West Africa" value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} required />
                    <p className="field-hint">A short description of your travel business — this goes to WeWire for verification.</p>
                  </div>
                  <div className="field">
                    <label>Expected monthly transaction volume</label>
                    <select value={expectedMonthlyVolume} onChange={e => setExpectedMonthlyVolume(e.target.value)} required>
                      <option value="" disabled>Select a range</option>
                      <option value="0-10k">$0 – $10k</option>
                      <option value="10k-100k">$10k – $100k</option>
                      <option value="100k-500k">$100k – $500k</option>
                      <option value="500k+">$500k+</option>
                    </select>
                    <p className="field-hint">A rough estimate is fine — this doesn't limit what you can actually process.</p>
                  </div>
                  <div className="field">
                    <label>Certificate of incorporation</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setIncorporationDoc(e.target.files?.[0] ?? null)} required />
                    <p className="field-hint">JPG, PNG, or PDF. Must clearly show your registration number and business name.</p>
                  </div>

                  <h2 style={{ fontSize: 15, fontWeight: 700, marginTop: 8 }}>Beneficial owner / director</h2>
                  <p className="field-hint" style={{ marginTop: -8 }}>The individual who owns or controls this business — usually the majority shareholder or a director.</p>
                  <div className="row-2" style={{ display: 'flex', gap: 12 }}>
                    <div className="field">
                      <label>First name</label>
                      <input value={ownerFirstName} onChange={e => setOwnerFirstName(e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>Last name</label>
                      <input value={ownerLastName} onChange={e => setOwnerLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="row-2" style={{ display: 'flex', gap: 12 }}>
                    <div className="field">
                      <label>Date of birth</label>
                      <input type="date" value={ownerDob} onChange={e => setOwnerDob(e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>Gender</label>
                      <select value={ownerGender} onChange={e => setOwnerGender(e.target.value as typeof ownerGender)}>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Nationality</label>
                    <select value={ownerNationality} onChange={e => setOwnerNationality(e.target.value)} required>
                      <option value="" disabled>Select nationality</option>
                      {isoCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="row-2" style={{ display: 'flex', gap: 12 }}>
                    <div className="field">
                      <label>Owner email</label>
                      <input type="email" placeholder="owner@company.com" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} required />
                    </div>
                    <div className="field">
                      <label>Owner phone</label>
                      <input placeholder="e.g. +233 20 123 4567" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} required />
                    </div>
                  </div>
                  <div className="field">
                    <label>Owner ID (national ID, passport, etc.)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setOwnerIdFront(e.target.files?.[0] ?? null)} required />
                    <p className="field-hint">A clear photo or scan of the front of a government-issued ID. JPG, PNG, or PDF.</p>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <button type="submit" className="btn" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit for review'}
                  </button>
                </form>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="title">Choose your currency accounts</h1>
                <p className="subtitle">Select up to {remainingSlots} currencies you want to collect payments in. You can add more later from Settings.</p>
                <div className="form" style={{ gap: 8 }}>
                  {existingCurrencies.length > 0 && (
                    <p className="field-hint">Already requested: {existingCurrencies.join(', ')}.</p>
                  )}
                  {WEWIRE_SUPPORTED_CURRENCIES.filter(c => !existingCurrencies.includes(c)).map(c => (
                    <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: '1px solid #DDE0E8', borderRadius: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedCurrencies.includes(c)}
                        onChange={() => toggleCurrency(c)}
                        disabled={!selectedCurrencies.includes(c) && selectedCurrencies.length >= remainingSlots}
                      />
                      {c}
                    </label>
                  ))}
                  {error && <div className="error-message">{error}</div>}
                  <button type="button" className="btn" onClick={handleRequestAccounts} disabled={loading || selectedCurrencies.length === 0}>
                    {loading ? 'Requesting...' : `Request ${selectedCurrencies.length || ''} account${selectedCurrencies.length === 1 ? '' : 's'}`}
                  </button>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="title">You're all set</h1>
                <p className="subtitle">
                  Your business details are in review with WeWire, and your currency accounts are being provisioned.
                  You'll see them go live in Settings &gt; Payments, usually within a few minutes to a day.
                </p>
                <button type="button" className="btn" onClick={goDashboard}>Go to dashboard</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

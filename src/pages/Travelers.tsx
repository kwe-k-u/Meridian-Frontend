import '../styles/Travelers.css';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext'

export default function Travelers() {
  const navigate = useNavigate();
  const ctx = useApp()
  const travelersList = ctx.getTravelersData()

  return (
    <div className="travelers-page">
      <div className="card">
        <div className="table-header travelers-table-header">
          <span className="table-th">Traveler</span>
          <span className="table-th">Latest trip</span>
          <span className="table-th">Destinations</span>
          <span className="table-th">Status</span>
          <span className="table-th">Value</span>
        </div>
        {travelersList.map((t, i) => (
          <div key={i} className="table-row travelers-table-row" onClick={() => navigate(`/app/trips/${i}`)}>
            <div className="flex-row gap-12">
              <div className="avatar-circle" style={{ background: t.avatarBg }}>{t.initials}</div>
              <span className="traveler-name">{t.name}</span>
            </div>
            <span className="traveler-cell-text">{t.trip}</span>
            <span className="traveler-cell-text">{t.where}</span>
            <span>
              <span className="status-pill" style={{ background: t.statusBg, color: t.statusFg }}>{t.status}</span>
            </span>
            <span className="traveler-value-text">{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

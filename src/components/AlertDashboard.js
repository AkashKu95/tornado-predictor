import { useState, useEffect } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, Clock, Zap, MapPin, Eye, Users } from 'lucide-react';
import { fetchActiveWarnings, fetchTodayWarningsHistory } from '@/lib/noaaApi';
import { parseNwsAlert } from '@/lib/alertParser';

export default function AlertDashboard({ onAlertSelect, onAlertsLoaded }) {
  const [alerts, setAlerts] = useState([]);
  const [historyAlerts, setHistoryAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Collapse by default on mobile screens on initial load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsCollapsed(window.innerWidth < 768);
    }
  }, []);

  useEffect(() => {
    async function getAlerts() {
      setIsLoading(true);
      const data = await fetchActiveWarnings();
      setAlerts(data);
      if (onAlertsLoaded) onAlertsLoaded(data);
      setIsLoading(false);

      // Auto-select the first Tornado Warning on initial load
      if (!hasAutoSelected && data.length > 0) {
        const firstWarning = data.find(a => a.properties.event === 'Tornado Warning');
        if (firstWarning) {
          const alertId = firstWarning.properties.id || data.indexOf(firstWarning);
          setExpandedId(alertId);
          if (onAlertSelect) {
            onAlertSelect(firstWarning);
          }
        }
        setHasAutoSelected(true);
      }
    }

    getAlerts();

    // Refresh alerts every 5 minutes
    const interval = setInterval(getAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hasAutoSelected, onAlertSelect]);

  // Fetch history when tab switches
  useEffect(() => {
    async function loadHistory() {
      if (activeTab === 'history' && historyAlerts.length === 0) {
        setIsHistoryLoading(true);
        const data = await fetchTodayWarningsHistory();
        setHistoryAlerts(data);
        setIsHistoryLoading(false);
      }
    }
    loadHistory();
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="glass-panel w-[calc(100vw-48px)] md:w-[320px]" style={{ padding: '16px 24px' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
          <Info size={18} /> Connecting to NWS...
        </p>
      </div>
    );
  }

  const displayedAlerts = activeTab === 'active' ? alerts : historyAlerts;

  return (
    <div className={`glass-panel transition-all duration-300 ease-in-out ${isCollapsed ? 'w-fit' : 'w-[calc(100vw-48px)] md:w-[320px]'} max-h-[40vh] md:max-h-[500px]`} style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{ padding: isCollapsed ? '10px 16px' : '16px 20px', borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer' }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 style={{ fontSize: isCollapsed ? '0.9rem' : '1rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={isCollapsed ? 16 : 18} color="#ef4444" />
          <span>NWS Alerts</span>
          {isCollapsed && alerts.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{alerts.length}</span>}
        </h2>
        <div style={{ color: '#94a3b8' }}>
          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={20} />}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => { setActiveTab('active'); setExpandedId(null); onAlertSelect && onAlertSelect(null); }}
              style={{
                flex: 1, padding: '10px', background: 'transparent', color: activeTab === 'active' ? '#fff' : '#94a3b8',
                borderBottom: activeTab === 'active' ? '2px solid #ef4444' : '2px solid transparent', cursor: 'pointer',
                fontWeight: activeTab === 'active' ? 600 : 400, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              Active
              <span style={{ background: alerts.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                {alerts.length}
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('history'); setExpandedId(null); onAlertSelect && onAlertSelect(null); }}
              style={{
                flex: 1, padding: '10px', background: 'transparent', color: activeTab === 'history' ? '#fff' : '#94a3b8',
                borderBottom: activeTab === 'history' ? '2px solid #3b82f6' : '2px solid transparent', cursor: 'pointer',
                fontWeight: activeTab === 'history' ? 600 : 400, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <Clock size={14} /> Today
            </button>
          </div>

          <div style={{ padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeTab === 'history' && isHistoryLoading ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '16px 0' }}>
                Loading historical data...
              </p>
            ) : displayedAlerts.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '16px 0' }}>
                {activeTab === 'active' ? "No active tornado warnings at this time." : "No warnings issued today."}
              </p>
            ) : (
              displayedAlerts.map((alert, idx) => {
                const props = alert.properties;
                const isWarning = props.event === 'Tornado Warning';
                const alertId = props.id || idx;
                const isExpanded = expandedId === alertId;
                const isExpired = activeTab === 'history' && new Date(props.expires) < new Date();

                return (
                  <div
                    key={alertId}
                    className="alert-card"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : alertId);
                      if (onAlertSelect && !isExpanded) {
                        onAlertSelect(alert);
                      } else if (onAlertSelect && isExpanded) {
                        onAlertSelect(null);
                      }
                    }}
                    style={{
                      background: isExpired ? 'rgba(30, 41, 59, 0.6)' : (isWarning ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(127, 29, 29, 0.1) 100%)' : 'linear-gradient(135deg, rgba(217, 119, 6, 0.25) 0%, rgba(146, 64, 14, 0.1) 100%)'),
                      border: `1px solid ${isExpired ? '#475569' : (isWarning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)')}`,
                      borderLeft: `4px solid ${isExpired ? '#64748b' : (isWarning ? '#ef4444' : '#f59e0b')}`,
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      opacity: isExpired ? 0.75 : 1,
                      boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px', color: isExpired ? '#94a3b8' : (isWarning ? '#fca5a5' : '#fcd34d') }}>
                        <AlertTriangle size={16} /> {props.event} {isExpired && "(Expired)"}
                      </h4>
                      {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {props.areaDesc}
                    </p>
                    <p suppressHydrationWarning style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Expires: {new Date(props.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>

                    {isExpanded && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                        {/* Deterministic / AI-style Summary Section */}
                        {(() => {
                          const summary = parseNwsAlert(props.description, props.instruction);

                          return (
                            <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '6px' }}>
                              <h5 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                                Quick Impact Summary
                              </h5>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                  <Zap size={14} color="#fca5a5" style={{ marginTop: '2px', flexShrink: 0 }} />
                                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', lineHeight: '1.4' }}>
                                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Hazard:</span> {summary.hazards}
                                  </p>
                                </div>

                                {summary.situation && summary.situation !== "Active weather event." && (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <Eye size={14} color="#93c5fd" style={{ marginTop: '2px', flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', lineHeight: '1.4' }}>
                                      <span style={{ color: '#94a3b8', fontWeight: 500 }}>Situation:</span> {summary.situation}
                                    </p>
                                  </div>
                                )}

                                {summary.position && summary.position !== "Position detailed in full text." && (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <MapPin size={14} color="#fcd34d" style={{ marginTop: '2px', flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', lineHeight: '1.4' }}>
                                      <span style={{ color: '#94a3b8', fontWeight: 500 }}>Movement:</span> {summary.position}
                                    </p>
                                  </div>
                                )}

                                {summary.affectedPlaces.length > 0 && (
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <Users size={14} color="#c084fc" style={{ marginTop: '2px', flexShrink: 0 }} />
                                    <div style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', lineHeight: '1.4' }}>
                                      <span style={{ color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Affected Locations:</span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {summary.affectedPlaces.map((place, i) => (
                                          <span key={i} style={{ display: 'inline-block', background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.75rem', color: '#f3e8ff' }}>
                                            {place}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        })()}

                        {/* Raw Text Below */}
                        {props.instruction && (
                          <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
                            <h5 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#fca5a5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Raw NWS Instructions:</h5>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                              {props.instruction}
                            </p>
                          </div>
                        )}

                        {props.description && (
                          <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '6px' }}>
                            <h5 style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Area Forecast Discussion:</h5>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                              {props.description}
                            </p>
                          </div>
                        )}

                        {!props.instruction && !props.description && (
                          <div style={{ padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No detailed discussion or instructions provided.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

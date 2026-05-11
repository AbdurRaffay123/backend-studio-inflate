'use strict';

const DASHBOARD_STATUS_META = [
  { key: 'new', label: 'New', help: 'Needs first review' },
  { key: 'contacted', label: 'Contacted', help: 'Customer reached' },
  { key: 'booked', label: 'Booked', help: 'Confirmed work' },
  { key: 'completed', label: 'Completed', help: 'Finished' },
  { key: 'cancelled', label: 'Cancelled', help: 'No longer active' },
];

const dashboardMoney = (value) =>
  value != null ? `$${Number(value || 0).toLocaleString('en-US')}` : '$0';

const dashboardStatusLabel = (status) =>
  DASHBOARD_STATUS_META.find((item) => item.key === status)?.label || status || 'Unknown';

window.openConsultationsDashboard = (filter = {}) => {
  cQ = '';
  cStatus = filter.status || '';
  cPipeline = filter.pipeline || '';
  cType = '';
  cFrom = '';
  cTo = '';
  navigate('consultations');
};

window.openCustomersDashboard = () => {
  custQ = '';
  custMemberFrom = '';
  custMemberTo = '';
  navigate('customers');
};

window.openConsultationStatus = (status) => {
  cQ = '';
  cStatus = status;
  cPipeline = '';
  cType = '';
  cFrom = '';
  cTo = '';
  navigate('consultations');
};

window.renderDashboard = async () => {
  setActiveNav('dashboard');
  loading();

  const json = await api('/admin/dashboard');
  if (!json) return;
  if (json.statusCode >= 400) {
    setContent(errBox(json.message || 'Dashboard failed to load'));
    return;
  }

  const data = json.data || {};
  const totals = data.totals || {};
  const byStatus = data.byStatus || {};
  const upcoming = data.upcomingConsultations || [];
  const activity = data.recentActivity || [];

  const activePipelineTotal = ['new', 'contacted', 'booked']
    .reduce((sum, status) => sum + Number(byStatus[status] || 0), 0);

  const statCards = [
    { label: 'Total Customers', value: totals.customers || 0, sub: 'CRM profiles', action: 'openCustomersDashboard()' },
    { label: 'Consultations', value: totals.consultations || 0, sub: 'All time requests', action: 'openConsultationsDashboard()' },
    { label: 'Active Pipeline', value: activePipelineTotal, sub: 'New, contacted, booked', action: "openConsultationsDashboard({ pipeline: 'active' })" },
    { label: 'Estimated Fees', value: dashboardMoney(totals.estimatedConsultationFees), sub: 'Excludes cancelled', action: 'openConsultationsDashboard()' },
  ];

  const statCardsHtml = statCards.map((card) => `
    <button type="button" class="dash-stat" onclick="${card.action}">
      <span class="dash-stat__label">${escHtml(card.label)}</span>
      <span class="dash-stat__value">${escHtml(card.value)}</span>
      <span class="dash-stat__sub">${escHtml(card.sub)}</span>
    </button>
  `).join('');

  const pipelineHtml = DASHBOARD_STATUS_META.map((item) => {
    const count = Number(byStatus[item.key] || 0);
    const pct = totals.consultations ? Math.round((count / totals.consultations) * 100) : 0;
    return `
      <button type="button" class="pipeline-card pipeline-card--${item.key}" onclick="openConsultationStatus('${item.key}')">
        <span class="pipeline-card__top">
          <span>${escHtml(item.label)}</span>
          <span>${count}</span>
        </span>
        <span class="pipeline-card__bar"><span style="width:${pct}%"></span></span>
        <span class="pipeline-card__help">${escHtml(item.help)} · ${pct}%</span>
      </button>
    `;
  }).join('');

  const upcomingHtml = upcoming.length
    ? upcoming.map((item) => `
      <tr class="clickable" onclick="navigate('consultations','${item._id}')">
        <td>${customerCell(item)}</td>
        <td>${badge(item.status)}</td>
        <td><b>${fmt.date(item.scheduledDate)}</b><div class="td-muted">${escHtml(item.scheduledTime || 'No time set')}</div></td>
        <td>${escHtml(item.intake?.eventType || '—')}</td>
        <td>${fmt.type(item.type)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5"><div class="empty">No upcoming consultations this week.</div></td></tr>';

  const activityHtml = activity.length
    ? activity.map((entry) => {
      if (entry.type === 'customer') {
        const customer = entry.customer || {};
        return `
          <button type="button" class="activity-item" onclick="navigate('customers','${customer._id}')">
            <span class="activity-dot activity-dot--customer"></span>
            <span>
              <b>New customer</b>
              <small>${displayName(customer)} · ${fmt.datetime(entry.at)}</small>
            </span>
          </button>
        `;
      }

      const consultation = entry.consultation || {};
      return `
        <button type="button" class="activity-item" onclick="navigate('consultations','${consultation._id}')">
          <span class="activity-dot activity-dot--${escHtml(consultation.status || 'new')}"></span>
          <span>
            <b>${escHtml(dashboardStatusLabel(consultation.status))} consultation</b>
            <small>${displayName(consultation)} · ${fmt.datetime(entry.at)}</small>
          </span>
        </button>
      `;
    }).join('')
    : '<div class="empty empty-compact">No recent activity yet.</div>';

  setContent(`
    <div class="topbar dashboard-hero">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Quick view of pipeline health, upcoming work, and recent CRM activity.</div>
      </div>
      <button type="button" class="btn" onclick="renderDashboard()">Refresh</button>
    </div>

    <div class="dash-stat-grid">${statCardsHtml}</div>

    <div class="grid-2 dashboard-main-grid">
      <div class="card dashboard-card">
        <div class="dashboard-card__head">
          <h3>Consultation Pipeline</h3>
          <span>${totals.consultations || 0} total</span>
        </div>
        <div class="pipeline-grid">${pipelineHtml}</div>
      </div>

      <div class="card dashboard-card">
        <div class="dashboard-card__head">
          <h3>Recent Activity</h3>
          <span>Latest updates</span>
        </div>
        <div class="activity-list">${activityHtml}</div>
      </div>
    </div>

    <div class="card dashboard-card">
      <div class="dashboard-card__head">
        <h3>Upcoming This Week</h3>
        <span>${upcoming.length} scheduled</span>
      </div>
      <div class="table-wrap" style="margin:0;">
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Scheduled</th><th>Event Type</th><th>Type</th></tr></thead>
          <tbody>${upcomingHtml}</tbody>
        </table>
      </div>
    </div>
  `);
};

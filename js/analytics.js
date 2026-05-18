/**
 * analytics.js — Charts, heatmap, insights (Canvas + DOM)
 */
const Analytics = (() => {
  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#22c55e', '#3b82f6'];
  let resizeObserver = null;

  function themeColors() {
    const s = getComputedStyle(document.documentElement);
    return {
      muted: (s.getPropertyValue('--text-muted') || '#a1a1aa').trim(),
      border: (s.getPropertyValue('--border') || 'rgba(255,255,255,0.1)').trim(),
      track: (s.getPropertyValue('--input-bg') || '#1a1a24').trim()
    };
  }

  function setupCanvas(canvas, height = 220) {
    if (!canvas) return null;
    const parent = canvas.closest('.chart-card') || canvas.parentElement;
    const w = Math.max(canvas.clientWidth || parent?.clientWidth || 320, 240);
    const h = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function getDailyCompletion(data, days = 7) {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = Storage.dateKey(d);
      let scheduled = 0;
      let completed = 0;
      data.habits.forEach((h) => {
        if (!Streak.isScheduledDay(h, d)) return;
        scheduled++;
        if (Streak.getStatus(h, key) === 'completed') completed++;
      });
      result.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        date: key,
        pct: scheduled ? Math.round((completed / scheduled) * 100) : 0,
        completed,
        scheduled
      });
    }
    return result;
  }

  function getHabitWeeklyRate(habit, days = 7) {
    let scheduled = 0;
    let completed = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (!Streak.isScheduledDay(habit, d)) continue;
      scheduled++;
      if (Streak.getStatus(habit, Storage.dateKey(d)) === 'completed') completed++;
    }
    return scheduled ? Math.round((completed / scheduled) * 100) : 0;
  }

  function getMonthlyData(data) {
    const now = new Date();
    const weekLabels = ['W1', 'W2', 'W3'];
    const weeks = [];
    for (let w = 2; w >= 0; w--) {
      let total = 0;
      let done = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - w * 7 - d);
        const key = Storage.dateKey(date);
        data.habits.forEach((h) => {
          if (!Streak.isScheduledDay(h, date)) return;
          total++;
          if (Streak.getStatus(h, key) === 'completed') done++;
        });
      }
      weeks.push({
        label: weekLabels[2 - w],
        sublabel: w === 0 ? 'This week' : w === 1 ? 'Last week' : '2 wks ago',
        pct: total ? Math.round((done / total) * 100) : 0,
        total,
        done
      });
    }
    return weeks;
  }

  function getSuccessRates(data) {
    return data.habits
      .map((h) => {
        const weekly = getHabitWeeklyRate(h, 7);
        const allTime = h.consistency || 0;
        return {
          title: h.title,
          rate: weekly,
          allTime,
          id: h.id,
          streak: h.streak.current
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }

  function getTopBottom(data) {
    const rates = getSuccessRates(data);
    const withData = rates.filter((r) => r.rate > 0);
    return {
      best: withData[0] || rates[0] || null,
      worst: rates[rates.length - 1] || null
    };
  }

  function getHeatmapData(data, weeks = 12) {
    const cells = [];
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - weeks * 7 + 1);
    const d = new Date(start);
    while (d <= now) {
      const key = Storage.dateKey(d);
      let scheduled = 0;
      let completed = 0;
      data.habits.forEach((h) => {
        if (!Streak.isScheduledDay(h, d)) return;
        scheduled++;
        if (Streak.getStatus(h, key) === 'completed') completed++;
      });
      const level = scheduled ? Math.min(4, Math.floor((completed / scheduled) * 4)) : 0;
      cells.push({ date: key, level, completed, scheduled });
      d.setDate(d.getDate() + 1);
    }
    return cells;
  }

  function drawGrid(ctx, pad, chartW, chartH, w, colors) {
    const steps = [0, 25, 50, 75, 100];
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    steps.forEach((pct) => {
      const y = pad.t + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + chartW, y);
      ctx.stroke();
      ctx.fillStyle = colors.muted;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pct}%`, pad.l - 6, y);
    });
  }

  function drawBarChart(canvas, labels, values, animate = true, sublabels = null) {
    const setup = setupCanvas(canvas, 220);
    if (!setup || !values.length) return;
    const { ctx, w, h } = setup;
    const colors = themeColors();
    const pad = { t: 28, r: 16, b: 40, l: 42 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const slotW = chartW / values.length;
    const barW = Math.min(Math.max(slotW - 14, 12), 52);
    const minGhost = 5;

    function paint(progress) {
      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, pad, chartW, chartH, w, colors);

      values.forEach((val, i) => {
        const easedVal = val * progress;
        const barHeight =
          val === 0
            ? minGhost
            : Math.max((easedVal / 100) * chartH, minGhost + 2);

        const x = pad.l + i * slotW + (slotW - barW) / 2;
        const by = pad.t + chartH - barHeight;

        const grad = ctx.createLinearGradient(0, by, 0, pad.t + chartH);
        if (val > 0) {
          grad.addColorStop(0, COLORS[i % COLORS.length]);
          grad.addColorStop(1, COLORS[(i + 2) % COLORS.length] + 'aa');
        } else {
          grad.addColorStop(0, colors.border);
          grad.addColorStop(1, colors.track);
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, by, barW, barHeight, [6, 6, 0, 0]);
        else ctx.rect(x, by, barW, barHeight);
        ctx.fill();

        ctx.fillStyle = colors.muted;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(labels[i], x + barW / 2, h - (sublabels?.[i] ? 26 : 14));
        if (sublabels?.[i]) {
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.fillStyle = colors.muted;
          ctx.fillText(sublabels[i], x + barW / 2, h - 12);
          ctx.font = '11px Inter, system-ui, sans-serif';
        }

        if (val > 0) {
          ctx.fillStyle = val > 40 ? '#fff' : colors.muted;
          ctx.font = '600 10px Inter, system-ui, sans-serif';
          ctx.fillText(`${val}%`, x + barW / 2, Math.max(by - 6, pad.t + 12));
        }
      });
    }

    if (!animate) {
      paint(1);
      return;
    }

    let start = null;
    const duration = 750;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      paint(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function drawLineChart(canvas, points) {
    const setup = setupCanvas(canvas, 180);
    if (!setup || !points.length) return;
    const { ctx, w, h } = setup;
    const colors = themeColors();
    const pad = { t: 28, r: 20, b: 36, l: 42 };
    const chartW = w - pad.l - pad.r;
    const chartH = h - pad.t - pad.b;
    const max = Math.max(...points.map((p) => p.pct), 1);

    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, pad, chartW, chartH, w, colors);

    const coords = points.map((p, i) => ({
      x: pad.l + (i / Math.max(points.length - 1, 1)) * chartW,
      y: pad.t + chartH - (p.pct / max) * chartH,
      pct: p.pct,
      label: p.label
    }));

    if (coords.length > 1) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
      grad.addColorStop(0, 'rgba(99,102,241,0.3)');
      grad.addColorStop(1, 'rgba(99,102,241,0)');
      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      coords.slice(1).forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.lineTo(coords[coords.length - 1].x, pad.t + chartH);
      ctx.lineTo(coords[0].x, pad.t + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      coords.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    }

    coords.forEach((c, i) => {
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
      if (i % 2 === 0 || i === coords.length - 1) {
        ctx.fillStyle = colors.muted;
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(points[i].label || '', c.x, h - 12);
      }
    });
  }

  function renderHeatmap(container, cells) {
    if (!container) return;
    if (!cells.length) {
      const empty = document.createElement('p');
      empty.className = 'analytics-empty';
      empty.textContent = 'No activity yet — complete habits to fill the heatmap.';
      container.replaceChildren(empty);
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'heatmap-grid';
    cells.forEach((c) => {
      const el = document.createElement('div');
      el.className = `heatmap-cell level-${c.level}`;
      el.title = `${c.date}: ${c.completed}/${c.scheduled} habits`;
      wrap.appendChild(el);
    });
    container.replaceChildren(wrap);
  }

  function renderSuccessRates(container, rates) {
    if (!container) return;
    if (!rates.length) {
      const empty = document.createElement('p');
      empty.className = 'analytics-empty';
      empty.textContent = 'Add habits to see success rates.';
      container.replaceChildren(empty);
      return;
    }
    const rows = rates.map((r, i) => {
      const w = Math.max(r.rate, 0);
      const displayW = w === 0 ? 0 : Math.max(w, 8);
      const row = document.createElement('div');
      row.className = 'rate-row';

      const title = document.createElement('span');
      title.className = 'rate-title';
      title.title = r.title;
      title.textContent = r.title;

      const bar = document.createElement('div');
      bar.className = 'rate-bar';
      const fill = document.createElement('div');
      fill.className = 'rate-fill';
      fill.style.width = `${displayW}%`;
      fill.style.background = COLORS[i % COLORS.length];
      fill.dataset.rate = r.rate;
      bar.appendChild(fill);

      const pct = document.createElement('span');
      pct.className = 'rate-pct';
      pct.textContent = `${r.rate}%`;

      row.append(title, bar, pct);
      return row;
    });
    container.replaceChildren(...rows);
  }

  function renderTopHabits(container, data) {
    const { best, worst } = getTopBottom(data);
    const bestLabel = best?.rate > 0 ? `${best.rate}% this week` : 'No completions yet';
    const worstLabel = worst ? `${worst.rate}% this week` : '';
    const makeItem = (kind, labelText, titleText, valueText) => {
      const item = document.createElement('div');
      item.className = `top-item ${kind}`;
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = labelText;
      const title = document.createElement('strong');
      title.textContent = titleText;
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = valueText;
      item.append(label, title, val);
      return item;
    };
    container.replaceChildren(
      makeItem('best', 'Most Completed (7 days)', best ? best.title : '—', bestLabel),
      makeItem('worst', 'Needs Attention', worst ? worst.title : '—', worstLabel)
    );
  }

  function renderWeeklyOverview(container, weekData) {
    if (!container) return;
    container.innerHTML = weekData
      .map((d) => {
        const h = d.pct === 0 ? 4 : d.pct;
        return `
      <div class="week-bar-item">
        <div class="week-bar"><div class="week-bar-fill ${d.pct === 0 ? 'week-bar-fill--empty' : ''}" style="height:${h}%"></div></div>
        <span>${d.label}</span>
        <small>${d.pct}%</small>
      </div>`;
      })
      .join('');
  }

  function renderSummaryStrip(container, weekly) {
    if (!container) return;
    const totalCompleted = weekly.reduce((s, d) => s + d.completed, 0);
    const totalScheduled = weekly.reduce((s, d) => s + d.scheduled, 0);
    const avg = totalScheduled ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
    const activeDays = weekly.filter((d) => d.scheduled > 0 && d.pct > 0).length;
    container.innerHTML = `
      <div class="analytics-summary">
        <span><strong>${avg}%</strong> weekly avg</span>
        <span><strong>${totalCompleted}</strong> / ${totalScheduled} completions</span>
        <span><strong>${activeDays}</strong> active days</span>
      </div>`;
  }

  function renderAll(data) {
    if (!data) return;

    const weekly = getDailyCompletion(data, 7);
    const monthly = getMonthlyData(data);
    const trend = getDailyCompletion(data, 14);
    const heatmap = getHeatmapData(data);

    const summaryEl = document.getElementById('analytics-summary');
    renderSummaryStrip(summaryEl, weekly);

    drawBarChart(
      document.getElementById('chart-weekly'),
      weekly.map((d) => d.label),
      weekly.map((d) => d.pct)
    );
    drawBarChart(
      document.getElementById('chart-monthly'),
      monthly.map((d) => d.label),
      monthly.map((d) => d.pct),
      true,
      monthly.map((d) => d.sublabel)
    );
    drawLineChart(document.getElementById('chart-trend'), trend);
    renderHeatmap(document.getElementById('heatmap'), heatmap);
    renderSuccessRates(document.getElementById('success-rates'), getSuccessRates(data));
    renderTopHabits(document.getElementById('top-habits'), data);

    const dashOverview = document.getElementById('weekly-overview');
    if (dashOverview) renderWeeklyOverview(dashOverview, weekly);

    return { weekly, monthly, trend };
  }

  function scheduleRender(data) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => renderAll(data));
    });
  }

  function bindResize() {
    const section = document.getElementById('section-analytics');
    if (!section || resizeObserver) return;
    resizeObserver = new ResizeObserver(() => {
      if (section.classList.contains('active') && window.App?.state) {
        renderAll(window.App.state);
      }
    });
    resizeObserver.observe(section);
  }

  return {
    getDailyCompletion,
    getMonthlyData,
    getSuccessRates,
    getHabitWeeklyRate,
    getHeatmapData,
    renderAll,
    scheduleRender,
    bindResize,
    renderWeeklyOverview,
    COLORS
  };
})();

document.addEventListener('DOMContentLoaded', () => {
    // ---------- Constants ----------
    const CONSTANTS = {
        GRADES: ['大1', '大2', '大3', '大4', '院1', '院2', 'スタッフ/その他'],
        POSITIONS: ['投手', '捕手', '内野手', '外野手', 'スタッフ/その他'],
        PERIODS: {
            DAILY: 'daily',
            WEEKLY: 'weekly',
            MONTHLY: 'monthly'
        },
        CHART_COLORS: {
            WEIGHT: '#3b82f6',
            BODY_FAT: '#f97316',
            SPEED: '#10b981',
            TRAINING: '#f97316',
            STATS: '#3b82f6',
            RATIO: '#8b5cf6'
        }
    };

    // ---------- Global Helpers ----------
    /**
     * Aggregates time-series data based on period (Daily/Weekly/Monthly)
     */
    function aggregateData(data, period, valueKey, valueKey2 = null) {
        const groups = {};
        data.forEach(item => {
            const date = new Date(item.date);
            let key;
            if (period === CONSTANTS.PERIODS.MONTHLY) {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            } else if (period === CONSTANTS.PERIODS.WEEKLY) {
                const dayDifference = date.getDay() === 0 ? 6 : date.getDay() - 1;
                const monday = new Date(date);
                monday.setDate(date.getDate() - dayDifference);
                key = monday.toISOString().split('T')[0];
            } else {
                key = item.date;
            }

            if (!groups[key]) groups[key] = { sum: 0, count: 0, sum2: 0, count2: 0 };
            const val = item[valueKey];
            if (val !== null && val !== undefined) {
                groups[key].sum += val;
                groups[key].count++;
            }
            if (valueKey2) {
                const val2 = item[valueKey2];
                if (val2 !== null && val2 !== undefined) {
                    groups[key].sum2 += val2;
                    groups[key].count2++;
                }
            }
        });

        return Object.keys(groups).sort().map(k => ({
            date: k,
            value: groups[k].count > 0 ? groups[k].sum / groups[k].count : null,
            value2: groups[k].count2 > 0 ? groups[k].sum2 / groups[k].count2 : null
        }));
    }

    /**
     * Gets the latest value (or average of the latest day) from a set of records
     */
    function getLatestVal(records, key) {
        if (!records || !records.length) return null;
        const sortedByDate = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
        const latestDate = sortedByDate[sortedByDate.length - 1].date;
        const dayRecords = sortedByDate.filter(r => r.date === latestDate);
        const sum = dayRecords.reduce((s, r) => s + (r[key] || 0), 0);
        return sum / dayRecords.length;
    }

    // Tab Navigation Logic
    const navLinks = document.querySelectorAll('.nav-links li');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('page-title');

    // MOBILE / UI Constants (Fixing ReferenceError)
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const graphTabs = document.querySelectorAll('.graph-tab');
    
    // View Toggle Constants
    const viewportMeta = document.getElementById('viewport-meta');
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    let isDesktopView = localStorage.getItem('forceDesktopView') === 'true';

    // ---------- Sidebar & Navigation ----------

    function initNavListeners() {
        // Tab Navigation
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.forEach(item => item.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                link.classList.add('active');
                const targetTab = link.getAttribute('data-tab');
                const targetPane = document.getElementById(targetTab);
                if (!targetPane) return;
                targetPane.classList.add('active');
                pageTitle.innerText = link.innerText.trim();

                // Mobile specific: close sidebar
                if (window.innerWidth <= 900) {
                    sidebar?.classList.remove('open');
                    sidebarOverlay?.classList.remove('active');
                }
            });
        });

        // Mobile Menu Button
        mobileMenuBtn?.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('active');
        });

        sidebarOverlay?.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });

        // Graph Tab Switching
        graphTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                graphTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetGraph = tab.getAttribute('data-graph');
                document.querySelectorAll('.chart-card').forEach(card => card.style.display = 'none');
                const targetEl = document.getElementById(`graph-card-${targetGraph}`);
                if (targetEl) targetEl.style.display = 'block';
            });
        });

        // View Mode Toggle
        viewToggleBtn?.addEventListener('click', () => {
            isDesktopView = !isDesktopView;
            localStorage.setItem('forceDesktopView', isDesktopView);
            applyViewMode();
        });
    }

    initNavListeners();
    applyViewMode();

    // ---------- View Toggle Logic (PC / Mobile) ----------

    function updateViewToggleButton(iconClass, label) {
        if (!viewToggleBtn) return;

        const icon = viewToggleBtn.querySelector('i');
        const text = viewToggleBtn.querySelector('#view-toggle-text');

        if (icon) icon.className = `fa-solid ${iconClass}`;
        if (text) text.textContent = label;

        viewToggleBtn.title = label;
        viewToggleBtn.setAttribute('aria-label', label);
    }

    function applyViewMode() {
        if (!viewportMeta) return;

        if (isDesktopView) {
            // Force desktop width
            viewportMeta.setAttribute('content', 'width=1024, user-scalable=yes');
            updateViewToggleButton('fa-mobile-screen', 'スマホ版に戻す');
        } else {
            // Default responsive
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            updateViewToggleButton('fa-desktop', 'PC版で表示');
            sidebar?.classList.remove('open');
            sidebarOverlay?.classList.remove('active');
        }
    }

    // ---------- Chart Helpers ----------

    function createLineChart(ctx, label, color, options = {}) {
        if (!ctx) return null;
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: color,
                    backgroundColor: `${color}1A`, // 10% opacity hex
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: color,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: options.showLegend || false } },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ...options.yScale }
                },
                ...options.extraOptions
            }
        });
    }

    // Initialize Charts
    weightChartInstance = createLineChart(document.getElementById('weightChart'), '体重 (kg)', CONSTANTS.CHART_COLORS.WEIGHT, {
        showLegend: true,
        extraOptions: {
            scales: {
                y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
    if (weightChartInstance) {
        weightChartInstance.data.datasets.push({
            label: '体脂肪率 (%)',
            data: [],
            borderColor: CONSTANTS.CHART_COLORS.BODY_FAT,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.4,
            yAxisID: 'y1'
        });
    }

    speedChartInstance = createLineChart(document.getElementById('pitchSpeedChart'), 'MAX球速 (km/h)', CONSTANTS.CHART_COLORS.SPEED, {
        yScale: { min: 100 }
    });
    trainingChartInstance = createLineChart(document.getElementById('trainingChart'), '重量 (kg)', CONSTANTS.CHART_COLORS.TRAINING);
    statsChartInstance = createLineChart(document.getElementById('statsChart'), '記録', CONSTANTS.CHART_COLORS.STATS);
    ratioChartInstance = createLineChart(document.getElementById('ratioChart'), '単位仕事量 (重量/体重)', CONSTANTS.CHART_COLORS.RATIO);

    // ---------- Event Listeners ----------

    function initEventListeners() {
        // Toggle logic for message history
        document.getElementById('toggle-comments-history')?.addEventListener('click', () => {
            const historyContainer = document.getElementById('dashboard-comments-history');
            const btn = document.getElementById('toggle-comments-history');
            const isHidden = historyContainer.style.display === 'none';
            historyContainer.style.display = isHidden ? 'block' : 'none';
            btn.innerHTML = isHidden 
                ? '<i class="fa-solid fa-chevron-up"></i> メッセージ履歴を閉じる' 
                : '<i class="fa-solid fa-clock-rotate-left"></i> メッセージ履歴を表示';
        });

        // Master Dashboard Filters
        const filterIds = [
            'dash-filter-grade', 'dash-filter-player', 'dash-filter-position', 'dash-filter-period', 
            'dash-exclude-grade', 'dash-exclude-position', 'dash-exclude-player',
            'training-chart-type', 'stats-chart-type', 'weight-chart-range', 'speed-chart-range'
        ];
        filterIds.forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => updateDashboard());
        });

        // Header Auth Buttons
        document.getElementById('header-login-btn')?.addEventListener('click', () => {
            showAuthModal();
            authMasterView.style.display = 'none';
            if (authMasterRegisterView) authMasterRegisterView.style.display = 'none';
            authRegisterView.style.display = 'none';
            authLoginView.style.display = 'block';
        });

        document.getElementById('header-logout-btn')?.addEventListener('click', () => {
            if(confirm('ログアウトしますか？')) {
                localStorage.clear(); // Simpler logout
                setRole('player');
                initializeAppState();
            }
        });

        // Add Record Button Animation
        document.getElementById('add-record-btn')?.addEventListener('click', () => {
            alert('新規記録モーダルを開きます (機能実装予定)');
        });

        // 「その他」選択時のメモ欄 show/hide
        document.getElementById('train-type')?.addEventListener('change', (e) => {
            const group = document.getElementById('train-other-memo-group');
            if (group) group.style.display = e.target.value === 'その他' ? 'block' : 'none';
        });

        document.getElementById('stat-type')?.addEventListener('change', (e) => {
            const group = document.getElementById('stat-other-memo-group');
            if (group) group.style.display = e.target.value === 'その他' ? 'block' : 'none';
        });
    }

    initEventListeners();

    // ---------- Dashboard Helpers ----------

    function getDashboardFilters(role, currentUserId) {
        const filters = {
            grade: 'all',
            position: 'all',
            playerId: currentUserId,
            period: CONSTANTS.PERIODS.DAILY,
            exclude: {
                grade: 'none',
                position: 'none',
                playerId: 'none'
            }
        };

        if (role === 'master') {
            filters.grade = document.getElementById('dash-filter-grade')?.value || 'all';
            filters.position = document.getElementById('dash-filter-position')?.value || 'all';
            filters.playerId = document.getElementById('dash-filter-player')?.value || 'all';
            filters.period = document.getElementById('dash-filter-period')?.value || CONSTANTS.PERIODS.DAILY;
            
            filters.exclude.grade = document.getElementById('dash-exclude-grade')?.value || 'none';
            filters.exclude.position = document.getElementById('dash-exclude-position')?.value || 'none';
            filters.exclude.playerId = document.getElementById('dash-exclude-player')?.value || 'none';
        }
        return filters;
    }

    function applyDashboardCriteria(data, players, filters, role) {
        let { allWeights, allStats, allTraining } = data;

        if (role === 'master' && filters.playerId === 'all') {
            let targetPlayers = [...players];
            
            // Inclusion
            if (filters.grade !== 'all') targetPlayers = targetPlayers.filter(p => p.grade === filters.grade);
            if (filters.position !== 'all') targetPlayers = targetPlayers.filter(p => p.position === filters.position);
            
            // Exclusion
            if (filters.exclude.grade !== 'none') targetPlayers = targetPlayers.filter(p => p.grade !== filters.exclude.grade);
            if (filters.exclude.position !== 'none') targetPlayers = targetPlayers.filter(p => p.position !== filters.exclude.position);
            if (filters.exclude.playerId !== 'none') targetPlayers = targetPlayers.filter(p => p.id !== filters.exclude.playerId);
            
            const targetPlayerIds = new Set(targetPlayers.map(p => p.id));
            
            allWeights = allWeights.filter(r => targetPlayerIds.has(r.playerId));
            allStats = allStats.filter(r => targetPlayerIds.has(r.playerId));
            allTraining = allTraining.filter(r => targetPlayerIds.has(r.playerId));
        }

        return { allWeights, allStats, allTraining };
    }

    function updateDashboardCharts(data, filters) {
        const { allWeights, allStats, allTraining } = data;
        const { period } = filters;

        // 1. Weight Chart
        const weightRange = parseInt(document.getElementById('weight-chart-range')?.value || '3');
        const weightCutoff = new Date();
        weightCutoff.setMonth(weightCutoff.getMonth() - weightRange);
        const filteredWeights = allWeights.filter(r => new Date(r.date) >= weightCutoff);
        const aggWeights = aggregateData(filteredWeights, period, 'weight', 'bodyFat');

        if (weightChartInstance) {
            weightChartInstance.data.labels = aggWeights.map(d => d.date.substring(5));
            weightChartInstance.data.datasets[0].data = aggWeights.map(d => d.value);
            weightChartInstance.data.datasets[1].data = aggWeights.map(d => d.value2);
            weightChartInstance.update();
        }

        // 2. Speed Chart
        const speedRange = parseInt(document.getElementById('speed-chart-range')?.value || '6');
        const speedCutoff = new Date();
        speedCutoff.setMonth(speedCutoff.getMonth() - speedRange);
        const rawSpeedData = allStats.filter(r => r.type === '球速 (km/h)' && new Date(r.date) >= speedCutoff);
        const aggSpeed = aggregateData(rawSpeedData, period, 'value');

        if (speedChartInstance) {
            speedChartInstance.data.labels = aggSpeed.map(d => d.date.substring(5));
            speedChartInstance.data.datasets[0].data = aggSpeed.map(d => d.value);
            const maxVal = Math.max(...aggSpeed.map(d => d.value || 0), 120);
            speedChartInstance.options.scales.y.max = Math.ceil(maxVal / 5) * 5 + 5;
            speedChartInstance.options.scales.y.min = Math.max(0, Math.floor((maxVal - 20) / 10) * 10);
            speedChartInstance.update();
        }

        // 3. Training Chart
        const trainingType = document.getElementById('training-chart-type')?.value || 'スクワット';
        const rawTrainData = allTraining.filter(r => r.type === trainingType);
        const aggTrain = aggregateData(rawTrainData, period, 'weight');

        if (trainingChartInstance) {
            trainingChartInstance.data.labels = aggTrain.map(d => d.date.substring(5));
            trainingChartInstance.data.datasets[0].label = `${trainingType} (kg)`;
            trainingChartInstance.data.datasets[0].data = aggTrain.map(d => d.value);
            trainingChartInstance.update();
        }

        // 4. Stats Chart
        const statsType = document.getElementById('stats-chart-type')?.value || '遠投 (m)';
        const rawStatsData = allStats.filter(r => r.type === statsType);
        const aggStats = aggregateData(rawStatsData, period, 'value');

        if (statsChartInstance) {
            statsChartInstance.data.labels = aggStats.map(d => d.date.substring(5));
            statsChartInstance.data.datasets[0].label = statsType;
            statsChartInstance.data.datasets[0].data = aggStats.map(d => d.value);
            statsChartInstance.update();
        }

        // 5. Ratio Chart
        if (ratioChartInstance) {
            const sortedWeights = [...allWeights].sort((a,b) => new Date(a.date) - new Date(b.date));
            const trainingBySelectedType = allTraining.filter(t => t.type === trainingType);
            const ratioPoints = [];
            trainingBySelectedType.forEach(t => {
                let weightRecord = sortedWeights.find(w => w.date === t.date);
                if (!weightRecord) {
                    const pastWeights = sortedWeights.filter(w => w.date < t.date);
                    if (pastWeights.length > 0) weightRecord = pastWeights[pastWeights.length - 1];
                }
                if (weightRecord && weightRecord.weight > 0) {
                    ratioPoints.push({
                        date: t.date,
                        value: Number((t.weight / weightRecord.weight).toFixed(2)),
                        playerId: t.playerId
                    });
                }
            });
            const aggRatio = aggregateData(ratioPoints, period, 'value');
            ratioChartInstance.data.labels = aggRatio.map(d => d.date.substring(5));
            ratioChartInstance.data.datasets[0].data = aggRatio.map(d => d.value);
            ratioChartInstance.update();
        }
    }

    function updateDashboardStats(data) {
        const { allWeights, allStats, allTraining } = data;
        const currentTrainingType = document.getElementById('training-chart-type')?.value || 'スクワット';

        // Reset
        const ids = ['dash-weight', 'dash-speed', 'dash-squat', 'dash-throw', 'dash-ratio'];
        ids.forEach(id => document.getElementById(id).textContent = '--');
        const trendIds = ['dash-weight-trend', 'dash-speed-trend', 'dash-squat-trend', 'dash-throw-trend', 'dash-ratio-trend'];
        trendIds.forEach(id => document.getElementById(id).innerHTML = '<i class="fa-solid fa-minus"></i> データなし');

        const lastWeight = getLatestVal(allWeights, 'weight');
        if (lastWeight !== null) {
            document.getElementById('dash-weight').textContent = lastWeight.toFixed(1);
            const sortedWeights = [...allWeights].sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sortedWeights.length > 1) {
                const lastDate = sortedWeights[sortedWeights.length - 1].date;
                const prevRecords = sortedWeights.filter(r => r.date < lastDate);
                if (prevRecords.length > 0) {
                    const prevWeight = getLatestVal(prevRecords, 'weight');
                    const diff = (lastWeight - prevWeight).toFixed(1);
                    const tEl = document.getElementById('dash-weight-trend');
                    tEl.className = `trend ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'}`;
                    tEl.innerHTML = `<i class="fa-solid ${diff > 0 ? 'fa-arrow-up' : diff < 0 ? 'fa-arrow-down' : 'fa-minus'}"></i> ${diff > 0 ? '+':''}${diff}kg`;
                }
            }
        }

        const speedEntries = allStats.filter(s => s.type === '球速 (km/h)');
        if (speedEntries.length > 0) {
            document.getElementById('dash-speed').textContent = Math.max(...speedEntries.map(s => s.value));
            document.getElementById('dash-speed-trend').innerHTML = '<i class="fa-solid fa-fire"></i> 自己最高';
        }

        const squatEntries = allTraining.filter(s => s.type === 'スクワット');
        if (squatEntries.length > 0) {
            document.getElementById('dash-squat').textContent = Math.max(...squatEntries.map(s => s.weight));
            document.getElementById('dash-squat-trend').innerHTML = '<i class="fa-solid fa-dumbbell"></i> 自己最高';
        }

        const throwEntries = allStats.filter(s => s.type === '遠投 (m)');
        if (throwEntries.length > 0) {
            document.getElementById('dash-throw').textContent = Math.max(...throwEntries.map(s => s.value));
            document.getElementById('dash-throw-trend').innerHTML = '<i class="fa-solid fa-baseball-bat-ball"></i> 自己最高';
        }

        const specificTrainingEntries = allTraining.filter(s => s.type === currentTrainingType);
        const lastLift = getLatestVal(specificTrainingEntries, 'weight');
        if (lastLift !== null && lastWeight !== null && lastWeight > 0) {
            document.getElementById('dash-ratio').textContent = (lastLift / lastWeight).toFixed(2);
            document.getElementById('dash-ratio-trend').innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${currentTrainingType}基準`;
        }
    }

    async function updateDashboardComments(role, currentUserId) {
        const commentsContainer = document.getElementById('dashboard-comments');
        const historyArea = document.getElementById('comments-history-area');
        const currentUid = window.fbAuth.currentUser?.uid;

        if (!commentsContainer || !historyArea) return;

        // Hide old history area as we now have chat
        historyArea.style.display = 'none';

        if (role === 'player' && currentUserId && currentUid) {
            const allComments = await window.fbGetComments(currentUserId);
            const unread = allComments.filter(c => c.senderId !== currentUid && !c.isRead);
            
            if (unread.length > 0) {
                const latest = unread[0];
                commentsContainer.innerHTML = `
                    <div class="glass" style="border-left: 4px solid var(--accent-orange); padding: 16px; margin-bottom: 12px; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span style="font-weight: bold; color: var(--accent-orange);"><i class="fa-solid fa-circle-exclamation"></i> 新着メッセージがあります</span>
                            <span style="font-size: 0.82rem; color: var(--text-secondary);">${unread.length}件の未読</span>
                        </div>
                        <p style="margin: 0 0 12px 0; font-size: 0.95rem; opacity: 0.8;">${latest.senderName}: "${latest.content.substring(0, 30)}${latest.content.length > 30 ? '...' : ''}"</p>
                        <div style="display: flex; justify-content: flex-end;">
                            <button class="btn-primary" style="font-size: 0.75rem; padding: 6px 12px;" onclick="window.openChatModal('${currentUserId}', 'マスターとのチャット')">
                                <i class="fa-solid fa-comments"></i> チャットを開く
                            </button>
                        </div>
                    </div>
                `;
                commentsContainer.style.display = 'block';
            } else {
                commentsContainer.style.display = 'none';
            }
        } else {
            commentsContainer.style.display = 'none';
        }
        
        // Initial badge update
        updateUnreadCount();
    }

    // Dynamic Dashboard Update Function
    async function updateDashboard() {
        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');
        if (role === 'player' && !currentUserId) return;

        // 1. Get current filters
        const filters = getDashboardFilters(role, currentUserId);

        // 2. Load data based on filters
        const dbQueryId = (role === 'master' && filters.playerId === 'all') ? null : filters.playerId;
        const [allWeights, allStats, allTraining, players] = await Promise.all([
            window.fbGetRecords('weightRecords', dbQueryId),
            window.fbGetRecords('statsRecords', dbQueryId),
            window.fbGetRecords('trainingRecords', dbQueryId),
            window.fbGetPlayers()
        ]);

        // 3. Apply high-level criteria (Inclusion/Exclusion)
        const filteredData = applyDashboardCriteria(
            { allWeights, allStats, allTraining },
            players,
            filters,
            role
        );

        // 4. Update UI Components
        updateDashboardCharts(filteredData, filters);
        updateDashboardStats(filteredData);
        await updateDashboardComments(role, currentUserId);
    }

    // Global action for read status
    window.markAsRead = async function(commentId) {
        try {
            await window.fbUpdateComment(commentId, { isRead: true });
            await updateDashboard();
        } catch (e) {
            console.error("Failed to mark as read:", e);
        }
    };



    // ---------- Form Submission Helpers ----------

    /**
     * Generic handler for form submissions to reduce boilerplate
     */
    async function handleFormSubmit(formId, storeKey, recordConstructor, successMessage) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentUserId = localStorage.getItem('currentPlayerId');
            if (!currentUserId) {
                alert('先に左のメニューかログイン画面から選手を選択してください。');
                return;
            }

            try {
                const record = {
                    playerId: currentUserId,
                    ...recordConstructor(),
                    createdAt: new Date().toISOString()
                };

                await window.fbAddRecord(storeKey, record);
                alert(successMessage);
                form.reset();
                
                // Reset date inputs to today
                const dateInput = form.querySelector('input[type="date"]');
                if (dateInput) dateInput.valueAsDate = new Date();
                
                // Form-specific resets
                if (formId === 'training-form') {
                    const setsInput = document.getElementById('train-sets');
                    if (setsInput) setsInput.value = 3;
                    const memoGroup = document.getElementById('train-other-memo-group');
                    if (memoGroup) memoGroup.style.display = 'none';
                }
                if (formId === 'stats-form') {
                    const memoGroup = document.getElementById('stat-other-memo-group');
                    if (memoGroup) memoGroup.style.display = 'none';
                }

                await updateDashboard();
                await renderHistory();
            } catch (err) {
                console.error(`Form submission failed for ${formId}:`, err);
                alert('保存に失敗しました。');
            }
        });

        // Initialize date input to today
        const dateInput = form.querySelector('input[type="date"]');
        if (dateInput && !dateInput.value) {
            dateInput.valueAsDate = new Date();
        }
    }

    // Initialize Forms
    handleFormSubmit('weight-form', 'weightRecords', () => ({
        date: document.getElementById('weight-date').value,
        time: document.getElementById('weight-time').value,
        weight: parseFloat(document.getElementById('weight-val').value),
        bodyFat: parseFloat(document.getElementById('bodyfat-val').value) || null,
        memo: document.getElementById('weight-memo').value
    }), '体重記録を保存しました！');

    handleFormSubmit('training-form', 'trainingRecords', () => ({
        date: document.getElementById('train-date').value,
        type: document.getElementById('train-type').value,
        weight: parseFloat(document.getElementById('train-weight').value),
        reps: parseInt(document.getElementById('train-reps').value),
        sets: parseInt(document.getElementById('train-sets').value),
        otherMemo: document.getElementById('train-type').value === 'その他'
            ? document.getElementById('train-other-memo').value
            : ''
    }), 'トレーニング記録を保存しました！');

    handleFormSubmit('stats-form', 'statsRecords', () => ({
        date: document.getElementById('stat-date').value,
        type: document.getElementById('stat-type').value,
        value: parseFloat(document.getElementById('stat-val').value),
        otherMemo: document.getElementById('stat-type').value === 'その他'
            ? document.getElementById('stat-other-memo').value
            : ''
    }), '野球指標を保存しました！');

    // Add Record Button Animation
    const addBtn = document.getElementById('add-record-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            alert('新規記録モーダルを開きます (機能実装予定)');
        });
    }

    // ---------- Role Management ----------
    function setRole(role) {
        localStorage.setItem('userRole', role);
        applyRoleVisibility();
    }

    function applyRoleVisibility() {
        const role = localStorage.getItem('userRole') || 'player';
        const playerForm = document.getElementById('player-form');
        const exportCsvBtn = document.getElementById('export-csv-btn');
        const headerLoginBtn = document.getElementById('header-login-btn');
        const headerLogoutBtn = document.getElementById('header-logout-btn');
        const masterFilters = document.getElementById('master-dash-filters');
        
        const currentPlayerId = localStorage.getItem('currentPlayerId');
        
        console.log("Applying visibility for role:", role);

        // Header Buttons
        if (role === 'master' || currentPlayerId) {
            if (headerLoginBtn) headerLoginBtn.style.display = 'none';
            if (headerLogoutBtn) headerLogoutBtn.style.display = 'inline-block';
        } else {
            if (headerLoginBtn) headerLoginBtn.style.display = 'inline-block';
            if (headerLogoutBtn) headerLogoutBtn.style.display = 'none';
        }

        // Master-only elements
        if (role === 'master') {
            if (masterFilters) masterFilters.style.display = 'block';
            if (exportCsvBtn) exportCsvBtn.style.display = 'inline-block';
            document.querySelectorAll('.master-only').forEach(el => el.style.display = 'block');
            
            // Populate player filter if not already done
            loadPlayersForFilter();
        } else {
            if (masterFilters) masterFilters.style.display = 'none';
            if (exportCsvBtn) exportCsvBtn.style.display = 'none';
            document.querySelectorAll('.master-only').forEach(el => el.style.display = 'none');
        }

        // Sidebar Profile
        updateSidebarProfile();
    }

    let isFilterLoading = false;
    // Global cache for player list to enable name search
    let allPlayersCache = [];
    async function loadPlayersForFilter() {
        const playerSelect = document.getElementById('dash-filter-player');
        const excludeSelect = document.getElementById('dash-exclude-player');
        if (!playerSelect || isFilterLoading) return;
        
        isFilterLoading = true;
        try {
            const players = await window.fbGetPlayers();
            if (!players || players.length === 0) return;

            // 1. Deduplicate by Name & Grade (Safety for DB mess)
            const uniqueMap = new Map();
            players.forEach(p => {
                const key = `${p.name}-${p.grade}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, p);
            });
            const uniquePlayers = Array.from(uniqueMap.values());

            // 2. Sort
            uniquePlayers.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            
            // 3. Atomic Rebuild - Main Filter
            let html = '<option value="all">全選手 (平均値表示)</option>';
            uniquePlayers.forEach(p => {
                html += `<option value="${p.id}">${p.name} (${p.grade})</option>`;
            });
            playerSelect.innerHTML = html;
            // Cache players for name search
            allPlayersCache = uniquePlayers;
            const nameSearchInput = document.getElementById('dash-filter-player-search');
            if (nameSearchInput) {
                nameSearchInput.addEventListener('input', () => {
                    const term = nameSearchInput.value.trim().toLowerCase();
                    let filtered = allPlayersCache;
                    if (term) {
                        filtered = allPlayersCache.filter(p => p.name.toLowerCase().includes(term));
                    }
                    let newHtml = '<option value="all">全選手 (平均値表示)</option>';
                    filtered.forEach(p => {
                        newHtml += `<option value="${p.id}">${p.name} (${p.grade})</option>`;
                    });
                    playerSelect.innerHTML = newHtml;
                });
            }

            // 4. Atomic Rebuild - Exclusion Filter
            if (excludeSelect) {
                let exHtml = '<option value="none">なし</option>';
                uniquePlayers.forEach(p => {
                    exHtml += `<option value="${p.id}">${p.name} (${p.grade})</option>`;
                });
                excludeSelect.innerHTML = exHtml;
            }
        } finally {
            isFilterLoading = false;
        }
    }

    // Init with existing role or default to player
    if (!localStorage.getItem('userRole')) {
        setRole('player');
    } else {
        applyRoleVisibility();
    }
    // Ensure name search field is cleared on load
    const nameSearch = document.getElementById('dash-filter-player-search');
    if (nameSearch) nameSearch.value = '';

    // ---------- Player Management ----------
    const playerForm = document.getElementById('player-form');
    const playerListEl = document.getElementById('player-list');

    async function loadPlayers() {
        if (!window.fbGetPlayers) return [];
        try {
            return await window.fbGetPlayers();
        } catch (err) {
            console.warn("Failed to load players from Firestore:", err);
            return [];
        }
    }

    async function savePlayers(players) {
        // Obsolete in FB - we add/update individually
    }

    async function renderPlayerList() {
        const players = await loadPlayers();
        const role = localStorage.getItem('userRole');
        const currentUserId = localStorage.getItem('currentPlayerId');
        const currentUid = window.fbAuth?.currentUser?.uid;

        // Show only non-master players in the player list, masters shown with badge
        playerListEl.innerHTML = players.map(p => {
            const isOwner = p.id == currentUserId;
            const canEdit = role === 'master' || isOwner;
            const isMe = p.id === currentUid;
            const playerRole = p.role || 'player';

            return `
                <li class="player-item" data-id="${p.id}">
                    <div style="display:flex; align-items:center; gap: 8px; flex-wrap: wrap;">
                        <span class="badge ${playerRole === 'master' ? 'bg-orange' : 'bg-blue'} w-auto">${playerRole === 'master' ? '管理者' : p.grade || '未設定'}</span>
                        <span>${p.name} - ${p.position || '-'} - #${p.number || '-'}</span>
                    </div>
                    <div style="display:flex; gap: 8px; align-items: center;">
                        ${role === 'master' ? `
                            <select class="role-select" data-uid="${p.id}"
                                style="font-size:0.75rem; padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); color: var(--text-primary); cursor: ${isMe ? 'not-allowed' : 'pointer'}; opacity: ${isMe ? '0.5' : '1'};"
                                ${isMe ? 'disabled title="自分自身のロールは変更できません"' : ''}>
                                <option value="player" ${playerRole !== 'master' ? 'selected' : ''}>選手</option>
                                <option value="master" ${playerRole === 'master' ? 'selected' : ''}>管理者</option>
                            </select>
                            <button class="btn-outline action-msg" data-id="${p.id}" data-name="${p.name}" style="color: #3b82f6; border-color: #3b82f6;">
                                <i class="fa-solid fa-envelope"></i>
                            </button>
                        ` : ''}
                        ${canEdit ? `
                            <button class="btn-outline action-edit" data-id="${p.id}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                        ` : ''}
                        ${role === 'master' ? `
                            <button class="btn-outline action-delete" data-id="${p.id}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </li>
            `;
        }).join('');
    }

    // Event Delegation for Player List Actions (click)
    playerListEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const id = btn.dataset.id;
        const name = btn.dataset.name;

        if (btn.classList.contains('action-msg')) {
            window.openChatModal(id, name);
        } else if (btn.classList.contains('action-edit')) {
            editPlayer(id);
        } else if (btn.classList.contains('action-delete')) {
            deletePlayer(id);
        }
    });

    // Event Delegation for Role Select (change)
    playerListEl.addEventListener('change', async (e) => {
        if (!e.target.classList.contains('role-select')) return;

        const uid = e.target.dataset.uid;
        const newRole = e.target.value;
        const label = newRole === 'master' ? '管理者' : '選手';

        if (!confirm(`このユーザーのロールを「${label}」に変更しますか？`)) {
            await renderPlayerList(); // revert UI
            return;
        }

        try {
            await window.fbUpdatePlayerRole(uid, newRole);
            alert('ロールを変更しました。');
            await renderPlayerList();
        } catch (err) {
            alert('ロール変更に失敗しました: ' + err.message);
            await renderPlayerList();
        }
    });

    async function addPlayer(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const name = document.getElementById('player-name').value.trim();
            const grade = document.getElementById('player-grade').value;
            const position = document.getElementById('player-position').value.trim();
            const number = document.getElementById('player-number').value;
            if (!name || !position || !number) return;
            
            const players = await loadPlayers();
            if (players.some(p => p.name === name && p.number === number)) {
                alert('既に同じ名前・背番号の選手が登録されています。');
                return;
            }

            const newPlayer = { name, grade, position, number, createdAt: new Date().toISOString() };
            await window.fbAddPlayer(newPlayer);
            
            await renderPlayerList();
            e.target.reset();
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    async function deletePlayer(id) {
        if (!confirm('本当に削除しますか？')) return;
        await window.fbDeletePlayer(id);
        await renderPlayerList();
    }

    if (playerForm) {
        playerForm.addEventListener('submit', addPlayer);
    }

    // ---------- Player Authentication (Cloud ID Logic) ----------
    const playerAuthModal = document.getElementById('player-auth-modal');
    const authPlayerSelect = document.getElementById('auth-player-select');
    const authLoginView = document.getElementById('auth-login-view');
    const authRegisterView = document.getElementById('auth-register-view');
    const authMasterView = document.getElementById('auth-master-view');
    const authMasterRegisterView = document.getElementById('auth-master-register-view');

    async function showAuthModal() {
        console.log("showAuthModal() called");
        const debugStatus = document.getElementById('debug-status');
        if (debugStatus) debugStatus.textContent = "Modal Opened";
        
        if (!playerAuthModal) {
            console.error("playerAuthModal is missing!");
            return;
        }
        playerAuthModal.style.setProperty('display', 'flex', 'important');
        playerAuthModal.style.opacity = '1';
        playerAuthModal.style.zIndex = '9999';
        // Ensure default view is player login
        authLoginView.style.display = 'block';
        authRegisterView.style.display = 'none';
        authMasterView.style.display = 'none';
        if (authMasterRegisterView) authMasterRegisterView.style.display = 'none';
        
        // Populate select list
        try {
            const players = await loadPlayers();
            
            // Deduplicate for UI
            const uniqueMap = new Map();
            players.forEach(p => {
                const key = `${p.name}-${p.grade}-${p.number}`;
                if (!uniqueMap.has(key)) uniqueMap.set(key, p);
            });
            const uniquePlayers = Array.from(uniqueMap.values());
            uniquePlayers.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

            let html = '<option value="">-- 選択してください --</option>';
            uniquePlayers.forEach(p => {
                const roleLabel = p.role === 'master' ? '管理者' : (p.position || '-');
                html += `<option value="${p.id}">${p.name} (${roleLabel} / #${p.number || '-'})</option>`;
            });
            authPlayerSelect.innerHTML = html;
        } catch (err) {
            console.error("showAuthModal failed to load players:", err);
            authPlayerSelect.innerHTML = '<option value="">選手リストの読み込みに失敗しました</option>';
        }
    }

    function applyThemeColor(colorName) {
        const root = document.documentElement;
        if (colorName === 'orange') {
            root.style.setProperty('--accent-blue', '#f97316');
            root.style.setProperty('--accent-blue-glow', 'rgba(249, 115, 22, 0.4)');
        } else if (colorName === 'green') {
            root.style.setProperty('--accent-blue', '#10b981');
            root.style.setProperty('--accent-blue-glow', 'rgba(16, 185, 129, 0.4)');
        } else if (colorName === 'purple') {
            root.style.setProperty('--accent-blue', '#8b5cf6');
            root.style.setProperty('--accent-blue-glow', 'rgba(139, 92, 246, 0.4)');
        } else if (colorName === 'red') {
            root.style.setProperty('--accent-blue', '#ef4444');
            root.style.setProperty('--accent-blue-glow', 'rgba(239, 68, 68, 0.4)');
        } else {
            root.style.setProperty('--accent-blue', '#3b82f6');
            root.style.setProperty('--accent-blue-glow', 'rgba(59, 130, 246, 0.4)');
        }
    }

    async function updateSidebarProfile() {
        const role = localStorage.getItem('userRole') || 'player';
        const profileName = document.getElementById('profile-name');
        const profileDetail = document.getElementById('profile-detail');
        const profileAvatar = document.getElementById('profile-avatar');
        
        if (!profileName || !profileDetail || !profileAvatar) return;

        if (role === 'master') {
            profileName.textContent = 'マスター（管理者）';
            profileDetail.textContent = '選手管理・全データ閲覧';
            profileAvatar.src = 'https://api.dicebear.com/6.x/bottts/svg?seed=Master&backgroundColor=transparent';
            applyThemeColor('orange');
        } else {
            const currentUserId = localStorage.getItem('currentPlayerId');
            if (currentUserId) {
                const players = await loadPlayers();
                const currentPlayer = players.find(p => p.id == currentUserId);
                
                if (currentPlayer) {
                    profileName.textContent = currentPlayer.name;
                    profileDetail.textContent = currentPlayer.goal ? currentPlayer.goal : `${currentPlayer.position} / No. ${currentPlayer.number}`;
                    
                    const style = currentPlayer.avatarStyle || 'avataaars';
                    const seed = currentPlayer.avatarSeed || currentPlayer.id;
                    if (style === 'custom' && currentPlayer.avatarDataUrl) {
                        profileAvatar.src = currentPlayer.avatarDataUrl;
                    } else {
                        profileAvatar.src = `https://api.dicebear.com/6.x/${style === 'custom' ? 'bottts' : style}/svg?seed=${seed}&backgroundColor=transparent`;
                    }
                    
                    applyThemeColor(currentPlayer.themeColor || 'blue');
                } else {
                    profileName.textContent = 'ゲスト';
                    profileDetail.textContent = '選手データが見つかりません';
                    profileAvatar.src = 'https://api.dicebear.com/6.x/avataaars/svg?seed=Guest&backgroundColor=transparent';
                    applyThemeColor('blue');
                }
            } else {
                profileName.textContent = 'ゲスト';
                profileDetail.textContent = '未ログイン（ログインしてください）';
                profileAvatar.src = 'https://api.dicebear.com/6.x/avataaars/svg?seed=Guest&backgroundColor=transparent';
                applyThemeColor('blue');
            }
        }
        applyRoleVisibility();
    }

    // Simplified navigation within auth modal
    function initAuthNavListeners() {
        const views = {
            login: authLoginView,
            register: authRegisterView,
            master: authMasterView,
            masterReg: authMasterRegisterView
        };

        function showView(viewName) {
            Object.values(views).forEach(v => v && (v.style.display = 'none'));
            if (views[viewName]) views[viewName].style.display = 'block';
        }

        document.getElementById('link-register')?.addEventListener('click', (e) => { e.preventDefault(); showView('register'); });
        document.getElementById('link-login')?.addEventListener('click', (e) => { e.preventDefault(); showView('login'); });
        document.getElementById('link-master')?.addEventListener('click', (e) => { e.preventDefault(); showView('master'); });
        document.getElementById('link-login-from-master')?.addEventListener('click', (e) => { e.preventDefault(); showView('login'); });
        document.getElementById('link-register-master')?.addEventListener('click', (e) => { e.preventDefault(); showView('masterReg'); });
        document.getElementById('link-login-from-master-reg')?.addEventListener('click', (e) => { e.preventDefault(); showView('master'); });
    }

    initAuthNavListeners();

    // [Deprecated] Master-specific login button - kept as no-op for safety
    document.getElementById('btn-master-login')?.addEventListener('click', async () => {
        alert('この機能は廃止されました。ドロップダウンから通常ログインしてください。');
    });

    document.getElementById('btn-register-master')?.addEventListener('click', async () => {
        const invite = document.getElementById('reg-master-invite').value;
        const id = document.getElementById('reg-master-id').value.trim();
        const name = document.getElementById('reg-master-name').value.trim();
        const pass = document.getElementById('reg-master-password').value;

        if (!invite || !id || !name || !pass) {
            alert('すべての項目を入力してください。');
            return;
        }

        // Hardcoded generic invite code check to prevent unauthorized creation
        if (invite !== 'admin2026') {
            alert('招待コードが間違っているため、マスターアカウントを作成できません。');
            return;
        }

        // Basic ID validation
        if (!/^[a-zA-Z0-9_]+$/.test(id)) {
            alert('マスターIDは半角英数字とアンダースコアのみ使用可能です。');
            return;
        }

        try {
            const masterData = await window.fbRegisterMaster(id, name, pass);
            setRole('master');
            localStorage.setItem('masterId', masterData.masterId);
            localStorage.setItem('masterName', masterData.name);
            playerAuthModal.style.display = 'none';
            await initializeAppState();
            alert(`マスターアカウント「${name}」を作成し、ログインしました！`);
        } catch (err) {
            alert('登録に失敗しました: ' + err.message);
        }
    });

    document.getElementById('btn-login')?.addEventListener('click', async () => {
        const selectedId = authPlayerSelect.value;
        const password = document.getElementById('auth-player-password').value;
        
        if (!selectedId || !password) {
            alert('ユーザーを選択し、パスワードを入力してください');
            return;
        }

        const btn = document.getElementById('btn-login');
        btn.disabled = true;
        btn.textContent = 'ログイン中...';

        try {
            // Unified login: works for both players and masters
            const userData = await window.fbLoginUnified(selectedId, password);
            const role = userData.role || 'player';

            setRole(role);
            localStorage.setItem('currentPlayerId', userData.uid);
            if (role === 'master') {
                localStorage.setItem('masterName', userData.name || 'マスター');
            }

            playerAuthModal.style.display = 'none';
            await initializeAppState();

            const greeting = role === 'master'
                ? `${userData.name || 'マスター'}さん、管理者としてログインしました`
                : 'ログインしました';
            alert(greeting);
        } catch (err) {
            alert('ログインに失敗しました: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'ログイン';
        }
    });

    document.getElementById('btn-register')?.addEventListener('click', async (e) => {
        const btn = e.target;
        
        try {
            const name = document.getElementById('reg-name').value.trim();
            const grade = document.getElementById('reg-grade').value;
            const position = document.getElementById('reg-position').value.trim();
            const number = document.getElementById('reg-number').value;
            const pass = document.getElementById('reg-password').value;
            const passConfirm = document.getElementById('reg-password-confirm').value;

            if (!name || !position || !number || !pass) {
                alert('すべての項目を入力してください');
                return;
            }

            if (pass.length < 6) {
                alert('パスワードは6文字以上で設定してください');
                return;
            }

            if (pass !== passConfirm) {
                alert('パスワードが一致しません');
                return;
            }

            btn.disabled = true;

            const players = await loadPlayers();
            if (players.some(p => p.name === name && p.number === number)) {
                alert('既に同じ名前・背番号の選手が登録されています。ログイン画面から選択してください。');
                btn.disabled = false;
                return;
            }

            const newPlayer = { name, grade, position, number };
            console.log("Registering player:", newPlayer);
            const newId = await window.fbAddPlayer(newPlayer, pass);
            
            localStorage.setItem('currentPlayerId', newId);
            playerAuthModal.style.display = 'none';
            
            await initializeAppState(); 
            alert(`登録が完了しました！\nログインID: ${newId}\n\n次回からはこのIDまたは選択メニューからログインしてください。`);
        } catch (e) {
            console.error("Error adding player:", e);
            alert("登録に失敗しました: " + e.message);
        } finally {
            btn.disabled = false;
        }
    });

    // ---------- Edit Player Logic ----------
    window.editPlayer = async function(id) {
        const players = await loadPlayers();
        const p = players.find(x => x.id == id);
        if (!p) return;

        document.getElementById('edit-player-id').value = p.id;
        document.getElementById('edit-player-name').value = p.name;
        document.getElementById('edit-player-grade').value = p.grade || '大1';
        document.getElementById('edit-player-position').value = p.position;
        document.getElementById('edit-player-number').value = p.number;

        const pwdContainer = document.getElementById('edit-player-password-container');
        if (pwdContainer) {
            pwdContainer.style.display = 'block';
            document.getElementById('edit-player-password-view').value = p.plainPassword || '未設定（再設定が必要です）';
        }

        document.getElementById('edit-player-modal').style.display = 'flex';
    };

    document.getElementById('btn-cancel-player-edit')?.addEventListener('click', () => {
        document.getElementById('edit-player-modal').style.display = 'none';
    });

    document.getElementById('edit-player-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-player-id').value;
        const updatedData = {
            name: document.getElementById('edit-player-name').value.trim(),
            grade: document.getElementById('edit-player-grade').value,
            position: document.getElementById('edit-player-position').value.trim(),
            number: document.getElementById('edit-player-number').value,
            updatedAt: new Date().toISOString()
        };
        
        await window.fbUpdatePlayer(id, updatedData);
        await renderPlayerList();
        await updateSidebarProfile();
            
        document.getElementById('edit-player-modal').style.display = 'none';
        alert('選手情報を更新しました');
    });

    window.deletePlayer = async function(id) {
        if (confirm('本当にこの選手を削除しますか？\n(紐づいている記録もすべて消える場合があります)')) {
            await window.fbDeleteRecord('players', id);
            await renderPlayerList();
            
            // If the deleted player is the currently logged in one, reset
            if (localStorage.getItem('currentPlayerId') == id) {
                localStorage.removeItem('currentPlayerId');
                await initializeAppState();
            }
        }
    }

    // ---------- Chat System Logic ----------
    const chatModal = document.getElementById('chat-modal-overlay');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input-text');
    const notificationBtn = document.getElementById('notification-btn');
    const unreadBadge = document.getElementById('unread-badge');

    // Open chat for a specific player (Master side) or for self (Player side)
    window.openChatModal = async function(playerId, playerName) {
        activeChatPlayerId = playerId;
        document.getElementById('chat-target-name').textContent = playerName || 'チャット';
        chatModal.style.display = 'flex';
        chatMessagesContainer.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5;">読み込み中...</div>';
        
        // Start real-time listener
        if (currentChatListener) currentChatListener();
        currentChatListener = window.fbListenToComments(playerId, (messages) => {
            renderChatMessages(messages);
            markMessagesAsRead(messages, playerId);
        });
    }

    function renderChatMessages(messages) {
        const role = localStorage.getItem('userRole');
        const currentUid = window.fbAuth.currentUser?.uid;

        chatMessagesContainer.innerHTML = messages.map(msg => {
            // Determine if sent by current user
            const isMe = msg.senderId === currentUid;
            const time = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="chat-bubble ${isMe ? 'sent' : 'received'}">
                    <div class="chat-sender" style="font-size: 0.65rem; margin-bottom: 2px; opacity: 0.8;">
                        ${isMe ? 'あなた' : msg.senderName}
                    </div>
                    ${msg.content}
                    <div class="chat-info">
                        ${time} ${!isMe && msg.isRead ? '<span style="color:var(--accent-green);"><i class="fa-solid fa-check-double"></i> 既読</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    async function markMessagesAsRead(messages, playerId) {
        const currentUid = window.fbAuth.currentUser?.uid;
        const unreadForMe = messages.filter(m => m.senderId !== currentUid && !m.isRead);
        
        for (const msg of unreadForMe) {
            await window.fbUpdateComment(msg.id, { isRead: true });
        }
        updateUnreadCount();
    }

    chatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = chatInput.value.trim();
        if (!content || !activeChatPlayerId) return;

        const role = localStorage.getItem('userRole');
        const user = window.fbAuth.currentUser;
        if (!user) return;

        let senderName = 'ユーザー';
        if (role === 'master') {
            senderName = localStorage.getItem('masterName') || 'マスター';
        } else {
            const players = await loadPlayers();
            const p = players.find(x => x.id == activeChatPlayerId);
            senderName = p ? p.name : '選手';
        }

        try {
            await window.fbAddComment(activeChatPlayerId, senderName, user.uid, content);
            chatInput.value = '';
        } catch (err) {
            console.error("Chat send failed:", err);
            alert("送信に失敗しました");
        }
    });

    document.getElementById('btn-close-chat')?.addEventListener('click', () => {
        chatModal.style.display = 'none';
        activeChatPlayerId = null;
        if (currentChatListener) {
            currentChatListener();
            currentChatListener = null;
        }
    });

    // Notification Badge Update logic
    async function updateUnreadCount() {
        const role = localStorage.getItem('userRole');
        const currentUserId = role === 'player' ? localStorage.getItem('currentPlayerId') : null;
        const currentUid = window.fbAuth.currentUser?.uid;

        if (!currentUid) return;

        try {
            // For Players, they only care about messages in their own collection
            if (role === 'player' && currentUserId) {
                const comments = await window.fbGetComments(currentUserId);
                const unreadCount = comments.filter(c => c.senderId !== currentUid && !c.isRead).length;
                
                if (unreadCount > 0) {
                    unreadBadge.textContent = unreadCount;
                    unreadBadge.style.display = 'flex';
                } else {
                    unreadBadge.style.display = 'none';
                }
                notificationBtn.style.display = 'block';
            } else if (role === 'master') {
                // For Masters, they might care about ANY unread message from ANY player
                // This is a bit heavy, but let's do a basic global fetch for now
                const snapshot = await window.fbDb.collection('comments').where("isRead", "==", false).get();
                let unreadCount = 0;
                snapshot.forEach(doc => {
                    if (doc.data().senderId !== currentUid) unreadCount++;
                });

                if (unreadCount > 0) {
                    unreadBadge.textContent = unreadCount;
                    unreadBadge.style.display = 'flex';
                } else {
                    unreadBadge.style.display = 'none';
                }
                notificationBtn.style.display = 'block';
            }
        } catch (e) {
            console.error("Unread count check failed:", e);
        }
    }

    notificationBtn?.addEventListener('click', () => {
        const role = localStorage.getItem('userRole');
        // Switch to chat tab
        const chatNavItem = document.querySelector('[data-tab="chat"]');
        if (chatNavItem) {
            chatNavItem.click();
        } else {
            // Fallback for mobile if data-tab="chat" is on a different element
            const mobileChatLink = document.querySelector('.mobile-nav [data-tab="chat"]');
            mobileChatLink?.click();
        }

        if (role === 'player') {
            const pid = localStorage.getItem('currentPlayerId');
            startPaneChat(pid);
        } else {
            // Master logic: show the chat pane and let them select a player
            initChatPane();
            alert("選手を選択してチャットを開始してください。");
        }
    });


    // ---------- Chat Pane Logic (Full Page Chat) ----------
    const chatPane = document.getElementById('chat-pane');
    const paneChatMessages = document.getElementById('pane-chat-messages');
    const paneChatForm = document.getElementById('pane-chat-form');
    const paneChatInput = document.getElementById('pane-chat-input');
    const chatPlayerSelect = document.getElementById('chat-player-select');
    const masterChatSelector = document.getElementById('master-chat-selector');
    let paneChatListener = null;
    let activePanePlayerId = null;

    async function initChatPane() {
        const role = localStorage.getItem('userRole');
        const currentUserId = localStorage.getItem('currentPlayerId');

        if (role === 'master') {
            if (masterChatSelector) masterChatSelector.style.display = 'block';
            await populateChatPlayerSelect();
            
            // If already selecting someone, reload their chat
            if (activePanePlayerId) {
                startPaneChat(activePanePlayerId);
            }
        } else {
            if (masterChatSelector) masterChatSelector.style.display = 'none';
            if (currentUserId) {
                startPaneChat(currentUserId);
            }
        }
    }

    async function populateChatPlayerSelect() {
        if (!chatPlayerSelect) return;
        const players = await loadPlayers();
        const currentSelection = chatPlayerSelect.value;
        chatPlayerSelect.innerHTML = '<option value="">選手を選択...</option>' + 
            players.map(p => `<option value="${p.id}" ${p.id == currentSelection ? 'selected' : ''}>${p.name}</option>`).join('');
    }

    chatPlayerSelect?.addEventListener('change', (e) => {
        const pid = e.target.value;
        if (pid) {
            startPaneChat(pid);
        } else {
            if (paneChatMessages) paneChatMessages.innerHTML = '<div style="text-align: center; margin-top: 50px; opacity: 0.5;">チャットを選択してください</div>';
            activePanePlayerId = null;
            if (paneChatListener) paneChatListener();
        }
    });

    function startPaneChat(playerId) {
        activePanePlayerId = playerId;
        if (paneChatMessages) paneChatMessages.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5;">読み込み中...</div>';
        
        if (paneChatListener) paneChatListener();
        paneChatListener = window.fbListenToComments(playerId, (messages) => {
            renderPaneMessages(messages);
            markMessagesAsRead(messages, playerId);
        });
    }

    function renderPaneMessages(messages) {
        if (!paneChatMessages) return;
        const currentUid = window.fbAuth.currentUser?.uid;
        paneChatMessages.innerHTML = messages.map(msg => {
            const isMe = msg.senderId === currentUid;
            const time = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="chat-bubble ${isMe ? 'sent' : 'received'}">
                    <div class="chat-sender" style="font-size: 0.65rem; margin-bottom: 2px; opacity: 0.8;">
                        ${isMe ? 'あなた' : msg.senderName}
                    </div>
                    ${msg.content}
                    <div class="chat-info">
                        ${time} ${!isMe && msg.isRead ? '<span style="color:var(--accent-green);"><i class="fa-solid fa-check-double"></i> 既読</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
        paneChatMessages.scrollTop = paneChatMessages.scrollHeight;
    }

    paneChatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!paneChatInput) return;
        const content = paneChatInput.value.trim();
        if (!content || !activePanePlayerId) return;

        const role = localStorage.getItem('userRole');
        const user = window.fbAuth.currentUser;
        if (!user) return;

        let senderName = 'ユーザー';
        if (role === 'master') {
            senderName = localStorage.getItem('masterName') || 'マスター';
        } else {
            const players = await loadPlayers();
            const p = players.find(x => x.id == activePanePlayerId);
            senderName = p ? p.name : '選手';
        }

        try {
            await window.fbAddComment(activePanePlayerId, senderName, user.uid, content);
            paneChatInput.value = '';
        } catch (err) {
            console.error("Pane Chat send failed:", err);
            alert("送信に失敗しました");
        }
    });

    // ---------- History Management ----------
    const histFilters = [
        document.getElementById('hist-filter-weight'),
        document.getElementById('hist-filter-training'),
        document.getElementById('hist-filter-stats')
    ];
    let currentHistType = 'weight';

    histFilters.forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            histFilters.forEach(b => b && b.classList.remove('active'));
            e.target.classList.add('active');
            if (e.target.id.includes('weight')) currentHistType = 'weight';
            if (e.target.id.includes('training')) currentHistType = 'training';
            if (e.target.id.includes('stats')) currentHistType = 'stats';
            renderHistory();
        });
    });

    // Make functions globally available for inline onclick
    window.editRecord = async function(type, id) {
        let storeKey = type === 'weight' ? 'weightRecords' : (type === 'training' ? 'trainingRecords' : 'statsRecords');
        
        // Fetch specific collecton for this user or all if master
        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');
        const queryId = role === 'master' ? null : currentUserId;
        
        let records = await window.fbGetRecords(storeKey, queryId);
        const rec = records.find(r => r.id == id);
        if (!rec) return;

        document.getElementById('edit-record-id').value = id;
        document.getElementById('edit-record-type').value = type;

        const container = document.getElementById('edit-fields-container');
        container.innerHTML = '';
        
        // For Master: Add Player Select Dropdown
        if (role === 'master') {
            const players = await loadPlayers();
            let playerOptions = '';
            players.forEach(p => {
                playerOptions += `<option value="${p.id}" ${rec.playerId === p.id ? 'selected' : ''}>${p.name}</option>`;
            });
            container.innerHTML += `
                <div class="form-group mb-3" style="background:var(--surface-color); padding:10px; border-radius:8px; border:1px solid var(--border-color);">
                    <label style="color:var(--accent-blue);"><i class="fa-solid fa-user-edit"></i> 記録の所有者を変更 (マスター専用)</label>
                    <select id="edit-record-player" class="w-100">
                        ${playerOptions}
                    </select>
                </div>
            `;
        }

        if (type === 'weight') {
            container.innerHTML += `
                <div class="form-group mb-3">
                    <label>日付</label>
                    <input type="date" id="edit-weight-date" value="${rec.date}" class="w-100" required>
                </div>
                <div class="form-group mb-3">
                    <label>体重 (kg)</label>
                    <input type="number" step="0.1" id="edit-weight-val" value="${rec.weight}" class="w-100" required>
                </div>
                <div class="form-group mb-3">
                    <label>体脂肪率 (%)</label>
                    <input type="number" step="0.1" id="edit-bodyfat-val" value="${rec.bodyFat || ''}" class="w-100">
                </div>
                <div class="form-group mb-3">
                    <label>メモ</label>
                    <input type="text" id="edit-weight-memo" value="${rec.memo || ''}" class="w-100">
                </div>
            `;
        } else if (type === 'training') {
            container.innerHTML += `
                <div class="form-group mb-3">
                    <label>日付</label>
                    <input type="date" id="edit-train-date" value="${rec.date}" class="w-100" required>
                </div>
                <div class="form-group mb-3">
                    <label>種目</label>
                    <select id="edit-train-type" class="w-100" required>
                        <option value="スクワット" ${rec.type === 'スクワット' ? 'selected' : ''}>スクワット</option>
                        <option value="ベンチプレス" ${rec.type === 'ベンチプレス' ? 'selected' : ''}>ベンチプレス</option>
                        <option value="ボックスジャンプ" ${rec.type === 'ボックスジャンプ' ? 'selected' : ''}>ボックスジャンプ</option>
                        <option value="10m走" ${rec.type === '10m走' ? 'selected' : ''}>10m走</option>
                        <option value="メディシンボールスロー(前)" ${rec.type === 'メディシンボールスロー(前)' ? 'selected' : ''}>メディシンボールスロー(前)</option>
                        <option value="メディシンボールスロー(後ろ)" ${rec.type === 'メディシンボールスロー(後ろ)' ? 'selected' : ''}>メディシンボールスロー(後ろ)</option>
                        <option value="メディシンボールスロー(プッシュ)" ${rec.type === 'メディシンボールスロー(プッシュ)' ? 'selected' : ''}>メディシンボールスロー(プッシュ)</option>
                        <option value="メディシンボールスロー(サイド)" ${rec.type === 'メディシンボールスロー(サイド)' ? 'selected' : ''}>メディシンボールスロー(サイド)</option>
                        <option value="立幅" ${rec.type === '立幅' ? 'selected' : ''}>立幅</option>
                        <option value="立ち三段" ${rec.type === '立ち三段' ? 'selected' : ''}>立ち三段</option>
                        <option value="クリーン" ${rec.type === 'クリーン' ? 'selected' : ''}>クリーン</option>
                        <option value="ペンタゴンクリーン" ${rec.type === 'ペンタゴンクリーン' ? 'selected' : ''}>ペンタゴンクリーン</option>
                        <option value="フロントスクワット" ${rec.type === 'フロントスクワット' ? 'selected' : ''}>フロントスクワット</option>
                        <option value="デッドリフト" ${rec.type === 'デッドリフト' ? 'selected' : ''}>デッドリフト</option>
                    </select>
                </div>
                <div class="form-group mb-3 row">
                    <div class="col">
                        <label>重量 (kg)</label>
                        <input type="number" step="0.5" id="edit-train-weight" value="${rec.weight}" class="w-100" required>
                    </div>
                    <div class="col">
                        <label>回数</label>
                        <input type="number" id="edit-train-reps" value="${rec.reps}" class="w-100" required>
                    </div>
                    <div class="col">
                        <label>セット</label>
                        <input type="number" id="edit-train-sets" value="${rec.sets}" class="w-100" required>
                    </div>
                </div>
            `;
        } else if (type === 'stats') {
            container.innerHTML += `
                <div class="form-group mb-3">
                    <label>日付</label>
                    <input type="date" id="edit-stat-date" value="${rec.date}" class="w-100" required>
                </div>
                <div class="form-group mb-3">
                    <label>項目</label>
                    <select id="edit-stat-type" class="w-100" required>
                        <option value="球速 (km/h)" ${rec.type === '球速 (km/h)' ? 'selected' : ''}>球速 (km/h)</option>
                        <option value="スイングスピード (km/h)" ${rec.type === 'スイングスピード (km/h)' ? 'selected' : ''}>スイングスピード (km/h)</option>
                        <option value="50m走 (秒)" ${rec.type === '50m走 (秒)' ? 'selected' : ''}>50m走 (秒)</option>
                        <option value="遠投 (m)" ${rec.type === '遠投 (m)' ? 'selected' : ''}>遠投 (m)</option>
                        <option value="回転数 (rpm)" ${rec.type === '回転数 (rpm)' ? 'selected' : ''}>回転数 (rpm)</option>
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label>記録数値</label>
                    <input type="number" step="0.01" id="edit-stat-val" value="${rec.value}" class="w-100" required>
                </div>
            `;
        }

        document.getElementById('edit-record-modal').style.display = 'flex';
    };

    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
        document.getElementById('edit-record-modal').style.display = 'none';
    });

    document.getElementById('edit-record-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-record-id').value;
        const type = document.getElementById('edit-record-type').value;
        let storeKey = type === 'weight' ? 'weightRecords' : (type === 'training' ? 'trainingRecords' : 'statsRecords');
        
        const updatedData = {};
        
        // If master changed the player ownership
        const playerSelect = document.getElementById('edit-record-player');
        if (playerSelect) {
            updatedData.playerId = playerSelect.value;
        }

        if (type === 'weight') {
            updatedData.date = document.getElementById('edit-weight-date').value;
            updatedData.weight = parseFloat(document.getElementById('edit-weight-val').value);
            const bf = document.getElementById('edit-bodyfat-val').value;
            updatedData.bodyFat = bf ? parseFloat(bf) : null;
            updatedData.memo = document.getElementById('edit-weight-memo').value;
        } else if (type === 'training') {
            updatedData.date = document.getElementById('edit-train-date').value;
            updatedData.type = document.getElementById('edit-train-type').value;
            updatedData.weight = parseFloat(document.getElementById('edit-train-weight').value);
            updatedData.reps = parseInt(document.getElementById('edit-train-reps').value);
            updatedData.sets = parseInt(document.getElementById('edit-train-sets').value);
        } else if (type === 'stats') {
            updatedData.date = document.getElementById('edit-stat-date').value;
            updatedData.type = document.getElementById('edit-stat-type').value;
            updatedData.value = parseFloat(document.getElementById('edit-stat-val').value);
        }
        
        await window.fbUpdateRecord(storeKey, id, updatedData);
        
        await renderHistory();
        await updateDashboard();
        
        document.getElementById('edit-record-modal').style.display = 'none';
        alert('記録を更新しました');
    });

    window.deleteRecord = async function(type, id) {
        if (!confirm('この記録を削除しますか？')) return;
        let storeKey = type === 'weight' ? 'weightRecords' : (type === 'training' ? 'trainingRecords' : 'statsRecords');
        
        await window.fbDeleteRecord(storeKey, id);
        
        await renderHistory();
        await updateDashboard();
    };

    async function renderHistory() {
        const listEl = document.getElementById('history-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');
        
        if (role === 'player' && !currentUserId) {
            listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">選手を選択してください</p>';
            return;
        }

        let storeKey = currentHistType === 'weight' ? 'weightRecords' : (currentHistType === 'training' ? 'trainingRecords' : 'statsRecords');
        
        // Pass null if master to fetch all records
        const queryId = role === 'master' ? null : currentUserId;
        let records = await window.fbGetRecords(storeKey, queryId);
        
        // Pre-load players to map names
        const players = await loadPlayers();
        
        // Sort descending by date
        records.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (records.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">記録がありません</p>';
            return;
        }

        records.forEach(r => {
            const player = players.find(p => p.id === r.playerId);
            const playerNameText = player ? player.name : '不明な選手';
            
            const li = document.createElement('li');
            li.className = 'player-item';
            
            let label = '';
            if (currentHistType === 'weight') {
                label = `${r.date} - 体重: ${r.weight}kg${r.bodyFat ? ` / 体脂肪: ${r.bodyFat}%` : ''}`;
            } else if (currentHistType === 'training') {
                label = `${r.date} - ${r.type}: ${r.weight}kg x ${r.reps}回 x ${r.sets}セット`;
            } else if (currentHistType === 'stats') {
                label = `${r.date} - ${r.type}: ${r.value}`;
            }
            
            if (role === 'master') {
                label = `【${playerNameText}】 ` + label;
            }

            li.innerHTML = `
                <span>${label}</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn-outline" onclick="editRecord('${currentHistType}', '${r.id}')">
                        <i class="fa-solid fa-pen"></i> 編集
                    </button>
                    <button class="btn-outline" style="color:var(--danger-color); border-color:rgba(239,68,68,0.3);" onclick="deleteRecord('${currentHistType}', '${r.id}')">
                        <i class="fa-solid fa-trash"></i> 削除
                    </button>
                </div>
            `;
            listEl.appendChild(li);
        });
    }

    let globalUnreadListener = null;
    function initChatNotifications() {
        const role = localStorage.getItem('userRole');
        const currentUserId = role === 'player' ? localStorage.getItem('currentPlayerId') : null;
        const currentUid = window.fbAuth.currentUser?.uid;

        if (!currentUid) return;
        if (globalUnreadListener) globalUnreadListener();

        if (role === 'player' && currentUserId) {
            globalUnreadListener = window.fbListenToComments(currentUserId, (messages) => {
                const unreadCount = messages.filter(m => m.senderId !== currentUid && !m.isRead).length;
                if (unreadCount > 0) {
                    unreadBadge.textContent = unreadCount;
                    unreadBadge.style.display = 'flex';
                } else {
                    unreadBadge.style.display = 'none';
                }
                notificationBtn.style.display = 'block';
                updateDashboardComments(role, currentUserId); // Also refresh dashboard if visible
            });
        } else if (role === 'master') {
            // Master side notification: Any unread message from any player
            globalUnreadListener = window.fbDb.collection('comments')
                .where("isRead", "==", false)
                .onSnapshot(snapshot => {
                    let unreadCount = 0;
                    snapshot.forEach(doc => {
                        if (doc.data().senderId !== currentUid) unreadCount++;
                    });
                    if (unreadCount > 0) {
                        unreadBadge.textContent = unreadCount;
                        unreadBadge.style.display = 'flex';
                    } else {
                        unreadBadge.style.display = 'none';
                    }
                    notificationBtn.style.display = 'block';
                });
        }
    }

    // Initial render async initialization
    window.initializeAppState = async function() {
        const trainDateInput = document.getElementById('train-date');
        if (trainDateInput && !trainDateInput.value) trainDateInput.valueAsDate = new Date();
        const statDateInput = document.getElementById('stat-date');
        if (statDateInput && !statDateInput.value) statDateInput.valueAsDate = new Date();
 
        // Ensure role visibility applies first
        const debugStatus = document.getElementById('debug-status');
        const debugMonitor = document.getElementById('debug-monitor');
        if (debugMonitor) debugMonitor.style.display = 'block';

        if (debugStatus) debugStatus.textContent = "Checking role...";
        const role = localStorage.getItem('userRole') || 'player';
        console.log("Initialize App State - Role:", role);
        if (role === 'player') {
            const currentUserId = localStorage.getItem('currentPlayerId');
            if (debugStatus) debugStatus.textContent = "Loading players...";
            const players = await loadPlayers();
            console.log("Current ID:", currentUserId, "Players count:", players.length);
            if (!currentUserId || !players.find(p => p.id == currentUserId)) {
                if (debugStatus) debugStatus.textContent = "Showing Auth Modal...";
                console.log("Triggering Auth Modal...");
                await showAuthModal();
                // Stop initialization here, it will resume when they login/register
                return; 
            }
        }
        if (debugStatus) debugStatus.textContent = "App Ready";
        
        await renderPlayerList();
        await updateSidebarProfile();
        await updateDashboard();
        await window.updateRanking();
        await renderHistory();
        
        // Setup Chat Notifications
        initChatNotifications();
    }
    
    // ---------- Ranking Logic ----------
    const rankingPeriodSelect = document.getElementById('ranking-period');
    const rankingCategorySelect = document.getElementById('ranking-category');
    
    if (rankingPeriodSelect) {
        rankingPeriodSelect.addEventListener('change', () => window.updateRanking());
    }
    if (rankingCategorySelect) {
        rankingCategorySelect.addEventListener('change', () => window.updateRanking());
    }

    window.updateRanking = async function() {
        const view = document.getElementById('ranking-single-view');
        if (!view) return;
        
        const period = rankingPeriodSelect ? rankingPeriodSelect.value : 'all';
        const selectedCatId = rankingCategorySelect ? rankingCategorySelect.value : 'pitch';
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
        const startOfThisYear = new Date(now.getFullYear(), 0, 1).toISOString();

        function isInPeriod(dateStr) {
            if (period === 'all') return true;
            if (period === 'this_month') return dateStr >= startOfThisMonth;
            if (period === 'last_month') return dateStr >= startOfLastMonth && dateStr <= endOfLastMonth;
            if (period === 'this_year') return dateStr >= startOfThisYear;
            return true;
        }

        view.innerHTML = '<div style="text-align:center; width:100%; opacity:0.5; padding: 40px;">ランキングを集計中...</div>';

        const players = await loadPlayers();
        const stats = await window.fbGetRecords('statsRecords', null);
        const trainings = await window.fbGetRecords('trainingRecords', null);
        
        const playerMap = {};
        players.forEach(p => playerMap[p.id] = p);

        const categories = {
            'pitch': { title: '⚾ 球速 (km/h)', type: 'stats', target: '球速 (km/h)', sort: 'desc' },
            'swing': { title: '🏏 スイングスピード (km/h)', type: 'stats', target: 'スイングスピード (km/h)', sort: 'desc' },
            'longtoss': { title: '🚀 遠投 (m)', type: 'stats', target: '遠投 (m)', sort: 'desc' },
            'dash50': { title: '🏃‍♂️ 50m走 (秒)', type: 'stats', target: '50m走 (秒)', sort: 'asc' },
            'bench': { title: '💪 ベンチプレス (kg)', type: 'training', target: 'ベンチプレス', sort: 'desc' },
            'squat': { title: '🦵 スクワット (kg)', type: 'training', target: 'スクワット', sort: 'desc' }
        };

        const cat = categories[selectedCatId];
        if (!cat) return;

        const bests = []; 
        
        players.forEach(p => {
            let pRecords = [];
            if (cat.type === 'stats') {
                pRecords = stats.filter(r => r.playerId === p.id && r.type === cat.target && isInPeriod(r.date));
            } else {
                pRecords = trainings.filter(r => r.playerId === p.id && r.type === cat.target && isInPeriod(r.date) && Number(r.reps) >= 10);
            }

            if (pRecords.length > 0) {
                let best;
                if (cat.sort === 'desc') {
                    best = pRecords.reduce((max, cur) => Number(cur.val || cur.value || cur.weight) > Number(max.val || max.value || max.weight) ? cur : max);
                } else {
                    best = pRecords.reduce((min, cur) => Number(cur.val || cur.value || cur.weight) < Number(min.val || min.value || min.weight) ? cur : min);
                }
                bests.push({ playerId: p.id, val: Number(best.val || best.value || best.weight), date: best.date });
            }
        });

        bests.sort((a, b) => cat.sort === 'desc' ? b.val - a.val : a.val - b.val);
        const top10 = bests.slice(0, 10); // TOP 10 displays fully

        let listHtml = '';
        if (top10.length === 0) {
            listHtml = '<div style="padding:40px 16px; text-align:center; color:var(--text-secondary); font-size:1rem;">該当する記録がありません</div>';
        } else {
            top10.forEach((item, index) => {
                const p = playerMap[item.playerId] || { name: '不明' };
                let rankIcon = `<span style="display:inline-block; width:36px; text-align:center; font-weight:bold; color:var(--text-secondary); font-size: 1.1rem;">${index + 1}</span>`;
                if (index === 0) rankIcon = `<i class="fa-solid fa-medal" style="color: gold; font-size:1.5rem; width:36px; text-align:center;"></i>`;
                if (index === 1) rankIcon = `<i class="fa-solid fa-medal" style="color: silver; font-size:1.4rem; width:36px; text-align:center;"></i>`;
                if (index === 2) rankIcon = `<i class="fa-solid fa-medal" style="color: #cd7f32; font-size:1.3rem; width:36px; text-align:center;"></i>`;

                const isMe = (p.id === localStorage.getItem('currentPlayerId'));
                const rowStyle = isMe ? 'background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-blue);' : 'border-left: 4px solid transparent; border-bottom: 1px solid var(--border-glass);';
                
                const style = p.avatarStyle || 'avataaars';
                const avatarUrl = (style === 'custom' && p.avatarDataUrl) ? p.avatarDataUrl : `https://api.dicebear.com/6.x/${style === 'custom' ? 'bottts' : style}/svg?seed=${p.avatarSeed || p.id}&backgroundColor=transparent`;

                listHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px 20px; ${rowStyle}">
                        <div style="display:flex; align-items:center; gap:16px;">
                            ${rankIcon}
                            <img src="${avatarUrl}" style="width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid ${isMe?'var(--accent-blue)':'var(--border-glass)'};">
                            <div>
                                <div style="font-weight:600; font-size:1.1rem; color:var(--text-primary); ${isMe?'color:var(--accent-blue);':''}">${p.name}</div>
                                <div style="font-size:0.75rem; color:var(--text-secondary);">${p.grade || ''} ${p.position ? ' / ' + p.position : ''}</div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; color:var(--accent-orange); font-size:1.5rem; letter-spacing: -0.5px;">${item.val}</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">${item.date}</div>
                        </div>
                    </div>
                `;
            });
        }

        view.innerHTML = `
            <div class="glass" style="border-radius:var(--border-radius); overflow:hidden; background:rgba(255,255,255,0.03);">
                <div style="padding: 16px; border-bottom: 2px solid var(--border-glass); font-weight: bold; font-size: 1.2rem; color: var(--text-primary); text-align:center;">
                    ${cat.title} <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: normal; margin-left:8px;">TOP 10</span>
                </div>
                <div>${listHtml}</div>
            </div>
        `;
        applyRoleVisibility();
    };
    // ---------- Data Export functionality ----------
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', async () => {
            if (localStorage.getItem('userRole') !== 'master') return;
            
            try {
                // Fetch all records
                const players = await loadPlayers();
                const weights = await window.fbGetRecords('weightRecords', null);
                const trainings = await window.fbGetRecords('trainingRecords', null);
                const stats = await window.fbGetRecords('statsRecords', null);
                
                // create a map of player ID to playerName for easy lookup
                const playerMap = {};
                players.forEach(p => playerMap[p.id] = p.name);

                let csvContent = "データタイプ,名前,日付,種目/項目,値1(体重/重量/記録),値2(体脂肪/回数),値3(セット数),メモ\n";
                
                // Format Weights
                weights.forEach(w => {
                    const name = playerMap[w.playerId] || '不明';
                    csvContent += `体重,${name},${w.date},体組成,${w.weight},${w.bodyFat || ''},,"${w.memo || ''}"\n`;
                });
                
                // Format Training
                trainings.forEach(t => {
                    const name = playerMap[t.playerId] || '不明';
                    csvContent += `トレーニング,${name},${t.date},${t.type},${t.weight},${t.reps},${t.sets},\n`;
                });
                
                // Format Stats
                stats.forEach(s => {
                    const name = playerMap[s.playerId] || '不明';
                    csvContent += `野球指標,${name},${s.date},${s.type},${s.value},,,\n`;
                });
                
                // create download link
                const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM added for Excel
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `baseball_export_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
            } catch (err) {
                console.error("CSV Export Failed:", err);
                alert("エクスポート中にエラーが発生しました。");
            }
        });
    }

    // ---------- Account Settings Logic ----------
    const accountSettingsModal = document.getElementById('account-settings-modal');
    let pendingAvatarDataUrl = null;
    
    document.querySelector('.user-profile')?.addEventListener('click', async () => {
        const role = localStorage.getItem('userRole');
        const currentUserId = localStorage.getItem('currentPlayerId');
        
        if (role === 'master') {
            alert('マスター権限の高度な設定は現在準備中です。');
            return;
        }
        if (!currentUserId) {
            alert('ログインしてからご利用ください。');
            return;
        }

        const players = await loadPlayers();
        const currentPlayer = players.find(p => p.id == currentUserId);
        if (!currentPlayer) return;

        // Populate Form
        document.getElementById('settings-name').value = currentPlayer.name || '';
        document.getElementById('settings-grade').value = currentPlayer.grade || '大1';
        document.getElementById('settings-position').value = currentPlayer.position || '';
        document.getElementById('settings-number').value = currentPlayer.number || '';
        document.getElementById('settings-goal').value = currentPlayer.goal || '';
        
        document.getElementById('settings-avatar-style').value = currentPlayer.avatarStyle || 'avataaars';
        document.getElementById('settings-avatar-seed').value = currentPlayer.avatarSeed || currentPlayer.id;
        pendingAvatarDataUrl = currentPlayer.avatarDataUrl || null;
        
        updateAvatarPreview();

        // Theme Colors
        const currentTheme = currentPlayer.themeColor || 'blue';
        document.querySelectorAll('.theme-color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === currentTheme);
        });

        accountSettingsModal.style.display = 'flex';
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
        accountSettingsModal.style.display = 'none';
        document.getElementById('settings-password-form').reset();
        document.getElementById('settings-pwd-msg').style.display = 'none';
        document.getElementById('settings-profile-msg').style.display = 'none';
    });

    // Avatar preview update
    function updateAvatarPreview() {
        const style = document.getElementById('settings-avatar-style').value;
        const seed = document.getElementById('settings-avatar-seed').value || 'Guest';
        const preview = document.getElementById('settings-avatar-preview');
        
        const seedContainer = document.getElementById('settings-avatar-seed-container');
        const uploadArea = document.getElementById('custom-avatar-upload-area');
        
        if (style === 'custom') {
            if (seedContainer) seedContainer.style.display = 'none';
            if (uploadArea) uploadArea.style.display = 'block';
            if (preview && pendingAvatarDataUrl) {
                preview.src = pendingAvatarDataUrl;
            } else if (preview) {
                preview.src = `https://api.dicebear.com/6.x/bottts/svg?seed=${seed}&backgroundColor=transparent`;
            }
        } else {
            if (seedContainer) seedContainer.style.display = 'block';
            if (uploadArea) uploadArea.style.display = 'none';
            if (preview) {
                 preview.src = `https://api.dicebear.com/6.x/${style}/svg?seed=${seed}&backgroundColor=transparent`;
            }
        }
    }

    document.getElementById('settings-avatar-style')?.addEventListener('change', updateAvatarPreview);
    document.getElementById('settings-avatar-seed')?.addEventListener('input', updateAvatarPreview);

    document.getElementById('settings-avatar-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxSize = 200;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                pendingAvatarDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                updateAvatarPreview();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Theme select interaction
    document.querySelectorAll('.theme-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.theme-color-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            // Instant preview
            applyThemeColor(e.target.dataset.color);
        });
    });

    // Save Profile & Theme
    document.getElementById('settings-profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentUserId = localStorage.getItem('currentPlayerId');
        if (!currentUserId) return;

        const activeThemeObj = document.querySelector('.theme-color-btn.active');
        const themeColor = activeThemeObj ? activeThemeObj.dataset.color : 'blue';

        const activeStyle = document.getElementById('settings-avatar-style').value;
        const updatedData = {
            name: document.getElementById('settings-name').value.trim(),
            grade: document.getElementById('settings-grade').value,
            position: document.getElementById('settings-position').value.trim(),
            number: document.getElementById('settings-number').value,
            goal: document.getElementById('settings-goal').value.trim(),
            avatarStyle: activeStyle,
            avatarSeed: document.getElementById('settings-avatar-seed').value.trim(),
            themeColor: themeColor,
            updatedAt: new Date().toISOString()
        };
        if (activeStyle === 'custom' && pendingAvatarDataUrl) {
            updatedData.avatarDataUrl = pendingAvatarDataUrl;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            await window.fbUpdatePlayer(currentUserId, updatedData);
            const msg = document.getElementById('settings-profile-msg');
            msg.style.display = 'block';
            setTimeout(() => msg.style.display = 'none', 3000);
            
            await updateSidebarProfile();
            await renderPlayerList(); // in case name changed
        } catch (err) {
            alert('保存に失敗しました: ' + err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Save Password
    document.getElementById('settings-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('settings-pwd-current').value;
        const newPass = document.getElementById('settings-pwd-new').value;

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const msg = document.getElementById('settings-pwd-msg');
        submitBtn.disabled = true;

        try {
            await window.fbChangePassword(currentPass, newPass);
            msg.style.color = 'var(--accent-green)';
            msg.textContent = 'パスワードを変更しました！';
            msg.style.display = 'block';
            e.target.reset();
        } catch (err) {
            msg.style.color = 'var(--accent-red)';
            msg.textContent = err.message;
            msg.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Delete Account
    document.getElementById('btn-delete-account')?.addEventListener('click', async () => {
        if (!confirm('本当にアカウントを削除しますか？紐づくすべてのプロフィールデータが削除され復元できません。')) return;
        
        try {
            await window.fbDeleteAccount();
            alert('アカウントを削除しました。ご利用ありがとうございました。');
            accountSettingsModal.style.display = 'none';
            localStorage.removeItem('currentPlayerId');
            localStorage.removeItem('userRole');
            window.location.reload();
        } catch (err) {
            alert(err.message);
        }
    });

    // Wait for modules to load, then initialize
    setTimeout(() => {
        window.initializeAppState();
    }, 500); // Temporary small delay to wait for Firebase Module to attach to window
});

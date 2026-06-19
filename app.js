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
        DASHBOARD_PERIODS: {
            ONE_WEEK: '1week',
            ONE_MONTH: '1month',
            THREE_MONTHS: '3months',
            SIX_MONTHS: '6months',
            ALL: 'all'
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

    const DASHBOARD_DEFINITIONS = {
        graphs: [
            { id: 'weight', label: '体重推移' },
            { id: 'bodyfat', label: '体脂肪率推移' },
            { id: 'training', label: '筋トレ推移' },
            { id: 'stats', label: '野球指標' },
            { id: 'ratio', label: '単位仕事量推移' }
        ],
        defaults: {
            graph: 'weight',
            trainingType: 'スクワット',
            statType: '球速 (km/h)',
            period: '3months'
        }
    };
    window.DASHBOARD_DEFINITIONS = DASHBOARD_DEFINITIONS;

    const ABILITY_CONFIG = {
        targetLineScore: 80,
        attributes: [
            { key: 'burst', label: '瞬発' },
            { key: 'power', label: '出力' },
            { key: 'strength', label: '筋力' },
            { key: 'flexibility', label: '柔軟性' }
        ],
        rules: [
            { source: 'training', pattern: /10m走/, attribute: 'burst', target80: 1.8, direction: 'lower', unit: '秒' },
            { source: 'training', pattern: /30m走/, attribute: 'burst', target80: 4.2, direction: 'lower', unit: '秒' },
            { source: 'training', pattern: /50m走/, attribute: 'burst', target80: 6.5, direction: 'lower', unit: '秒' },
            { source: 'training', pattern: /ボックスジャンプ/, attribute: 'burst', target80: 70, direction: 'higher', unit: 'cm' },
            { source: 'training', pattern: /立幅/, attribute: 'burst', target80: 260, direction: 'higher', unit: 'cm' },
            { source: 'training', pattern: /立ち三段/, attribute: 'burst', target80: 780, direction: 'higher', unit: 'cm' },
            { source: 'training', pattern: /メディシンボール|スロー/, attribute: 'power', target80: 10, direction: 'higher', unit: 'm' },
            { source: 'training', pattern: /ペンタゴンクリーン|クリーン/, attribute: 'power', target80: 90, direction: 'higher', unit: 'kg' },
            { source: 'training', pattern: /スクワット|プレス|ストレートバー|デッドリフト|懸垂/, attribute: 'strength', target80: 120, direction: 'higher', unit: 'kg' },
            { source: 'stats', pattern: /球速|プルダウン/, attribute: 'power', target80: 140, direction: 'higher', unit: 'km/h' },
            { source: 'stats', pattern: /スイングスピード/, attribute: 'power', target80: 130, direction: 'higher', unit: 'km/h' },
            { source: 'stats', pattern: /10m走/, attribute: 'burst', target80: 1.8, direction: 'lower', unit: '秒' },
            { source: 'stats', pattern: /30m走/, attribute: 'burst', target80: 4.2, direction: 'lower', unit: '秒' },
            { source: 'stats', pattern: /50m走/, attribute: 'burst', target80: 6.5, direction: 'lower', unit: '秒' },
            { source: 'stats', pattern: /柔軟|可動域|肩|股関節|前屈/, attribute: 'flexibility', target80: 80, direction: 'higher', unit: '点' }
        ],
        fallback: {
            training: { attribute: 'strength', target80: 100, direction: 'higher', unit: 'kg' },
            stats: { attribute: 'power', target80: 140, direction: 'higher', unit: '' }
        }
    };
    window.ABILITY_CONFIG = ABILITY_CONFIG;

    const ITEM_INPUT_MODES = {
        weight: { label: '重量', unit: 'kg', placeholder: '例: 80', step: '0.01' },
        distance: { label: '距離', unit: 'm', placeholder: '例: 8.75', step: '0.01' },
        count: { label: '回数', unit: '回', placeholder: '例: 12', step: '1' },
        rating4: { label: '4段評価', unit: '段階', placeholder: '1〜4', step: '1', min: '1', max: '4' },
        none: { label: '不採用', unit: '', placeholder: '', step: '1' }
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
    let dashboardLastData = null;
    let dashboardLastFilters = null;
    let dashboardWeeklyStatusCache = [];
    let itemDefinitionsState = null;
    let itemDefinitionFallbackCache = null;
    let currentItemSettingsKind = 'training';

    function populateDashboardSelect(selectId, options) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = options
            .map(option => `<option value="${option.value}">${option.label}</option>`)
            .join('');
        if (options.some(option => option.value === currentValue)) {
            select.value = currentValue;
        }
    }

    function getOptionsFromSelect(selectId) {
        const source = document.getElementById(selectId);
        if (!source) return [];
        return Array.from(source.options)
            .map(option => ({
                value: option.value || option.textContent.trim(),
                label: option.textContent.trim()
            }))
            .filter(option => (
                option.value &&
                option.value !== 'その他' &&
                !option.value.includes('選択') &&
                !option.label.includes('選択')
            ));
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function cloneDefinitions(definitions) {
        return {
            training: (definitions?.training || []).map(item => ({ ...item })),
            stats: (definitions?.stats || []).map(item => ({ ...item }))
        };
    }

    function createItemId(source, name) {
        const normalized = String(name || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]/g, '');
        return `${source}:${normalized || Date.now()}`;
    }

    function inferInputMode(source, name, unit = '') {
        const typeName = String(name || '');
        const normalizedUnit = String(unit || '').toLowerCase();
        if (/4段|段階|評価/.test(typeName) || /段階/.test(unit)) return 'rating4';
        if (/回数|懸垂/.test(typeName) || /回|rep/.test(normalizedUnit)) return 'count';
        if (/m|cm|距離|飛距離|走|立幅|三段|メディシン/.test(typeName) || /m|cm/.test(normalizedUnit)) return 'distance';
        if (source === 'training') return 'weight';
        return normalizedUnit === 'kg' ? 'weight' : 'distance';
    }

    function getInputModeConfig(mode) {
        return ITEM_INPUT_MODES[mode] || ITEM_INPUT_MODES.weight;
    }

    function getDefinitionDefaultUnit(source, name, unit, inputMode) {
        if (unit) return unit;
        const modeConfig = getInputModeConfig(inputMode);
        if (modeConfig.unit) return modeConfig.unit;
        const rule = getAbilityRule(source, name);
        return rule.unit || '';
    }

    function getDefaultNormalizeMax(target80, score80) {
        const target = Number(target80);
        const score = Number(score80);
        if (!Number.isFinite(target) || !Number.isFinite(score) || target <= 0 || score <= 0) return '';
        return Number((target * (100 / score)).toFixed(2));
    }

    function normalizeItemDefinition(source, item, index = 0) {
        const name = String(item?.name || item?.label || item?.value || '').trim();
        const rule = getAbilityRule(source, name);
        const inputMode = item?.inputMode || inferInputMode(source, name, item?.unit ?? rule.unit ?? '');
        const score80 = Number(item?.score80 ?? rule.score80 ?? ABILITY_CONFIG.targetLineScore);
        const target80 = Number(item?.target80 ?? rule.target80 ?? 80);
        const unit = getDefinitionDefaultUnit(source, name, item?.unit ?? rule.unit ?? '', inputMode);
        const normalizeMin = item?.normalizeMin ?? '';
        const normalizeMax = item?.normalizeMax ?? '';
        return {
            id: item?.id || createItemId(source, name),
            source,
            name,
            label: String(item?.label || name).trim(),
            attribute: item?.attribute || rule.attribute || 'power',
            target80,
            score80,
            direction: item?.direction || rule.direction || 'higher',
            unit: unit || '',
            inputMode,
            scoreMethod: item?.scoreMethod || 'max',
            normalizationMode: item?.normalizationMode || 'target',
            normalizeMin: normalizeMin === '' || normalizeMin === null || normalizeMin === undefined ? '' : Number(normalizeMin),
            normalizeMax: normalizeMax === '' || normalizeMax === null || normalizeMax === undefined ? getDefaultNormalizeMax(target80, score80) : Number(normalizeMax),
            active: inputMode !== 'none' && item?.active !== false,
            sortOrder: Number(item?.sortOrder ?? index)
        };
    }

    function getDefaultItemDefinitions() {
        if (itemDefinitionFallbackCache) return cloneDefinitions(itemDefinitionFallbackCache);

        itemDefinitionFallbackCache = {
            training: getOptionsFromSelect('train-type')
                .map((option, index) => normalizeItemDefinition('training', {
                    id: createItemId('training', option.value),
                    name: option.value,
                    label: option.label,
                    sortOrder: index
                }, index)),
            stats: getOptionsFromSelect('stat-type')
                .map((option, index) => normalizeItemDefinition('stats', {
                    id: createItemId('stats', option.value),
                    name: option.value,
                    label: option.label,
                    sortOrder: index
                }, index))
        };

        return cloneDefinitions(itemDefinitionFallbackCache);
    }

    function getItemDefinitions() {
        if (!itemDefinitionsState) {
            itemDefinitionsState = getDefaultItemDefinitions();
        }
        return itemDefinitionsState;
    }

    function getActiveItemDefinitions(source) {
        return (getItemDefinitions()[source] || [])
            .filter(item => item.active !== false && item.name)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    function getItemDefinition(source, typeName) {
        return (getItemDefinitions()[source] || []).find(item => item.name === typeName);
    }

    function getDefinitionOptions(source) {
        return getActiveItemDefinitions(source).map(item => ({
            value: item.name,
            label: item.label || item.name
        }));
    }

    function populateManagedSelect(selectId, source, options = {}) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentValue = options.selected ?? select.value;
        select.innerHTML = '';
        if (options.placeholder) {
            select.appendChild(new Option(options.placeholder, ''));
        }

        getActiveItemDefinitions(source).forEach(item => {
            select.appendChild(new Option(item.label || item.name, item.name));
        });

        if (options.includeOther) {
            select.appendChild(new Option('その他', 'その他'));
        }

        const values = Array.from(select.options).map(option => option.value);
        if (values.includes(currentValue)) {
            select.value = currentValue;
        } else if (!options.placeholder && select.options.length > 0) {
            select.selectedIndex = 0;
        }
    }

    function buildItemTypeOptions(source, selectedValue) {
        const definitions = getActiveItemDefinitions(source);
        const options = definitions.map(item => ({
            value: item.name,
            label: item.label || item.name
        }));

        if (selectedValue && !options.some(option => option.value === selectedValue)) {
            options.push({ value: selectedValue, label: selectedValue });
        }

        return options.map(option => (
            `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
        )).join('');
    }

    function applyItemDefinitions(definitions = getItemDefinitions()) {
        itemDefinitionsState = cloneDefinitions(definitions);
        populateManagedSelect('train-type', 'training', { placeholder: '種目を選択...', includeOther: true });
        populateManagedSelect('stat-type', 'stats', { placeholder: '項目を選択...', includeOther: true });
        populateManagedSelect('training-chart-type', 'training');
        populateManagedSelect('stats-chart-type', 'stats');

        DASHBOARD_DEFINITIONS.trainingTypes = getDefinitionOptions('training');
        DASHBOARD_DEFINITIONS.statTypes = getDefinitionOptions('stats');
        populateDashboardHistorySelect(DASHBOARD_DEFINITIONS.trainingTypes, DASHBOARD_DEFINITIONS.statTypes);
        updateTrainingInputMode(document.getElementById('train-type')?.value || '');
        updateStatsInputMode(document.getElementById('stat-type')?.value || '');
    }

    function populateDashboardHistorySelect(trainingTypes, statTypes) {
        const select = document.getElementById('dashboard-history-type');
        if (!select) return;

        const currentValue = select.value;
        const sections = [
            {
                label: '身体',
                options: [
                    { value: 'weight', label: '体重' },
                    { value: 'bodyfat', label: '体脂肪率' }
                ]
            },
            {
                label: 'ウエイトトレーニング',
                options: trainingTypes.map(option => ({
                    value: `training:${option.value}`,
                    label: option.label
                }))
            },
            {
                label: '単位仕事量',
                options: trainingTypes.map(option => ({
                    value: `ratio:${option.value}`,
                    label: option.label
                }))
            },
            {
                label: '野球指標',
                options: statTypes.map(option => ({
                    value: `stats:${option.value}`,
                    label: option.label
                }))
            }
        ];

        select.innerHTML = '';
        sections
            .filter(section => section.options.length > 0)
            .forEach(section => {
                const group = document.createElement('optgroup');
                group.label = section.label;
                section.options.forEach(option => {
                    group.appendChild(new Option(option.label, option.value));
                });
                select.appendChild(group);
            });

        const availableValues = Array.from(select.options).map(option => option.value);
        select.value = availableValues.includes(currentValue) ? currentValue : 'weight';
    }

    function initDashboardDefinitions() {
        applyItemDefinitions();
        DASHBOARD_DEFINITIONS.graphs.forEach(graph => {
            const tab = document.querySelector(`.graph-tab[data-graph="${graph.id}"]`);
            if (tab) tab.textContent = graph.label;
        });
    }

    async function loadItemSettings() {
        const defaults = getDefaultItemDefinitions();
        try {
            const saved = await window.fbGetAppSetting?.('itemDefinitions');
            const merged = {
                training: (saved?.training?.length ? saved.training : defaults.training)
                    .map((item, index) => normalizeItemDefinition('training', item, index)),
                stats: (saved?.stats?.length ? saved.stats : defaults.stats)
                    .map((item, index) => normalizeItemDefinition('stats', item, index))
            };
            applyItemDefinitions(merged);
            const status = document.getElementById('item-settings-status');
            if (status) status.textContent = saved ? '同期済み' : '初期設定';
            renderItemSettings();
        } catch (err) {
            console.warn('Failed to load item settings:', err);
            applyItemDefinitions(defaults);
        }
    }

    async function saveItemSettings() {
        const status = document.getElementById('item-settings-status');
        if (status) status.textContent = '保存中...';
        const payload = {
            ...cloneDefinitions(getItemDefinitions()),
            updatedAt: new Date().toISOString()
        };
        await window.fbSetAppSetting('itemDefinitions', payload);
        if (status) status.textContent = '保存済み';
    }

    function getAttributeLabel(attributeKey) {
        return ABILITY_CONFIG.attributes.find(attribute => attribute.key === attributeKey)?.label || attributeKey;
    }

    function getCurrentItemList() {
        return getItemDefinitions()[currentItemSettingsKind] || [];
    }

    function setCurrentItemList(nextList) {
        itemDefinitionsState = {
            ...cloneDefinitions(getItemDefinitions()),
            [currentItemSettingsKind]: nextList.map((item, index) => ({
                ...item,
                sortOrder: index
            }))
        };
    }

    function fillItemSettingForm(item = null) {
        const source = currentItemSettingsKind;
        const fallback = normalizeItemDefinition(source, {
            name: '',
            attribute: source === 'training' ? 'strength' : 'power',
            target80: source === 'stats' ? 140 : 100,
            score80: ABILITY_CONFIG.targetLineScore,
            direction: 'higher',
            unit: source === 'training' ? 'kg' : '',
            inputMode: source === 'training' ? 'weight' : 'distance',
            scoreMethod: 'max',
            normalizationMode: 'target'
        });

        const next = item || fallback;
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };

        setValue('item-setting-id', item?.id || '');
        setValue('item-setting-name', item?.name || '');
        setValue('item-setting-attribute', next.attribute);
        setValue('item-setting-direction', next.direction);
        setValue('item-setting-input-mode', next.inputMode);
        setValue('item-setting-score-method', next.scoreMethod);
        setValue('item-setting-normalization-mode', next.normalizationMode);
        setValue('item-setting-target80', next.target80);
        setValue('item-setting-score80', next.score80);
        setValue('item-setting-unit', next.unit);
        setValue('item-setting-normalize-min', next.normalizeMin);
        setValue('item-setting-normalize-max', next.normalizeMax);

        const active = document.getElementById('item-setting-active');
        if (active) active.checked = next.active !== false;
        const deleteBtn = document.getElementById('item-settings-delete-btn');
        if (deleteBtn) deleteBtn.disabled = !item;
    }

    function syncItemInputModeFields() {
        const mode = document.getElementById('item-setting-input-mode')?.value || 'weight';
        const unitInput = document.getElementById('item-setting-unit');
        const activeInput = document.getElementById('item-setting-active');
        const modeConfig = getInputModeConfig(mode);
        const knownUnits = new Set(Object.values(ITEM_INPUT_MODES).map(config => config.unit).filter(Boolean));

        if (unitInput && modeConfig.unit && (!unitInput.value || knownUnits.has(unitInput.value))) {
            unitInput.value = modeConfig.unit;
        }
        if (activeInput && mode === 'none') {
            activeInput.checked = false;
        }
    }

    function renderItemSettings() {
        const role = localStorage.getItem('userRole') || 'player';
        const panel = document.getElementById('item-settings');
        if (!panel || role !== 'master') return;

        const title = document.getElementById('item-settings-list-title');
        if (title) title.textContent = currentItemSettingsKind === 'training' ? 'ウエイト種目' : '野球指標';
        const nameLabel = document.getElementById('item-setting-name-label');
        if (nameLabel) nameLabel.textContent = currentItemSettingsKind === 'training' ? '種目名' : '項目名';

        document.querySelectorAll('.item-kind-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.itemKind === currentItemSettingsKind);
        });

        const listEl = document.getElementById('item-settings-list');
        if (!listEl) return;

        const items = getCurrentItemList()
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        if (!items.length) {
            listEl.innerHTML = '<div class="item-settings-empty">項目がありません</div>';
            fillItemSettingForm();
            return;
        }

        const selectedId = document.getElementById('item-setting-id')?.value || items[0].id;
        listEl.innerHTML = items.map(item => `
            <button type="button" class="item-settings-row ${item.id === selectedId ? 'active' : ''}" data-item-id="${escapeHtml(item.id)}">
                <span>
                    <strong>${escapeHtml(item.label || item.name)}</strong>
                    <small>${escapeHtml(getAttributeLabel(item.attribute))} / ${escapeHtml(item.direction === 'lower' ? '低いほど良い' : '高いほど良い')} / ${escapeHtml(item.scoreMethod === 'average' ? 'Ave' : 'Max')}</small>
                </span>
                <em>${escapeHtml(getInputModeConfig(item.inputMode).label)} / ${escapeHtml(item.target80)}${escapeHtml(item.unit)} = ${escapeHtml(item.score80)}点</em>
                ${item.active === false ? '<i class="fa-solid fa-eye-slash" title="非表示"></i>' : ''}
            </button>
        `).join('');

        const selectedItem = items.find(item => item.id === selectedId) || items[0];
        fillItemSettingForm(selectedItem);
    }

    function readItemSettingForm() {
        const id = document.getElementById('item-setting-id')?.value || '';
        const name = document.getElementById('item-setting-name')?.value.trim() || '';
        const target80 = Number(document.getElementById('item-setting-target80')?.value);
        const score80 = Number(document.getElementById('item-setting-score80')?.value);
        const unit = document.getElementById('item-setting-unit')?.value.trim() || '';
        const attribute = document.getElementById('item-setting-attribute')?.value || 'power';
        const direction = document.getElementById('item-setting-direction')?.value || 'higher';
        const inputMode = document.getElementById('item-setting-input-mode')?.value || 'weight';
        const scoreMethod = document.getElementById('item-setting-score-method')?.value || 'max';
        const normalizationMode = document.getElementById('item-setting-normalization-mode')?.value || 'target';
        const normalizeMinRaw = document.getElementById('item-setting-normalize-min')?.value;
        const normalizeMaxRaw = document.getElementById('item-setting-normalize-max')?.value;
        const normalizeMin = normalizeMinRaw === '' ? '' : Number(normalizeMinRaw);
        const normalizeMax = normalizeMaxRaw === '' ? '' : Number(normalizeMaxRaw);
        const active = inputMode !== 'none' && document.getElementById('item-setting-active')?.checked !== false;

        if (!name) throw new Error('名称を入力してください。');
        if (!Number.isFinite(target80) || target80 <= 0) throw new Error('140km/hラインは正の数値で入力してください。');
        if (!Number.isFinite(score80) || score80 <= 0 || score80 > 100) throw new Error('基準点は1〜100で入力してください。');
        if (normalizationMode === 'manual') {
            if (!Number.isFinite(normalizeMin) || !Number.isFinite(normalizeMax) || normalizeMin === normalizeMax) {
                throw new Error('手動正規化では1点ラインと100点ラインに異なる数値を入力してください。');
            }
        }

        return normalizeItemDefinition(currentItemSettingsKind, {
            id: id || `${currentItemSettingsKind}:${Date.now()}`,
            name,
            label: name,
            attribute,
            target80,
            score80,
            direction,
            unit,
            inputMode,
            scoreMethod,
            normalizationMode,
            normalizeMin,
            normalizeMax,
            active
        });
    }

    async function refreshAfterItemSettingsChange() {
        applyItemDefinitions();
        renderItemSettings();
        if (dashboardLastData && dashboardLastFilters) {
            updateDashboardCharts(dashboardLastData, dashboardLastFilters);
            updateDashboardRecordHistory(dashboardLastData, dashboardLastFilters);
        }
        await window.updateRanking?.();
        if (document.getElementById('my-ability')?.classList.contains('active')) {
            await updateMyAbility();
        }
    }

    function getDashboardHistorySelection() {
        const select = document.getElementById('dashboard-history-type');
        const rawValue = select?.value || 'weight';
        const label = select?.selectedOptions?.[0]?.textContent?.trim() || '';
        const readType = (prefix) => rawValue.slice(prefix.length);

        if (rawValue === 'bodyfat') {
            return {
                category: 'bodyfat',
                label: '体脂肪率',
                title: '体脂肪率の記録履歴',
                statusTitle: '体脂肪率'
            };
        }

        if (rawValue.startsWith('training:')) {
            const type = readType('training:') || DASHBOARD_DEFINITIONS.defaults.trainingType;
            return {
                category: 'training',
                type,
                label: label || type,
                title: `${label || type} の記録履歴`,
                statusTitle: label || type
            };
        }

        if (rawValue.startsWith('stats:')) {
            const type = readType('stats:') || DASHBOARD_DEFINITIONS.defaults.statType;
            return {
                category: 'stats',
                type,
                label: label || type,
                title: `${label || type} の記録履歴`,
                statusTitle: label || type
            };
        }

        if (rawValue.startsWith('ratio:')) {
            const type = readType('ratio:') || DASHBOARD_DEFINITIONS.defaults.trainingType;
            return {
                category: 'ratio',
                type,
                label: label || type,
                title: `${label || type} 単位仕事量の記録履歴`,
                statusTitle: `${label || type} 単位仕事量`
            };
        }

        return {
            category: 'weight',
            label: '体重',
            title: '体重の記録履歴',
            statusTitle: '体重'
        };
    }

    function getDashboardPeriodStart(period, baseDate = new Date()) {
        const start = new Date(baseDate);
        if (period === CONSTANTS.DASHBOARD_PERIODS.ALL) return null;
        if (period === CONSTANTS.DASHBOARD_PERIODS.ONE_WEEK) start.setDate(start.getDate() - 7);
        else if (period === CONSTANTS.DASHBOARD_PERIODS.ONE_MONTH) start.setMonth(start.getMonth() - 1);
        else if (period === CONSTANTS.DASHBOARD_PERIODS.SIX_MONTHS) start.setMonth(start.getMonth() - 6);
        else start.setMonth(start.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    function filterRecordsByDashboardPeriod(records, period) {
        const start = getDashboardPeriodStart(period);
        if (!start) return records;
        return records.filter(record => record.date && new Date(record.date) >= start);
    }

    function setActiveDashboardGraph(graphId = DASHBOARD_DEFINITIONS.defaults.graph) {
        const activeGraph = DASHBOARD_DEFINITIONS.graphs.some(graph => graph.id === graphId)
            ? graphId
            : DASHBOARD_DEFINITIONS.defaults.graph;

        graphTabs.forEach(tab => {
            const isActive = tab.getAttribute('data-graph') === activeGraph;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });

        document.querySelectorAll('.chart-card[id^="graph-card-"]').forEach(card => {
            const isActive = card.id === `graph-card-${activeGraph}`;
            card.classList.toggle('is-active-mobile', isActive);
        });

        setTimeout(() => {
            [weightChartInstance, bodyFatChartInstance, trainingChartInstance, statsChartInstance, ratioChartInstance, abilityChartInstance]
                .forEach(chart => chart?.resize());
        }, 0);

        if (dashboardLastData && dashboardLastFilters) {
            updateDashboardRecordHistory(dashboardLastData, dashboardLastFilters);
        }
    }

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
                if (targetTab === 'my-ability') {
                    updateMyAbility();
                    setTimeout(() => abilityChartInstance?.resize(), 0);
                }

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
                setActiveDashboardGraph(tab.getAttribute('data-graph'));
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
    initDashboardDefinitions();

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

    function createAbilityChart(ctx) {
        if (!ctx) return null;
        const labels = ABILITY_CONFIG.attributes.map(attribute => attribute.label);
        return new Chart(ctx, {
            type: 'radar',
            data: {
                labels,
                datasets: [
                    {
                        label: '現状',
                        data: labels.map(() => 0),
                        borderColor: CONSTANTS.CHART_COLORS.STATS,
                        backgroundColor: 'rgba(59, 130, 246, 0.18)',
                        borderWidth: 3,
                        pointBackgroundColor: CONSTANTS.CHART_COLORS.STATS,
                        pointBorderColor: '#fff',
                        pointRadius: 4
                    },
                    {
                        label: '140km/hライン',
                        data: labels.map(() => ABILITY_CONFIG.targetLineScore),
                        borderColor: CONSTANTS.CHART_COLORS.BODY_FAT,
                        backgroundColor: 'rgba(249, 115, 22, 0.04)',
                        borderWidth: 2,
                        borderDash: [6, 6],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#cbd5e1',
                            boxWidth: 12,
                            font: { size: 12 }
                        }
                    }
                },
                scales: {
                    r: {
                        min: 0,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            color: '#94a3b8',
                            backdropColor: 'transparent'
                        },
                        pointLabels: {
                            color: '#f8fafc',
                            font: { size: 13, weight: '700' }
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.11)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.15)' }
                    }
                }
            }
        });
    }

    // Initialize Charts
    weightChartInstance = createLineChart(document.getElementById('weightChart'), '体重 (kg)', CONSTANTS.CHART_COLORS.WEIGHT);
    bodyFatChartInstance = createLineChart(document.getElementById('bodyFatChart'), '体脂肪率 (%)', CONSTANTS.CHART_COLORS.BODY_FAT);
    trainingChartInstance = createLineChart(document.getElementById('trainingChart'), '重量 (kg)', CONSTANTS.CHART_COLORS.TRAINING);
    statsChartInstance = createLineChart(document.getElementById('statsChart'), '記録', CONSTANTS.CHART_COLORS.STATS);
    ratioChartInstance = createLineChart(document.getElementById('ratioChart'), '単位仕事量 (重量/体重)', CONSTANTS.CHART_COLORS.RATIO);
    abilityChartInstance = createAbilityChart(document.getElementById('abilityChart'));
    setActiveDashboardGraph();

    // ---------- Event Listeners ----------

    function isMedicineBallType(typeName) {
        return /メディシンボール/.test(typeName || '');
    }

    function getRecordInputConfig(source, typeName) {
        const definition = itemDefinitionsState ? getItemDefinition(source, typeName) : null;
        const mode = definition?.inputMode || inferInputMode(source, typeName, definition?.unit || '');
        const modeConfig = getInputModeConfig(mode);
        const unit = definition?.unit || modeConfig.unit || '';
        const label = mode === 'distance' && unit && !/^(m|cm)$/.test(unit) ? '記録' : modeConfig.label;
        return {
            mode,
            label,
            unit,
            placeholder: modeConfig.placeholder,
            step: modeConfig.step,
            min: modeConfig.min || '',
            max: modeConfig.max || ''
        };
    }

    function getTrainingValueLabel(typeName) {
        const config = getRecordInputConfig('training', typeName);
        return `${config.label}${config.unit ? ` (${config.unit})` : ''}`;
    }

    function getTrainingValueUnit(typeName) {
        return getRecordInputConfig('training', typeName).unit;
    }

    function formatTrainingRecordLabel(record) {
        const unit = getTrainingValueUnit(record.type);
        if (getRecordInputConfig('training', record.type).mode !== 'weight') {
            return `${record.date} - ${record.type}: ${record.weight}${unit}`;
        }
        return `${record.date} - ${record.type}: ${record.weight}${unit} x ${record.reps}回 x ${record.sets}セット`;
    }

    function updateTrainingInputMode(typeName) {
        const config = getRecordInputConfig('training', typeName);
        const isSingleValueMode = config.mode !== 'weight';
        const label = document.getElementById('train-value-label');
        const valueInput = document.getElementById('train-weight');
        const repsCol = document.getElementById('train-reps-col');
        const setsCol = document.getElementById('train-sets-col');
        const repsInput = document.getElementById('train-reps');
        const setsInput = document.getElementById('train-sets');

        if (label) label.textContent = getTrainingValueLabel(typeName);
        if (valueInput) {
            valueInput.placeholder = config.placeholder;
            valueInput.step = config.step;
            valueInput.min = config.min;
            valueInput.max = config.max;
        }
        if (repsCol) repsCol.style.display = isSingleValueMode ? 'none' : '';
        if (setsCol) setsCol.style.display = isSingleValueMode ? 'none' : '';
        if (repsInput) repsInput.required = !isSingleValueMode;
        if (setsInput) setsInput.required = !isSingleValueMode;
        if (isSingleValueMode) {
            if (repsInput) repsInput.value = '1';
            if (setsInput) setsInput.value = '1';
        }
    }

    function updateEditTrainingInputMode(typeName) {
        const config = getRecordInputConfig('training', typeName);
        const isSingleValueMode = config.mode !== 'weight';
        const label = document.getElementById('edit-train-value-label');
        const valueInput = document.getElementById('edit-train-weight');
        const repsCol = document.getElementById('edit-train-reps-col');
        const setsCol = document.getElementById('edit-train-sets-col');
        const repsInput = document.getElementById('edit-train-reps');
        const setsInput = document.getElementById('edit-train-sets');

        if (label) label.textContent = getTrainingValueLabel(typeName);
        if (valueInput) {
            valueInput.placeholder = config.placeholder;
            valueInput.step = config.step;
            valueInput.min = config.min;
            valueInput.max = config.max;
        }
        if (repsCol) repsCol.style.display = isSingleValueMode ? 'none' : '';
        if (setsCol) setsCol.style.display = isSingleValueMode ? 'none' : '';
        if (repsInput) repsInput.required = !isSingleValueMode;
        if (setsInput) setsInput.required = !isSingleValueMode;
        if (isSingleValueMode) {
            if (repsInput) repsInput.value = repsInput.value || '1';
            if (setsInput) setsInput.value = setsInput.value || '1';
        }
    }

    function updateStatsInputMode(typeName) {
        const config = getRecordInputConfig('stats', typeName);
        const label = document.querySelector('label[for="stat-val"]') || document.getElementById('stat-val')?.closest('.form-group')?.querySelector('label');
        const input = document.getElementById('stat-val');
        if (label) label.textContent = `記録数値${config.unit ? ` (${config.unit})` : ''}`;
        if (input) {
            input.placeholder = config.placeholder || '数値を入力';
            input.step = config.step;
            input.min = config.min;
            input.max = config.max;
        }
    }

    function updateEditStatsInputMode(typeName) {
        const config = getRecordInputConfig('stats', typeName);
        const input = document.getElementById('edit-stat-val');
        const label = input?.closest('.form-group')?.querySelector('label');
        if (label) label.textContent = `記録数値${config.unit ? ` (${config.unit})` : ''}`;
        if (input) {
            input.placeholder = config.placeholder || '数値を入力';
            input.step = config.step;
            input.min = config.min;
            input.max = config.max;
        }
    }

    function initEventListeners() {
        const masterFilterPanel = document.getElementById('master-dash-filters');
        const masterFilterToggle = document.getElementById('toggle-master-dash-filters');
        if (masterFilterPanel && masterFilterToggle) {
            const setFilterOpen = (isOpen) => {
                masterFilterPanel.classList.toggle('is-open', isOpen);
                masterFilterToggle.setAttribute('aria-expanded', String(isOpen));
                localStorage.setItem('masterDashFiltersOpen', String(isOpen));
            };
            setFilterOpen(localStorage.getItem('masterDashFiltersOpen') === 'true');
            masterFilterToggle.addEventListener('click', () => {
                setFilterOpen(!masterFilterPanel.classList.contains('is-open'));
            });
        }

        const abilityFilterPanel = document.getElementById('master-ability-filters');
        const abilityFilterToggle = document.getElementById('toggle-master-ability-filters');
        if (abilityFilterPanel && abilityFilterToggle) {
            const setAbilityFilterOpen = (isOpen) => {
                abilityFilterPanel.classList.toggle('is-open', isOpen);
                abilityFilterToggle.setAttribute('aria-expanded', String(isOpen));
                localStorage.setItem('masterAbilityFiltersOpen', String(isOpen));
            };
            setAbilityFilterOpen(localStorage.getItem('masterAbilityFiltersOpen') === 'true');
            abilityFilterToggle.addEventListener('click', () => {
                setAbilityFilterOpen(!abilityFilterPanel.classList.contains('is-open'));
            });
        }

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
            'training-chart-type', 'stats-chart-type'
        ];
        filterIds.forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (id === 'training-chart-type') setActiveDashboardGraph('training');
                if (id === 'stats-chart-type') setActiveDashboardGraph('stats');
                updateDashboard();
            });
        });

        document.getElementById('dashboard-history-type')?.addEventListener('change', () => {
            if (dashboardLastData && dashboardLastFilters) {
                updateDashboardRecordHistory(dashboardLastData, dashboardLastFilters);
            } else {
                updateDashboard();
            }
        });

        const abilityFilterIds = [
            'ability-filter-grade', 'ability-filter-player', 'ability-filter-position', 'ability-filter-period',
            'ability-exclude-grade', 'ability-exclude-position', 'ability-exclude-player'
        ];
        abilityFilterIds.forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (id === 'ability-filter-player') {
                    localStorage.setItem('abilityPlayerId', document.getElementById(id).value);
                }
                updateMyAbility();
            });
        });

        document.querySelectorAll('.item-kind-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentItemSettingsKind = tab.dataset.itemKind || 'training';
                fillItemSettingForm();
                renderItemSettings();
            });
        });

        document.getElementById('item-settings-list')?.addEventListener('click', (event) => {
            const row = event.target.closest('.item-settings-row');
            if (!row) return;
            const item = getCurrentItemList().find(candidate => candidate.id === row.dataset.itemId);
            if (item) {
                fillItemSettingForm(item);
                renderItemSettings();
            }
        });

        document.getElementById('item-settings-new-btn')?.addEventListener('click', () => {
            fillItemSettingForm();
            document.getElementById('item-setting-name')?.focus();
        });

        document.getElementById('item-setting-input-mode')?.addEventListener('change', () => {
            syncItemInputModeFields();
        });

        document.getElementById('item-setting-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                const nextItem = readItemSettingForm();
                const current = getCurrentItemList();
                const duplicate = current.find(item => (
                    item.id !== nextItem.id && item.name === nextItem.name
                ));
                if (duplicate) {
                    alert('同じ名前の項目が既にあります。');
                    return;
                }

                const index = current.findIndex(item => item.id === nextItem.id);
                const nextList = index >= 0
                    ? current.map(item => item.id === nextItem.id ? { ...nextItem, sortOrder: item.sortOrder } : item)
                    : [...current, { ...nextItem, sortOrder: current.length }];

                setCurrentItemList(nextList);
                applyItemDefinitions();
                await saveItemSettings();
                await refreshAfterItemSettingsChange();
                fillItemSettingForm(nextItem);
                renderItemSettings();
            } catch (err) {
                alert(err.message || '保存に失敗しました。');
            }
        });

        document.getElementById('item-settings-delete-btn')?.addEventListener('click', async () => {
            const id = document.getElementById('item-setting-id')?.value;
            if (!id) return;
            const item = getCurrentItemList().find(candidate => candidate.id === id);
            if (!item) return;
            if (!confirm(`${item.name} を削除しますか？既存の記録データは削除されません。`)) return;

            try {
                setCurrentItemList(getCurrentItemList().filter(candidate => candidate.id !== id));
                fillItemSettingForm();
                applyItemDefinitions();
                await saveItemSettings();
                await refreshAfterItemSettingsChange();
            } catch (err) {
                alert(err.message || '削除に失敗しました。');
            }
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
            updateTrainingInputMode(e.target.value);
        });

        document.getElementById('stat-type')?.addEventListener('change', (e) => {
            const group = document.getElementById('stat-other-memo-group');
            if (group) group.style.display = e.target.value === 'その他' ? 'block' : 'none';
            updateStatsInputMode(e.target.value);
        });
    }

    // ========== UI INITIALIZATION (Priority: Early & Reliable) ==========
    function initUiHelpers() {
        try {
            const APP_VERSION = '2.7';
            const versionEl = document.getElementById('app-version');
            if (versionEl) versionEl.textContent = `v${APP_VERSION}`;
            updateTrainingInputMode(document.getElementById('train-type')?.value || '');

            const buttons = document.querySelectorAll('.pwd-toggle');
            console.log(`[initUiHelpers] Found ${buttons.length} pwd-toggle buttons`);
            
            buttons.forEach((btn, idx) => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (!input) {
                    console.warn(`[initUiHelpers] Button ${idx}: Target input #${targetId} not found`);
                    return;
                }
                
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const show = input.type === 'password';
                    input.type = show ? 'text' : 'password';
                    const icon = btn.querySelector('i');
                    if (icon) icon.className = `fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`;
                    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
                    console.log(`[pwd-toggle] Button ${idx} toggled: ${input.type}`);
                });
                console.log(`[initUiHelpers] Button ${idx} (#${targetId}) event listener registered`);
            });
            console.log('[initUiHelpers] Initialization complete');
        } catch (e) {
            console.error('[initUiHelpers] Error:', e);
        }
    }

    // Call immediately
    initUiHelpers();

    initEventListeners();

    // ---------- Dashboard Helpers ----------

    function getDashboardFilters(role, currentUserId) {
        const filters = {
            grade: 'all',
            position: 'all',
            playerId: currentUserId,
            period: document.getElementById('dash-filter-period')?.value || DASHBOARD_DEFINITIONS.defaults.period,
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
            
            filters.exclude.grade = document.getElementById('dash-exclude-grade')?.value || 'none';
            filters.exclude.position = document.getElementById('dash-exclude-position')?.value || 'none';
            filters.exclude.playerId = document.getElementById('dash-exclude-player')?.value || 'none';
        }
        return filters;
    }

    function getAbilityFilters(role, currentUserId) {
        const filters = {
            grade: 'all',
            position: 'all',
            playerId: currentUserId,
            period: document.getElementById('ability-filter-period')?.value || DASHBOARD_DEFINITIONS.defaults.period,
            exclude: {
                grade: 'none',
                position: 'none',
                playerId: 'none'
            }
        };

        if (role === 'master') {
            filters.grade = document.getElementById('ability-filter-grade')?.value || 'all';
            filters.position = document.getElementById('ability-filter-position')?.value || 'all';
            filters.playerId = document.getElementById('ability-filter-player')?.value || 'all';
            filters.exclude.grade = document.getElementById('ability-exclude-grade')?.value || 'none';
            filters.exclude.position = document.getElementById('ability-exclude-position')?.value || 'none';
            filters.exclude.playerId = document.getElementById('ability-exclude-player')?.value || 'none';
        }

        return filters;
    }

    function applyDashboardCriteria(data, players, filters, role) {
        let { allWeights, allStats, allTraining } = data;
        let targetPlayers = [];

        if (role === 'master') {
            if (filters.playerId === 'all') {
                targetPlayers = [...players];

                if (filters.grade !== 'all') targetPlayers = targetPlayers.filter(p => p.grade === filters.grade);
                if (filters.position !== 'all') targetPlayers = targetPlayers.filter(p => p.position === filters.position);
                if (filters.exclude.grade !== 'none') targetPlayers = targetPlayers.filter(p => p.grade !== filters.exclude.grade);
                if (filters.exclude.position !== 'none') targetPlayers = targetPlayers.filter(p => p.position !== filters.exclude.position);
                if (filters.exclude.playerId !== 'none') targetPlayers = targetPlayers.filter(p => p.id !== filters.exclude.playerId);
            } else {
                targetPlayers = players.filter(p => p.id === filters.playerId);
            }

            const targetPlayerIds = new Set(targetPlayers.map(p => p.id));

            allWeights = allWeights.filter(r => targetPlayerIds.has(r.playerId));
            allStats = allStats.filter(r => targetPlayerIds.has(r.playerId));
            allTraining = allTraining.filter(r => targetPlayerIds.has(r.playerId));
        } else {
            targetPlayers = players.filter(p => p.id === filters.playerId);
        }

        return { allWeights, allStats, allTraining, targetPlayers };
    }

    function renderChartValueStrip(containerId, points, valueFormatter) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));

        const formatDate = (dateStr) => {
            const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) return `${Number(match[2])}/${Number(match[3])}`;
            return dateStr || '';
        };

        const rows = [...points]
            .filter(point => point && point.date && point.value !== null && point.value !== undefined)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 6);

        if (!rows.length) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = rows.map(point => `
            <div class="chart-value-chip">
                <time>${escapeHtml(formatDate(point.date))}</time>
                <strong>${escapeHtml(valueFormatter(point.value))}</strong>
            </div>
        `).join('');
    }

    function updateDashboardCharts(data, filters) {
        const { allWeights, allStats, allTraining } = data;
        const { period } = filters;
        const scopedWeights = filterRecordsByDashboardPeriod(allWeights, period);
        const scopedStats = filterRecordsByDashboardPeriod(allStats, period);
        const scopedTraining = filterRecordsByDashboardPeriod(allTraining, period);

        // 1. Weight Chart
        const aggWeights = aggregateData(scopedWeights, CONSTANTS.PERIODS.DAILY, 'weight', 'bodyFat');

        if (weightChartInstance) {
            weightChartInstance.data.labels = aggWeights.map(d => d.date.substring(5));
            weightChartInstance.data.datasets[0].data = aggWeights.map(d => d.value);
            weightChartInstance.update();
        }
        renderChartValueStrip(
            'chart-values-weight',
            aggWeights.map(point => ({ date: point.date, value: point.value })),
            value => `${Number(value).toFixed(1)}kg`
        );

        // 2. Body Fat Chart
        const bodyFatData = aggWeights.filter(d => d.value2 !== null);
        if (bodyFatChartInstance) {
            bodyFatChartInstance.data.labels = bodyFatData.map(d => d.date.substring(5));
            bodyFatChartInstance.data.datasets[0].data = bodyFatData.map(d => d.value2);
            bodyFatChartInstance.update();
        }
        renderChartValueStrip(
            'chart-values-bodyfat',
            bodyFatData.map(point => ({ date: point.date, value: point.value2 })),
            value => `${Number(value).toFixed(1)}%`
        );

        // 3. Training Chart
        const trainingType = document.getElementById('training-chart-type')?.value || DASHBOARD_DEFINITIONS.defaults.trainingType;
        const rawTrainData = scopedTraining.filter(r => r.type === trainingType);
        const aggTrain = aggregateData(rawTrainData, CONSTANTS.PERIODS.DAILY, 'weight');
        const trainingUnit = getTrainingValueUnit(trainingType);

        if (trainingChartInstance) {
            trainingChartInstance.data.labels = aggTrain.map(d => d.date.substring(5));
            trainingChartInstance.data.datasets[0].label = `${trainingType} (${trainingUnit})`;
            trainingChartInstance.data.datasets[0].data = aggTrain.map(d => d.value);
            trainingChartInstance.update();
        }
        renderChartValueStrip(
            'chart-values-training',
            aggTrain.map(point => ({ date: point.date, value: point.value })),
            value => `${Number(value).toFixed(1)}${trainingUnit}`
        );

        // 4. Stats Chart
        const statsType = document.getElementById('stats-chart-type')?.value || DASHBOARD_DEFINITIONS.defaults.statType;
        const rawStatsData = scopedStats.filter(r => r.type === statsType);
        const aggStats = aggregateData(rawStatsData, CONSTANTS.PERIODS.DAILY, 'value');
        const statUnit = getItemDefinition('stats', statsType)?.unit || (String(statsType).match(/\(([^)]+)\)/) || [])[1] || '';

        if (statsChartInstance) {
            statsChartInstance.data.labels = aggStats.map(d => d.date.substring(5));
            statsChartInstance.data.datasets[0].label = statsType;
            statsChartInstance.data.datasets[0].data = aggStats.map(d => d.value);
            statsChartInstance.update();
        }
        renderChartValueStrip(
            'chart-values-stats',
            aggStats.map(point => ({ date: point.date, value: point.value })),
            value => `${Number(value).toFixed(2)}${statUnit}`
        );

        // 5. Ratio Chart
        if (ratioChartInstance) {
            if (getRecordInputConfig('training', trainingType).mode !== 'weight') {
                ratioChartInstance.data.labels = [];
                ratioChartInstance.data.datasets[0].data = [];
                ratioChartInstance.update();
                renderChartValueStrip('chart-values-ratio', [], value => value);
                return;
            }
            const sortedWeights = [...scopedWeights].sort((a,b) => new Date(a.date) - new Date(b.date));
            const trainingBySelectedType = scopedTraining.filter(t => t.type === trainingType);
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
            const aggRatio = aggregateData(ratioPoints, CONSTANTS.PERIODS.DAILY, 'value');
            ratioChartInstance.data.labels = aggRatio.map(d => d.date.substring(5));
            ratioChartInstance.data.datasets[0].data = aggRatio.map(d => d.value);
            ratioChartInstance.update();
            renderChartValueStrip(
                'chart-values-ratio',
                aggRatio.map(point => ({ date: point.date, value: point.value })),
                value => Number(value).toFixed(2)
            );
        }
    }

    function updateDashboardStats(data) {
        const { allWeights } = data;
        const recentWeights = filterRecordsByDashboardPeriod(allWeights, CONSTANTS.DASHBOARD_PERIODS.THREE_MONTHS);

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        const calcMetric = (records, key) => {
            const values = records
                .filter(record => record[key] !== null && record[key] !== undefined && record[key] !== '')
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(record => Number(record[key]))
                .filter(value => Number.isFinite(value));

            if (!values.length) return { max: null, ave: null, growth: null };

            const first = values[0];
            const last = values[values.length - 1];
            const growth = values.length > 1 ? last - first : null;

            return {
                max: Math.max(...values),
                ave: values.reduce((sum, value) => sum + value, 0) / values.length,
                growth
            };
        };

        const formatSigned = (value, digits = 1) => {
            if (value === null) return '--';
            const rounded = Number(value.toFixed(digits));
            return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
        };

        const renderMetric = (prefix, metric, digits = 1) => {
            setText(`${prefix}-max`, metric.max === null ? '--' : metric.max.toFixed(digits));
            setText(`${prefix}-ave`, metric.ave === null ? '--' : metric.ave.toFixed(digits));
            setText(`${prefix}-growth`, formatSigned(metric.growth, digits));
        };

        renderMetric('dash-weight', calcMetric(recentWeights, 'weight'), 1);
        renderMetric('dash-bodyfat', calcMetric(recentWeights, 'bodyFat'), 1);
    }

    function updateDashboardRecordHistory(data, filters) {
        const container = document.getElementById('dashboard-record-history');
        const titleEl = document.getElementById('dashboard-history-title');
        const countEl = document.getElementById('dashboard-history-count');
        if (!container) return;
        updateDashboardWeeklyStatus(data, filters);

        const historySelection = getDashboardHistorySelection();
        const period = filters.period || DASHBOARD_DEFINITIONS.defaults.period;
        const scopedWeights = filterRecordsByDashboardPeriod(data.allWeights, period);
        const scopedStats = filterRecordsByDashboardPeriod(data.allStats, period);
        const scopedTraining = filterRecordsByDashboardPeriod(data.allTraining, period);

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));

        const formatDate = (dateStr) => {
            const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) return `${Number(match[2])}/${Number(match[3])}`;
            return dateStr || '';
        };

        const formatValue = (value, digits = 1) => {
            const number = Number(value);
            return Number.isFinite(number) ? number.toFixed(digits) : '--';
        };

        const getStatUnit = (typeName) => {
            const configuredUnit = getItemDefinition('stats', typeName)?.unit;
            if (configuredUnit) return configuredUnit;
            const match = String(typeName || '').match(/\(([^)]+)\)/);
            return match ? match[1] : '';
        };

        let title = '記録履歴';
        let rows = [];

        if (historySelection.category === 'training') {
            const trainingType = historySelection.type;
            const unit = getTrainingValueUnit(trainingType);
            title = historySelection.title;
            rows = scopedTraining
                .filter(record => record.type === trainingType)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(record => ({
                    date: record.date,
                    value: `${formatValue(record.weight, 2)}${unit}`,
                    detail: isMedicineBallType(record.type) ? '' : `${record.reps || '--'}回 x ${record.sets || '--'}セット`
                }));
        } else if (historySelection.category === 'stats') {
            const statsType = historySelection.type;
            const unit = getStatUnit(statsType);
            title = historySelection.title;
            rows = scopedStats
                .filter(record => record.type === statsType)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(record => ({
                    date: record.date,
                    value: `${formatValue(record.value, 2)}${unit}`,
                    detail: ''
                }));
        } else if (historySelection.category === 'ratio') {
            const trainingType = historySelection.type;
            title = historySelection.title;

            if (getRecordInputConfig('training', trainingType).mode === 'weight') {
                const sortedWeights = [...scopedWeights].sort((a, b) => new Date(a.date) - new Date(b.date));
                rows = scopedTraining
                    .filter(record => record.type === trainingType)
                    .map(record => {
                        let weightRecord = sortedWeights.find(weight => weight.date === record.date);
                        if (!weightRecord) {
                            const pastWeights = sortedWeights.filter(weight => weight.date < record.date);
                            if (pastWeights.length > 0) weightRecord = pastWeights[pastWeights.length - 1];
                        }
                        if (!weightRecord || !weightRecord.weight) return null;
                        return {
                            date: record.date,
                            value: formatValue(Number(record.weight) / Number(weightRecord.weight), 2),
                            detail: `${formatValue(record.weight, 1)}kg / 体重 ${formatValue(weightRecord.weight, 1)}kg`
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
            }
        } else if (historySelection.category === 'bodyfat') {
            title = historySelection.title;
            rows = [...scopedWeights]
                .filter(record => record.bodyFat !== null && record.bodyFat !== undefined && record.bodyFat !== '')
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(record => ({
                    date: record.date,
                    value: `体脂肪率 ${formatValue(record.bodyFat, 1)}%`,
                    detail: record.weight === null || record.weight === undefined || record.weight === ''
                        ? ''
                        : `体重 ${formatValue(record.weight, 1)}kg`
                }));
        } else {
            title = historySelection.title;
            rows = [...scopedWeights]
                .filter(record => record.weight !== null && record.weight !== undefined && record.weight !== '')
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(record => ({
                    date: record.date,
                    value: `体重 ${formatValue(record.weight, 1)}kg`,
                    detail: record.bodyFat === null || record.bodyFat === undefined || record.bodyFat === ''
                        ? '体脂肪率 --'
                        : `体脂肪率 ${formatValue(record.bodyFat, 1)}%`
                }));
        }

        if (titleEl) titleEl.textContent = title;
        if (countEl) countEl.textContent = `${rows.length}件`;

        if (!rows.length) {
            container.innerHTML = '<div class="dashboard-history-empty">表示できる記録がありません</div>';
            return;
        }

        container.innerHTML = rows.map(row => `
            <div class="dashboard-history-row">
                <time>${escapeHtml(formatDate(row.date))}</time>
                <strong>${escapeHtml(row.value)}</strong>
                ${row.detail ? `<span>${escapeHtml(row.detail)}</span>` : ''}
            </div>
        `).join('');
    }

    function updateDashboardWeeklyStatus(data, filters) {
        const weeklyEl = document.getElementById('dashboard-weekly-status');
        if (!weeklyEl) return;

        const role = localStorage.getItem('userRole') || 'player';
        const targetPlayers = Array.from(new Map((data.targetPlayers || [])
            .filter(player => player && player.id)
            .map(player => [player.id, player])
        ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));

        if (role !== 'master' || targetPlayers.length === 0) {
            weeklyEl.style.display = 'none';
            dashboardWeeklyStatusCache = [];
            return;
        }

        const historySelection = getDashboardHistorySelection();
        const period = filters.period || DASHBOARD_DEFINITIONS.defaults.period;
        const scopedWeights = filterRecordsByDashboardPeriod(data.allWeights, period);
        const scopedStats = filterRecordsByDashboardPeriod(data.allStats, period);
        const scopedTraining = filterRecordsByDashboardPeriod(data.allTraining, period);

        let sourceRecords = scopedWeights.filter(record => (
            record.weight !== null && record.weight !== undefined && record.weight !== ''
        ));
        let statusTitle = historySelection.statusTitle;
        if (historySelection.category === 'bodyfat') {
            sourceRecords = scopedWeights.filter(record => record.bodyFat !== null && record.bodyFat !== undefined && record.bodyFat !== '');
        } else if (historySelection.category === 'training' || historySelection.category === 'ratio') {
            const trainingType = historySelection.type;
            sourceRecords = scopedTraining.filter(record => record.type === trainingType);
        } else if (historySelection.category === 'stats') {
            const statsType = historySelection.type;
            sourceRecords = scopedStats.filter(record => record.type === statsType);
        }

        const getWeekStart = (dateInput) => {
            const date = new Date(dateInput);
            date.setHours(0, 0, 0, 0);
            const day = date.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            date.setDate(date.getDate() + diff);
            return date;
        };

        const getWeekEnd = (weekStart) => {
            const end = new Date(weekStart);
            end.setDate(end.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return end;
        };

        const formatWeekLabel = (weekStart) => {
            const end = getWeekEnd(weekStart);
            return `${weekStart.getMonth() + 1}/${weekStart.getDate()}週 (${end.getMonth() + 1}/${end.getDate()}まで)`;
        };

        const periodStart = getDashboardPeriodStart(period);
        const recordDates = sourceRecords
            .map(record => record.date ? new Date(record.date) : null)
            .filter(date => date && !Number.isNaN(date.getTime()));
        const minRecordDate = recordDates.length
            ? new Date(Math.min(...recordDates.map(date => date.getTime())))
            : new Date();
        const firstWeek = getWeekStart(periodStart || minRecordDate);
        const lastWeek = getWeekStart(new Date());
        const weeks = [];

        for (let cursor = new Date(firstWeek); cursor <= lastWeek; cursor.setDate(cursor.getDate() + 7)) {
            weeks.push(new Date(cursor));
        }

        const playerName = (player) => player.name || player.id || '不明';
        dashboardWeeklyStatusCache = weeks.reverse().map((weekStart) => {
            const weekEnd = getWeekEnd(weekStart);
            const enteredIds = new Set(sourceRecords
                .filter(record => {
                    const date = new Date(record.date);
                    return date >= weekStart && date <= weekEnd;
                })
                .map(record => record.playerId)
                .filter(Boolean));
            const enteredPlayers = targetPlayers.filter(player => enteredIds.has(player.id));
            const missingPlayers = targetPlayers.filter(player => !enteredIds.has(player.id));

            return {
                label: formatWeekLabel(weekStart),
                title: statusTitle,
                enteredPlayers,
                missingPlayers,
                enteredNames: enteredPlayers.map(playerName),
                missingNames: missingPlayers.map(playerName)
            };
        });

        if (dashboardWeeklyStatusCache.length === 0) {
            weeklyEl.style.display = 'none';
            return;
        }

        weeklyEl.style.display = 'block';
        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));

        const visibleWeeks = dashboardWeeklyStatusCache.slice(0, 4);
        const olderWeeks = dashboardWeeklyStatusCache.slice(4);

        weeklyEl.innerHTML = `
            <div class="dashboard-weekly-status-header">
                <span><i class="fa-solid fa-calendar-week"></i> 週ごとの入力状況</span>
                <small>${escapeHtml(statusTitle)}</small>
            </div>
            <div class="dashboard-week-tabs">
                ${visibleWeeks.map((week, index) => `
                    <button type="button" class="dashboard-week-tab" onclick="window.openDashboardWeekStatus(${index})">
                        <span>${escapeHtml(week.label)}</span>
                        <strong>未入力 ${week.missingPlayers.length}人</strong>
                    </button>
                `).join('')}
                ${olderWeeks.length ? `
                    <select class="dashboard-week-select" onchange="if(this.value !== '') { window.openDashboardWeekStatus(Number(this.value)); this.value = ''; }">
                        <option value="">過去の週を選択</option>
                        ${olderWeeks.map((week, olderIndex) => `
                            <option value="${olderIndex + 4}">${escapeHtml(week.label)} / 未入力 ${week.missingPlayers.length}人</option>
                        `).join('')}
                    </select>
                ` : ''}
            </div>
        `;
    }

    window.openDashboardWeekStatus = function(index) {
        const week = dashboardWeeklyStatusCache[index];
        const modal = document.getElementById('dashboard-weekly-modal');
        const titleEl = document.getElementById('dashboard-weekly-modal-title');
        const bodyEl = document.getElementById('dashboard-weekly-modal-body');
        if (!week || !modal || !bodyEl) return;

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
        const listHtml = (names) => names.length
            ? names.map(name => `<li>${escapeHtml(name)}</li>`).join('')
            : '<li class="empty">該当なし</li>';

        if (titleEl) titleEl.textContent = `${week.label} / ${week.title}`;
        bodyEl.innerHTML = `
            <div class="dashboard-weekly-modal-grid">
                <section>
                    <h4>入力している人 <span>${week.enteredNames.length}人</span></h4>
                    <ul>${listHtml(week.enteredNames)}</ul>
                </section>
                <section>
                    <h4>入力していない人 <span>${week.missingNames.length}人</span></h4>
                    <ul>${listHtml(week.missingNames)}</ul>
                </section>
            </div>
        `;
        modal.style.display = 'flex';
    };

    window.closeDashboardWeekStatusModal = function() {
        const modal = document.getElementById('dashboard-weekly-modal');
        if (modal) modal.style.display = 'none';
    };

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
        dashboardLastData = filteredData;
        dashboardLastFilters = filters;
        updateDashboardCharts(filteredData, filters);
        updateDashboardStats(filteredData);
        updateDashboardRecordHistory(filteredData, filters);
        await updateDashboardComments(role, currentUserId);
    }

    function getAbilityRule(source, typeName) {
        const type = String(typeName || '');
        const managedDefinition = itemDefinitionsState ? getItemDefinition(source, type) : null;
        if (managedDefinition) {
            return {
                attribute: managedDefinition.attribute,
                target80: managedDefinition.target80,
                score80: managedDefinition.score80,
                direction: managedDefinition.direction,
                unit: managedDefinition.unit,
                scoreMethod: managedDefinition.scoreMethod,
                normalizationMode: managedDefinition.normalizationMode,
                normalizeMin: managedDefinition.normalizeMin,
                normalizeMax: managedDefinition.normalizeMax
            };
        }

        const configuredRule = ABILITY_CONFIG.rules.find(rule => (
            rule.source === source && rule.pattern.test(type)
        ));
        if (configuredRule) return configuredRule;

        if (/柔軟|可動域|肩|股関節|前屈/.test(type)) {
            return { attribute: 'flexibility', target80: 80, direction: 'higher', unit: '点' };
        }
        if (/走|ジャンプ|立幅|三段/.test(type)) {
            return { attribute: 'burst', target80: /走/.test(type) ? 6.5 : 260, direction: /走/.test(type) ? 'lower' : 'higher', unit: /走/.test(type) ? '秒' : 'cm' };
        }
        if (/球速|プルダウン|スイング|メディシン|スロー|クリーン/.test(type)) {
            return { attribute: 'power', target80: source === 'stats' ? 140 : 90, direction: 'higher', unit: source === 'stats' ? 'km/h' : 'kg' };
        }

        return ABILITY_CONFIG.fallback[source] || ABILITY_CONFIG.fallback.stats;
    }

    function aggregateAbilityValue(values, method, direction) {
        if (!values.length) return null;
        if (method === 'average') {
            return values.reduce((sum, value) => sum + value, 0) / values.length;
        }
        return direction === 'lower' ? Math.min(...values) : Math.max(...values);
    }

    function getAbilityMetricRecords(records, source) {
        const valueKey = source === 'training' ? 'weight' : 'value';
        const byType = new Map();

        records.forEach(record => {
            const type = record.type || record.otherMemo || '';
            const value = Number(record[valueKey]);
            if (!type || !Number.isFinite(value)) return;
            if (!byType.has(type)) byType.set(type, []);
            byType.get(type).push({ ...record, source, value });
        });

        return getActiveItemDefinitions(source)
            .filter(item => item.inputMode !== 'none')
            .map(item => {
                const itemRecords = byType.get(item.name) || [];
                const values = itemRecords.map(record => record.value).filter(value => Number.isFinite(value));
                if (!values.length) return null;
                const rule = getAbilityRule(source, item.name);
                return {
                    source,
                    type: item.name,
                    value: aggregateAbilityValue(values, item.scoreMethod, rule.direction),
                    count: values.length,
                    scoreMethod: item.scoreMethod
                };
            })
            .filter(Boolean);
    }

    function calculateAbilityScore(value, rule) {
        const target80 = Number(rule.target80);
        const targetScore = Number(rule.score80 || ABILITY_CONFIG.targetLineScore);

        if (rule.normalizationMode === 'manual') {
            const minValue = Number(rule.normalizeMin);
            const maxValue = Number(rule.normalizeMax);
            if (Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue !== maxValue) {
                const ratio = (Number(value) - minValue) / (maxValue - minValue);
                return Math.max(1, Math.min(100, Math.round(1 + ratio * 99)));
            }
        }

        if (!Number.isFinite(target80) || target80 <= 0 || !Number.isFinite(targetScore)) return null;
        const rawScore = rule.direction === 'lower'
            ? (target80 / value) * targetScore
            : (value / target80) * targetScore;
        return Math.max(1, Math.min(100, Math.round(rawScore)));
    }

    function formatAbilityValue(value, unit) {
        const digits = Math.abs(value) >= 100 ? 0 : 1;
        return `${Number(value).toFixed(digits)}${unit || ''}`;
    }

    function getAbilityUnit(source, typeName, rule) {
        const match = String(typeName || '').match(/\(([^)]+)\)/);
        if (match) return match[1];
        if (source === 'training' && !rule.unit) return getTrainingValueUnit(typeName);
        return rule.unit || '';
    }

    function buildAbilityRows(trainingRecords, statsRecords) {
        const attributeMap = new Map(ABILITY_CONFIG.attributes.map(attribute => [
            attribute.key,
            { ...attribute, score: null, metrics: [] }
        ]));
        const records = [
            ...getAbilityMetricRecords(trainingRecords, 'training'),
            ...getAbilityMetricRecords(statsRecords, 'stats')
        ];

        records.forEach(record => {
            const rule = getAbilityRule(record.source, record.type);
            const targetScore = Number(rule.score80 || ABILITY_CONFIG.targetLineScore);
            const score = calculateAbilityScore(record.value, rule);
            if (score === null) return;
            const unit = getAbilityUnit(record.source, record.type, rule);
            const attribute = attributeMap.get(rule.attribute) || attributeMap.get('power');

            attribute.metrics.push({
                type: record.type,
                value: record.value,
                unit,
                targetScore,
                count: record.count,
                scoreMethod: record.scoreMethod,
                score
            });
        });

        return ABILITY_CONFIG.attributes.map(attributeConfig => {
            const attribute = attributeMap.get(attributeConfig.key);
            const score = attribute.metrics.length
                ? Math.round(attribute.metrics.reduce((sum, metric) => sum + metric.score, 0) / attribute.metrics.length)
                : null;

            return {
                ...attribute,
                score,
                targetScore: attribute.metrics.length
                    ? Math.round(attribute.metrics.reduce((sum, metric) => sum + metric.targetScore, 0) / attribute.metrics.length)
                    : ABILITY_CONFIG.targetLineScore,
                achievement: score === null ? null : Math.round((score / (
                    attribute.metrics.length
                        ? attribute.metrics.reduce((sum, metric) => sum + metric.targetScore, 0) / attribute.metrics.length
                        : ABILITY_CONFIG.targetLineScore
                )) * 100)
            };
        });
    }

    function renderAbilityEmpty(message = '表示できる記録がありません') {
        const body = document.getElementById('ability-score-body');
        const playerNameEl = document.getElementById('ability-player-name');
        if (playerNameEl) playerNameEl.textContent = '--';
        if (body) {
            body.innerHTML = `<tr><td colspan="5" class="ability-empty">${message}</td></tr>`;
        }
        if (abilityChartInstance) {
            abilityChartInstance.data.datasets[0].data = ABILITY_CONFIG.attributes.map(() => 0);
            abilityChartInstance.data.datasets[1].data = ABILITY_CONFIG.attributes.map(() => ABILITY_CONFIG.targetLineScore);
            abilityChartInstance.update();
        }
    }

    function renderAbility(rows, playerName) {
        const body = document.getElementById('ability-score-body');
        const playerNameEl = document.getElementById('ability-player-name');
        if (!body) return;

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));

        if (playerNameEl) playerNameEl.textContent = playerName || '--';

        body.innerHTML = rows.map(row => {
            const metricLabels = row.metrics
                .slice(0, 3)
                .map(metric => `${metric.type} ${metric.scoreMethod === 'average' ? 'Ave' : 'Max'} ${formatAbilityValue(metric.value, metric.unit)}`);
            const extraCount = row.metrics.length - metricLabels.length;
            const itemsLabel = metricLabels.length
                ? `${metricLabels.join(' / ')}${extraCount > 0 ? ` 他${extraCount}` : ''}`
                : '記録なし';

            return `
                <tr>
                    <td><strong>${escapeHtml(row.label)}</strong></td>
                    <td>${row.score === null ? '--' : `${row.score}点`}</td>
                    <td>${row.targetScore || ABILITY_CONFIG.targetLineScore}点</td>
                    <td>${row.achievement === null ? '--' : `${row.achievement}%`}</td>
                    <td>${escapeHtml(itemsLabel)}</td>
                </tr>
            `;
        }).join('');

        if (abilityChartInstance) {
            abilityChartInstance.data.datasets[0].data = rows.map(row => row.score || 0);
            abilityChartInstance.data.datasets[1].data = rows.map(row => row.targetScore || ABILITY_CONFIG.targetLineScore);
            abilityChartInstance.update();
        }
    }

    function resolveAbilityPlayerId(players, role, currentUserId) {
        const control = document.getElementById('ability-player-control');
        const select = document.getElementById('ability-player-select');

        if (role !== 'master') {
            if (control) control.style.display = 'none';
            return currentUserId;
        }

        if (!control || !select) return '';

        const candidates = players
            .filter(player => (player.role || 'player') !== 'master')
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
        control.style.display = 'flex';

        const currentValue = select.value;
        const storedValue = localStorage.getItem('abilityPlayerId');
        const dashboardValue = document.getElementById('dash-filter-player')?.value || '';
        select.innerHTML = '';
        candidates.forEach(player => {
            select.appendChild(new Option(player.name || player.id, player.id));
        });

        const candidateIds = new Set(candidates.map(player => player.id));
        const selectedValue = [currentValue, storedValue, dashboardValue]
            .find(value => value && value !== 'all' && candidateIds.has(value)) || candidates[0]?.id || '';

        select.value = selectedValue;
        if (selectedValue) localStorage.setItem('abilityPlayerId', selectedValue);
        return selectedValue;
    }

    async function updateMyAbility() {
        const body = document.getElementById('ability-score-body');
        if (!body) return;

        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');
        if (role === 'player' && !currentUserId) {
            renderAbilityEmpty('ログイン後に表示されます');
            return;
        }

        try {
            if (role === 'master') {
                await loadPlayersForAbilityFilter();
            }
            const filters = getAbilityFilters(role, currentUserId);
            const dbQueryId = (role === 'master' && filters.playerId === 'all') ? null : filters.playerId;
            const players = await window.fbGetPlayers();
            if (!dbQueryId && role !== 'master') {
                renderAbilityEmpty('選手を選択してください');
                return;
            }

            const [trainingRecords, statsRecords] = await Promise.all([
                window.fbGetRecords('trainingRecords', dbQueryId),
                window.fbGetRecords('statsRecords', dbQueryId)
            ]);
            const abilityPlayers = role === 'master'
                ? players.filter(player => (player.role || 'player') !== 'master')
                : players;
            const filteredData = applyDashboardCriteria({
                allWeights: [],
                allStats: statsRecords,
                allTraining: trainingRecords
            }, abilityPlayers, filters, role);
            const scopedTraining = filterRecordsByDashboardPeriod(filteredData.allTraining, filters.period);
            const scopedStats = filterRecordsByDashboardPeriod(filteredData.allStats, filters.period);
            const rows = buildAbilityRows(scopedTraining, scopedStats);
            const summaryEl = document.getElementById('ability-filter-summary');
            const targetPlayers = filteredData.targetPlayers || [];
            const player = targetPlayers[0] || players.find(item => item.id === currentUserId);
            const displayName = role === 'master'
                ? (filters.playerId === 'all' ? `対象 ${targetPlayers.length}人` : (player?.name || '選手'))
                : (player?.name || '自分の記録');

            if (summaryEl) {
                summaryEl.textContent = role === 'master'
                    ? `${displayName} / ${filters.period}`
                    : `自分の記録 / ${filters.period}`;
            }
            renderAbility(rows, displayName);
            setTimeout(() => abilityChartInstance?.resize(), 0);
        } catch (err) {
            console.error('Failed to update my ability:', err);
            renderAbilityEmpty('表示に失敗しました');
        }
    }
    window.updateMyAbility = updateMyAbility;

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
                    updateTrainingInputMode(document.getElementById('train-type')?.value || '');
                }
                if (formId === 'stats-form') {
                    const memoGroup = document.getElementById('stat-other-memo-group');
                    if (memoGroup) memoGroup.style.display = 'none';
                    updateStatsInputMode(document.getElementById('stat-type')?.value || '');
                }

                await updateDashboard();
                await renderHistory();
                if (document.getElementById('my-ability')?.classList.contains('active')) {
                    await updateMyAbility();
                }
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

    handleFormSubmit('training-form', 'trainingRecords', () => {
        const typeName = document.getElementById('train-type').value;
        const isSingleValueMode = getRecordInputConfig('training', typeName).mode !== 'weight';
        return {
            date: document.getElementById('train-date').value,
            type: typeName,
            weight: parseFloat(document.getElementById('train-weight').value),
            reps: isSingleValueMode ? 1 : parseInt(document.getElementById('train-reps').value),
            sets: isSingleValueMode ? 1 : parseInt(document.getElementById('train-sets').value),
            otherMemo: typeName === 'その他'
                ? document.getElementById('train-other-memo').value
                : ''
        };
    }, 'トレーニング記録を保存しました！');

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
            document.querySelectorAll('.master-only').forEach(el => {
                if (el.matches('.tab-pane.master-only')) el.style.display = '';
                else el.style.display = el.matches('.nav-links li') ? 'flex' : 'block';
            });
            
            // Populate player filter if not already done
            loadPlayersForFilter();
            loadPlayersForAbilityFilter();
            renderItemSettings();
        } else {
            if (masterFilters) masterFilters.style.display = 'none';
            if (exportCsvBtn) exportCsvBtn.style.display = 'none';
            document.querySelectorAll('.master-only').forEach(el => el.style.display = 'none');
            if (document.getElementById('item-settings')?.classList.contains('active')) {
                document.querySelector('.nav-links li[data-tab="dashboard"]')?.click();
            }
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

    async function loadPlayersForAbilityFilter() {
        const playerSelect = document.getElementById('ability-filter-player');
        const excludeSelect = document.getElementById('ability-exclude-player');
        if (!playerSelect) return;

        const players = await loadPlayers();
        const uniqueMap = new Map();
        players.forEach(player => {
            if ((player.role || 'player') === 'master') return;
            const key = `${player.name}-${player.grade}-${player.id}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, player);
        });
        const uniquePlayers = Array.from(uniqueMap.values())
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));

        const currentValue = playerSelect.value || localStorage.getItem('abilityPlayerId') || 'all';
        const renderOptions = (targetPlayers) => {
            playerSelect.innerHTML = '';
            playerSelect.appendChild(new Option('全選手', 'all'));
            targetPlayers.forEach(player => {
                playerSelect.appendChild(new Option(`${player.name} (${player.grade || '-'})`, player.id));
            });
            if (Array.from(playerSelect.options).some(option => option.value === currentValue)) {
                playerSelect.value = currentValue;
            }
        };

        renderOptions(uniquePlayers);

        const searchInput = document.getElementById('ability-filter-player-search');
        if (searchInput && searchInput.dataset.bound !== 'true') {
            searchInput.dataset.bound = 'true';
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.trim().toLowerCase();
                const filtered = term
                    ? uniquePlayers.filter(player => (player.name || '').toLowerCase().includes(term))
                    : uniquePlayers;
                renderOptions(filtered);
            });
        }

        if (excludeSelect) {
            const currentExclude = excludeSelect.value || 'none';
            excludeSelect.innerHTML = '';
            excludeSelect.appendChild(new Option('なし', 'none'));
            uniquePlayers.forEach(player => {
                excludeSelect.appendChild(new Option(`${player.name} (${player.grade || '-'})`, player.id));
            });
            if (Array.from(excludeSelect.options).some(option => option.value === currentExclude)) {
                excludeSelect.value = currentExclude;
            }
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
    const playerListSearch = document.getElementById('player-list-search');

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
        const searchTerm = (playerListSearch?.value || '').trim().toLocaleLowerCase('ja-JP');
        const visiblePlayers = searchTerm
            ? players.filter(p => [p.name, p.grade, p.position, p.number]
                .some(value => String(value || '').toLocaleLowerCase('ja-JP').includes(searchTerm)))
            : players;

        // Show only non-master players in the player list, masters shown with badge
        playerListEl.innerHTML = visiblePlayers.map(p => {
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

    playerListSearch?.addEventListener('input', () => renderPlayerList());

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
    const authPlayerSearch = document.getElementById('auth-player-search');
    const authLoginView = document.getElementById('auth-login-view');
    const authRegisterView = document.getElementById('auth-register-view');
    const authMasterView = document.getElementById('auth-master-view');
    const authMasterRegisterView = document.getElementById('auth-master-register-view');
    let authPlayerOptions = [];

    function renderAuthPlayerOptions(searchText = '') {
        if (!authPlayerSelect) return;
        const keyword = searchText.trim().toLocaleLowerCase('ja-JP');
        const filteredPlayers = keyword
            ? authPlayerOptions.filter(p => (p.name || '').toLocaleLowerCase('ja-JP').startsWith(keyword))
            : authPlayerOptions;

        let html = '<option value="">-- 選択してください --</option>';
        filteredPlayers.forEach(p => {
            const roleLabel = p.role === 'master' ? '管理者' : (p.position || '-');
            html += `<option value="${p.id}">${p.name} (${roleLabel} / #${p.number || '-'})</option>`;
        });

        authPlayerSelect.innerHTML = html;
    }

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

            authPlayerOptions = uniquePlayers;
            if (authPlayerSearch) authPlayerSearch.value = '';
            renderAuthPlayerOptions();
        } catch (err) {
            console.error("showAuthModal failed to load players:", err);
            authPlayerSelect.innerHTML = '<option value="">選手リストの読み込みに失敗しました</option>';
        }
    }

    authPlayerSearch?.addEventListener('input', (e) => {
        renderAuthPlayerOptions(e.target.value);
    });

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

        const currentUserId = localStorage.getItem('currentPlayerId');
        if (role === 'master') {
            let currentMaster = null;
            if (currentUserId) {
                const players = await loadPlayers();
                currentMaster = players.find(p => p.id == currentUserId);
            }

            if (currentMaster) {
                profileName.textContent = currentMaster.name || 'マスター（管理者）';
                profileDetail.textContent = currentMaster.goal || currentMaster.position || '選手管理・全データ閲覧';

                const style = currentMaster.avatarStyle || 'bottts';
                const seed = currentMaster.avatarSeed || currentMaster.id || 'Master';
                if (style === 'custom' && currentMaster.avatarDataUrl) {
                    profileAvatar.src = currentMaster.avatarDataUrl;
                } else {
                    profileAvatar.src = `https://api.dicebear.com/6.x/${style === 'custom' ? 'bottts' : style}/svg?seed=${seed}&backgroundColor=transparent`;
                }
                applyThemeColor(currentMaster.themeColor || 'orange');
            } else {
                profileName.textContent = localStorage.getItem('masterName') || 'マスター（管理者）';
                profileDetail.textContent = '選手管理・全データ閲覧';
                profileAvatar.src = 'https://api.dicebear.com/6.x/bottts/svg?seed=Master&backgroundColor=transparent';
                applyThemeColor('orange');
            }
        } else {
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
        // Sidebar profile updated; do not re-run applyRoleVisibility() here to avoid recursive loops.
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
        const invite = authMasterRegisterView.querySelector('#reg-master-invite').value;
        const id = authMasterRegisterView.querySelector('#reg-master-id').value.trim();
        const name = authMasterRegisterView.querySelector('#reg-master-name').value.trim();
        const pass = authMasterRegisterView.querySelector('#reg-master-password').value;

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

    document.getElementById('btn-login')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const loginSelect = playerAuthModal.querySelector('#auth-login-view #auth-player-select');
        const loginPasswordInput = playerAuthModal.querySelector('#auth-login-view #auth-player-password');
        const selectedId = loginSelect?.value || '';
        const password = loginPasswordInput?.value || '';
        console.log('[login] selectedId:', selectedId, 'passwordLength:', password.length);
        
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
            const pass = authRegisterView.querySelector('#reg-password').value;
            const passConfirm = authRegisterView.querySelector('#reg-password-confirm').value;

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
    const histSearchName = document.getElementById('hist-search-name');
    const histSearchType = document.getElementById('hist-search-type');
    const histExportCsvBtn = document.getElementById('hist-export-csv-btn');
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

    histSearchName?.addEventListener('input', () => renderHistory());
    histSearchType?.addEventListener('input', () => renderHistory());

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
        if (role !== 'master' && rec.playerId !== currentUserId) {
            alert('他のユーザーの履歴は編集できません。');
            return;
        }

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
                        ${buildItemTypeOptions('training', rec.type)}
                    </select>
                </div>
                <div class="form-group mb-3 row">
                    <div class="col">
                        <label id="edit-train-value-label">${getTrainingValueLabel(rec.type)}</label>
                        <input type="number" step="0.01" id="edit-train-weight" value="${rec.weight}" class="w-100" required>
                    </div>
                    <div class="col" id="edit-train-reps-col">
                        <label>回数</label>
                        <input type="number" id="edit-train-reps" value="${rec.reps}" class="w-100" required>
                    </div>
                    <div class="col" id="edit-train-sets-col">
                        <label>セット</label>
                        <input type="number" id="edit-train-sets" value="${rec.sets}" class="w-100" required>
                    </div>
                </div>
            `;
            setTimeout(() => {
                updateEditTrainingInputMode(rec.type);
                document.getElementById('edit-train-type')?.addEventListener('change', (e) => updateEditTrainingInputMode(e.target.value));
            }, 0);
        } else if (type === 'stats') {
            container.innerHTML += `
                <div class="form-group mb-3">
                    <label>日付</label>
                    <input type="date" id="edit-stat-date" value="${rec.date}" class="w-100" required>
                </div>
                <div class="form-group mb-3">
                    <label>項目</label>
                    <select id="edit-stat-type" class="w-100" required>
                        ${buildItemTypeOptions('stats', rec.type)}
                    </select>
                </div>
                <div class="form-group mb-3">
                    <label>記録数値</label>
                    <input type="number" step="0.01" id="edit-stat-val" value="${rec.value}" class="w-100" required>
                </div>
            `;
            setTimeout(() => {
                updateEditStatsInputMode(rec.type);
                document.getElementById('edit-stat-type')?.addEventListener('change', (e) => updateEditStatsInputMode(e.target.value));
            }, 0);
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
        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');

        if (role !== 'master') {
            const records = await window.fbGetRecords(storeKey, currentUserId);
            const targetRecord = records.find(r => r.id == id);
            if (!targetRecord || targetRecord.playerId !== currentUserId) {
                alert('他のユーザーの履歴は更新できません。');
                return;
            }
        }
        
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
            const isSingleValueMode = getRecordInputConfig('training', updatedData.type).mode !== 'weight';
            updatedData.reps = isSingleValueMode ? 1 : parseInt(document.getElementById('edit-train-reps').value);
            updatedData.sets = isSingleValueMode ? 1 : parseInt(document.getElementById('edit-train-sets').value);
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
        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');
        if (role !== 'master') {
            const records = await window.fbGetRecords(storeKey, currentUserId);
            const targetRecord = records.find(r => r.id == id);
            if (!targetRecord || targetRecord.playerId !== currentUserId) {
                alert('他のユーザーの履歴は削除できません。');
                return;
            }
        }
        
        await window.fbDeleteRecord(storeKey, id);
        
        await renderHistory();
        await updateDashboard();
    };

    function toDateKey(value) {
        if (!value) return '';
        return String(value).slice(0, 10);
    }

    async function buildCommentLandmarkSet(records, role, currentUserId) {
        const playerIds = [...new Set(records.map(r => r.playerId).filter(Boolean))];
        if (role !== 'master' && currentUserId) {
            playerIds.splice(0, playerIds.length, currentUserId);
        }

        const landmarkSet = new Set();
        await Promise.all(playerIds.map(async (playerId) => {
            try {
                const comments = await window.fbGetComments(playerId);
                comments.forEach(comment => {
                    const dateKey = toDateKey(comment.date);
                    if (dateKey) landmarkSet.add(`${playerId}|${dateKey}`);
                });
            } catch (err) {
                console.warn('Failed to load comments for history landmarks:', err);
            }
        }));
        return landmarkSet;
    }

    function getHistoryRecordTypeText(record, histType) {
        if (histType === 'weight') return '体組成';
        return record.type || '';
    }

    function getHistoryRecordDisplay(record, histType) {
        if (histType === 'weight') {
            return {
                dataType: '体重',
                item: '体組成',
                value1: record.weight,
                value2: record.bodyFat || '',
                value3: '',
                memo: record.memo || '',
                label: `${record.date} - 体重: ${record.weight}kg${record.bodyFat ? ` / 体脂肪: ${record.bodyFat}%` : ''}`
            };
        }
        if (histType === 'training') {
            const unit = getTrainingValueUnit(record.type);
            const isSingleValueMode = getRecordInputConfig('training', record.type).mode !== 'weight';
            return {
                dataType: 'トレーニング',
                item: record.type,
                value1: `${record.weight}${unit}`,
                value2: isSingleValueMode ? '' : record.reps,
                value3: isSingleValueMode ? '' : record.sets,
                memo: record.otherMemo || '',
                label: formatTrainingRecordLabel(record)
            };
        }
        return {
            dataType: '野球指標',
            item: record.type,
            value1: record.value,
            value2: '',
            value3: '',
            memo: record.otherMemo || '',
            label: `${record.date} - ${record.type}: ${record.value}`
        };
    }

    function filterHistoryRecords(records, players, histType) {
        const nameTerm = (histSearchName?.value || '').trim().toLocaleLowerCase('ja-JP');
        const typeTerm = (histSearchType?.value || '').trim().toLocaleLowerCase('ja-JP');

        return records.filter(record => {
            const player = players.find(p => p.id === record.playerId);
            const playerName = (player?.name || '').toLocaleLowerCase('ja-JP');
            const typeText = getHistoryRecordTypeText(record, histType).toLocaleLowerCase('ja-JP');
            return (!nameTerm || playerName.includes(nameTerm)) &&
                (!typeTerm || typeText.includes(typeTerm));
        });
    }

    async function getCurrentHistoryDataset() {
        const role = localStorage.getItem('userRole') || 'player';
        const currentUserId = localStorage.getItem('currentPlayerId');
        
        if (role === 'player' && !currentUserId) {
            return { records: [], players: [], role, currentUserId, needsLogin: true };
        }

        let storeKey = currentHistType === 'weight' ? 'weightRecords' : (currentHistType === 'training' ? 'trainingRecords' : 'statsRecords');
        const queryId = role === 'master' ? null : currentUserId;
        let records = await window.fbGetRecords(storeKey, queryId);
        if (role !== 'master') {
            records = records.filter(r => r.playerId === currentUserId);
        }
        const players = await loadPlayers();
        records = filterHistoryRecords(records, players, currentHistType);
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        return { records, players, role, currentUserId, needsLogin: false };
    }

    async function renderHistory() {
        const listEl = document.getElementById('history-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const { records, players, role, currentUserId, needsLogin } = await getCurrentHistoryDataset();
        if (needsLogin) {
            listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">選手を選択してください</p>';
            return;
        }
        const commentLandmarks = await buildCommentLandmarkSet(records, role, currentUserId);

        if (records.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">記録がありません</p>';
            return;
        }

        records.forEach(r => {
            const player = players.find(p => p.id === r.playerId);
            const playerNameText = player ? player.name : '不明な選手';
            
            const li = document.createElement('li');
            li.className = 'player-item';
            
            const display = getHistoryRecordDisplay(r, currentHistType);
            let label = display.label;
            
            if (role === 'master') {
                label = `【${playerNameText}】 ` + label;
            }
            const hasComment = commentLandmarks.has(`${r.playerId}|${toDateKey(r.date)}`);
            const commentLandmark = hasComment
                ? '<span title="この日のコメントあり" style="color:var(--accent-orange); margin-right:8px;"><i class="fa-solid fa-location-dot"></i></span>'
                : '';

            li.innerHTML = `
                <span>${commentLandmark}${label}</span>
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

    histExportCsvBtn?.addEventListener('click', async () => {
        try {
            const { records, players, needsLogin } = await getCurrentHistoryDataset();
            if (needsLogin) {
                alert('ログインしてからご利用ください。');
                return;
            }
            if (records.length === 0) {
                alert('出力対象の履歴がありません。');
                return;
            }

            const playerMap = {};
            players.forEach(p => playerMap[p.id] = p.name);
            let csvContent = 'データタイプ,名前,日付,種目/項目,値1(体重/重量/記録),値2(体脂肪/回数),値3(セット数),メモ\n';
            records.forEach(record => {
                const display = getHistoryRecordDisplay(record, currentHistType);
                const name = playerMap[record.playerId] || '不明';
                csvContent += `${display.dataType},${name},${record.date},${display.item},${display.value1},${display.value2},${display.value3},"${String(display.memo).replace(/"/g, '""')}"\n`;
            });

            const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `history_${currentHistType}_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('History CSV Export Failed:', err);
            alert('履歴CSV出力に失敗しました。');
        }
    });

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
        
        await loadItemSettings();
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

    function collectSelectValues(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return [];
        return Array.from(select.options)
            .map(option => option.value || option.textContent.trim())
            .filter(value => value && value !== 'その他' && !value.includes('選択'));
    }

    function getRankingSort(typeName) {
        return /秒|走/.test(typeName) ? 'asc' : 'desc';
    }

    function isRankableType(typeName) {
        return Boolean(typeName) && typeName !== 'その他' && !String(typeName).includes('選択');
    }

    function buildRankingCategories(stats, trainings) {
        const statTypes = new Set([
            ...collectSelectValues('stat-type'),
            ...collectSelectValues('stats-chart-type'),
            ...stats.map(r => r.type).filter(isRankableType)
        ]);
        const trainingTypes = new Set([
            ...collectSelectValues('train-type'),
            ...collectSelectValues('training-chart-type'),
            ...trainings.map(r => r.type).filter(isRankableType)
        ]);

        const categories = [];
        statTypes.forEach(typeName => {
            categories.push({
                id: `stats:${typeName}`,
                title: `野球指標: ${typeName}`,
                type: 'stats',
                target: typeName,
                sort: getRankingSort(typeName)
            });
        });
        trainingTypes.forEach(typeName => {
            categories.push({
                id: `training:${typeName}`,
                title: `ウエイト: ${typeName}`,
                type: 'training',
                target: typeName,
                sort: getRankingSort(typeName)
            });
        });
        return categories;
    }

    function syncRankingCategoryOptions(categories, selectedCatId) {
        if (!rankingCategorySelect) return categories[0]?.id || '';
        const nextSelected = categories.some(cat => cat.id === selectedCatId)
            ? selectedCatId
            : categories[0]?.id || '';

        rankingCategorySelect.innerHTML = categories.map(cat => (
            `<option value="${cat.id}" ${cat.id === nextSelected ? 'selected' : ''}>${cat.title}</option>`
        )).join('');
        return nextSelected;
    }

    window.updateRanking = async function() {
        const view = document.getElementById('ranking-single-view');
        if (!view) return;
        
        const period = rankingPeriodSelect ? rankingPeriodSelect.value : 'all';
        const selectedCatId = rankingCategorySelect ? rankingCategorySelect.value : '';
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

        const categories = buildRankingCategories(stats, trainings);
        const activeCatId = syncRankingCategoryOptions(categories, selectedCatId);
        const cat = categories.find(c => c.id === activeCatId);
        if (!cat) return;

        const bests = []; 
        
        players.forEach(p => {
            let pRecords = [];
            if (cat.type === 'stats') {
                pRecords = stats.filter(r => r.playerId === p.id && r.type === cat.target && isInPeriod(r.date));
            } else {
                pRecords = trainings.filter(r => r.playerId === p.id && r.type === cat.target && isInPeriod(r.date));
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

        let listHtml = '';
        if (bests.length === 0) {
            listHtml = '<div style="padding:40px 16px; text-align:center; color:var(--text-secondary); font-size:1rem;">該当する記録がありません</div>';
        } else {
            bests.forEach((item, index) => {
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
                            <div style="font-weight:bold; color:var(--accent-orange); font-size:1.5rem; letter-spacing: -0.5px;">${item.val}${cat.type === 'training' ? getTrainingValueUnit(cat.target) : ''}</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">${item.date}${cat.sort === 'asc' ? ' / 低いほど上位' : ''}</div>
                        </div>
                    </div>
                `;
            });
        }

        view.innerHTML = `
            <div class="glass" style="border-radius:var(--border-radius); overflow:hidden; background:rgba(255,255,255,0.03);">
                <div style="padding: 16px; border-bottom: 2px solid var(--border-glass); font-weight: bold; font-size: 1.2rem; color: var(--text-primary); text-align:center;">
                    ${cat.title} <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: normal; margin-left:8px;">全順位</span>
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
                    const unit = getTrainingValueUnit(t.type);
                    const reps = isMedicineBallType(t.type) ? '' : t.reps;
                    const sets = isMedicineBallType(t.type) ? '' : t.sets;
                    csvContent += `トレーニング,${name},${t.date},${t.type},${t.weight}${unit},${reps},${sets},\n`;
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
        
        if (!currentUserId) {
            alert('ログインしてからご利用ください。');
            return;
        }

        const players = await loadPlayers();
        const currentPlayer = players.find(p => p.id == currentUserId);
        if (!currentPlayer) return;

        // Populate Form
        document.getElementById('settings-name').value = currentPlayer.name || '';
        document.getElementById('settings-grade').value = currentPlayer.grade || (role === 'master' ? 'スタッフ/その他' : '大1');
        document.getElementById('settings-position').value = currentPlayer.position || '';
        document.getElementById('settings-number').value = currentPlayer.number || '';
        document.getElementById('settings-goal').value = currentPlayer.goal || '';
        
        document.getElementById('settings-avatar-style').value = currentPlayer.avatarStyle || (role === 'master' ? 'bottts' : 'avataaars');
        document.getElementById('settings-avatar-seed').value = currentPlayer.avatarSeed || currentPlayer.id;
        pendingAvatarDataUrl = currentPlayer.avatarDataUrl || null;
        
        updateAvatarPreview();

        // Theme Colors
        const currentTheme = currentPlayer.themeColor || (role === 'master' ? 'orange' : 'blue');
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
            if ((localStorage.getItem('userRole') || 'player') === 'master') {
                localStorage.setItem('masterName', updatedData.name || 'マスター');
            }
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

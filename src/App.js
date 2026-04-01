// frontend/src/App.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import BoardMap from './components/BoardMap';
import PeripheralMenu from './components/PeripheralMenu';
import {
  apiFetch,
  API_BASE,
  getStoredToken,
  getStoredUser,
  setStoredAuth,
  clearStoredAuth,
} from './api';

// Описание периферии с цветами (можно скорректировать цвета)
const peripherals = [
  { name: 'Кнопки', pins: ['22','24','26','28','30','32','34','36','38','40','42','44'], color: '#FF7043' }, // orange
  { name: 'LED', pins: ['led1','led2','led3','led4','led5','led6','led7','RGB1','RGB2','RGB3'], color: '#FFEB3B' }, // yellow
  { name: 'Семисегментный дисплей', pins: ['A','B','C','D','E','F','G','DP','DIG1','DIG2','DIG3','DIG4'], color: '#4FC3F7' }, // light blue
  { name: 'Сервопривод', pins: ['serv1'], color: '#A1887F' } // brown/steel
];

const de10PinsLeft = [
  'V10','V9','V8','V7','W6','5V','W5','AA14','W12','AB12','AB11','AB10','AA9','AA8','3.3V','AA7','AA6','AA5','AB3','AB2'
];
const de10PinsRight = [
  'W10','W9','W8','W7','V5','GND','AA15','W13','AB13','Y11','W11','AA10','Y8','Y7','GND2','Y6','Y5','Y4','Y3','AA2'
];
const nonInteractivePins = ['5V', '3.3V', 'GND', 'GND2'];
const powerPinsHighlightColor = '#E91E63';
const buildDefaultPeripheralLimits = () => Object.fromEntries(peripherals.map(peripheral => [peripheral.name, peripheral.pins.length]));

function App() {
  const [currentPage, setCurrentPage] = useState(() => window.location.pathname || '/');
  const [authUser, setAuthUser] = useState(() => getStoredUser());
  const [authError, setAuthError] = useState('');
  const [adminDe10File, setAdminDe10File] = useState(null);
  const [adminPerifFile, setAdminPerifFile] = useState(null);
  const [adminUploadStatus, setAdminUploadStatus] = useState('');
  const [peripheralLimits, setPeripheralLimits] = useState(buildDefaultPeripheralLimits);
  const [labLimitValues, setLabLimitValues] = useState(buildDefaultPeripheralLimits);
  const [labValidationError, setLabValidationError] = useState('');
  const [labExportStatus, setLabExportStatus] = useState('');

  // State
  const [connections, setConnections] = useState([]); // { peripheral, peripheralPin, de10Pin }
  const [showPeripheralMenu, setShowPeripheralMenu] = useState(false);
  const [selectedPeripheral, setSelectedPeripheral] = useState(null); // { peripheral, peripheralPin }
  const [selectedDe10, setSelectedDe10] = useState(null);
  const [pendingDe10Pin, setPendingDe10Pin] = useState(null);

  // SOF upload / files
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [sofFiles, setSofFiles] = useState([]);
  const [selectedSof, setSelectedSof] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [schemeStatus, setSchemeStatus] = useState('');
  const schemeFileInputRef = useRef(null);

  const boardConfig = useMemo(() => ({
    name: 'DE10-Lite',
    leftPins: de10PinsLeft,
    rightPins: de10PinsRight
  }), []);

  // Peripheral color map for BoardMap legend
  const peripheralColorMap = useMemo(() => {
    const map = {};
    peripherals.forEach(p => map[p.name] = p.color);
    return map;
  }, []);

  // pinColorMap: de10Pin -> color (derived from connections)
  const pinColorMap = useMemo(() => {
    const m = {};
    connections.forEach(c => {
      const p = peripherals.find(pp => pp.name === c.peripheral);
      if (p && p.color) m[c.de10Pin] = p.color;
    });
    return m;
  }, [connections]);

  // pinTooltipMap: de10Pin -> connected peripheral name
  const pinTooltipMap = useMemo(() => {
    const m = {};
    connections.forEach(c => {
      m[c.de10Pin] = c.peripheral;
    });
    return m;
  }, [connections]);

  // ---- backend calls and helpers (copied/adapted from original) ----

  const getPeripheralPinLabel = (peripheralName, peripheralPin) => {
    if (peripheralName === 'Кнопки') {
      const idx = peripherals.find(p => p.name === 'Кнопки')?.pins.indexOf(peripheralPin);
      return idx !== undefined && idx >= 0 ? `Кнопка ${idx + 1}` : peripheralPin;
    }
    const match = String(peripheralPin).match(/(?:but|button)(\d+)/i);
    return match ? `Кнопка ${match[1]}` : peripheralPin;
  };

  // File upload
  const handleFileUpload = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (!file.name.toLowerCase().endsWith('.sof')) {
      setUploadStatus('Ошибка: поддерживаются только файлы формата .sof');
      return;
    }
    setUploadStatus('Загрузка...');
    try {
      const fm = new FormData();
      fm.append('file', file);
      const resp = await apiFetch('/api/pins/upload_sof', {
        method: 'POST',
        body: fm,
        auth: false,
      });
      const json = await resp.json();
      if (resp.ok) {
        setUploadStatus('Файл успешно загружен');
        fetchSofFiles();
      } else {
        setUploadStatus('Ошибка загрузки: ' + (json.error || 'unknown'));
      }
    } catch (e) {
      setUploadStatus('Ошибка: ' + e.message);
    }
  };

  const fetchSofFiles = async () => {
    try {
      const resp = await apiFetch('/api/pins/sof_files', { auth: false });
      const json = await resp.json();
      setSofFiles(json.files || []);
    } catch (e) {
      setSofFiles([]);
    }
  };

  useEffect(() => {
    fetchSofFiles();
    handleLoad();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    (async () => {
      try {
        const r = await apiFetch('/api/auth/me');
        const j = await r.json();
        if (!j.user) {
          clearStoredAuth();
          setAuthUser(null);
          return;
        }
        const u = { login: j.user.login, role: j.user.role };
        setAuthUser(u);
        setStoredAuth(token, u);
      } catch {
        clearStoredAuth();
        setAuthUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPage(path);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const login = String(formData.get('login') || '').trim();
    const password = String(formData.get('password') || '').trim();
    setAuthError('');
    try {
      const r = await apiFetch('/api/auth/login', {
        method: 'POST',
        json: { login, password },
        auth: false,
      });
      const j = await r.json();
      if (!r.ok) {
        setAuthError(j.error || 'Ошибка входа');
        return;
      }
      setStoredAuth(j.token, { login: j.login, role: j.role });
      setAuthUser({ login: j.login, role: j.role });
      if (j.role === 'admin') navigateTo('/admin');
      else if (j.role === 'lab_assistant') navigateTo('/lab');
      else navigateTo('/');
    } catch (e) {
      setAuthError(e.message || `Не удалось связаться с API (${API_BASE})`);
    }
  };

  const handleAdminDe10Change = (event) => {
    const file = event.target.files?.[0] || null;
    setAdminDe10File(file);
    setAdminUploadStatus('');
  };

  const handleAdminPerifChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAdminPerifFile(file);
    setAdminUploadStatus('');
  };

  const handleAdminUploadTables = async () => {
    if (!adminDe10File || !adminPerifFile) {
      setAdminUploadStatus('Нужны оба файла: de10lite.csv и perif.csv');
      return;
    }
    if (!adminDe10File.name.toLowerCase().endsWith('.csv') || !adminPerifFile.name.toLowerCase().endsWith('.csv')) {
      setAdminUploadStatus('Оба файла должны быть в формате .csv');
      return;
    }
    setAdminUploadStatus('Отправка…');
    try {
      const fd = new FormData();
      fd.append('de10lite', adminDe10File);
      fd.append('perif', adminPerifFile);
      const r = await apiFetch('/api/admin/upload_tables', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) {
        const detail = j.details ? ` ${JSON.stringify(j.details)}` : '';
        setAdminUploadStatus(`Ошибка: ${j.error || r.status}${detail}`);
        return;
      }
      setAdminUploadStatus('Таблицы успешно загружены на сервер.');
      setAdminDe10File(null);
      setAdminPerifFile(null);
    } catch (e) {
      setAdminUploadStatus(`Ошибка сети: ${e.message}`);
    }
  };

  const handleLabLimitChange = (peripheralName, rawValue) => {
    const peripheral = peripherals.find(item => item.name === peripheralName);
    if (!peripheral) return;

    if (rawValue === '') {
      setLabLimitValues(prev => ({ ...prev, [peripheralName]: '' }));
      return;
    }

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed)) return;

    const bounded = Math.min(peripheral.pins.length, Math.max(0, parsed));
    setLabLimitValues(prev => ({ ...prev, [peripheralName]: bounded }));
  };

  const applyLabLimits = async () => {
    const nextLimits = sanitizePeripheralLimits(labLimitValues);
    const hasInvalid = peripherals.some(peripheral => {
      const raw = labLimitValues[peripheral.name];
      return raw === '' || Number(raw) < 0 || Number(raw) > peripheral.pins.length;
    });
    if (hasInvalid) {
      setLabValidationError('Проверьте лимиты: только целые числа от 0 до максимума для каждого типа периферии.');
      return;
    }

    const disabled = peripherals.filter((p) => nextLimits[p.name] === 0).map((p) => p.name);
    setLabValidationError('');
    setLabExportStatus('');
    try {
      const r = await apiFetch('/api/pins/config', {
        method: 'POST',
        json: { peripheral_limits: nextLimits, disabled_peripherals: disabled },
      });
      const j = await r.json();
      if (!r.ok) {
        setLabValidationError(j.error || 'Не удалось сохранить лимиты на сервере');
        return;
      }
    } catch (e) {
      setLabValidationError(e.message || 'Ошибка сети');
      return;
    }

    setPeripheralLimits(nextLimits);
    setLabLimitValues(nextLimits);
    setConnections((prev) => enforcePeripheralLimits(prev, nextLimits));
    setLabExportStatus('Лимиты сохранены на сервере.');
  };

  const exportLabConfig = () => {
    const nextLimits = sanitizePeripheralLimits(labLimitValues);
    const configToExport = {
      version: 1,
      type: 'lab-peripheral-limits',
      createdBy: 'lab',
      createdAt: new Date().toISOString(),
      peripheralLimits: nextLimits
    };

    const json = JSON.stringify(configToExport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lab-peripheral-limits.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setLabExportStatus('Файл конфигурации лаборанта выгружен.');
  };

  const handleProgramDe10 = async () => {
    if (!selectedSof) return;
    setUploadStatus('Программирование...');
    try {
      const resp = await apiFetch('/api/pins/program_de10', {
        method: 'POST',
        json: { sof_path: selectedSof },
        auth: false,
      });
      const json = await resp.json();
      if (resp.ok) setUploadStatus('Плата DE10 успешно прошита!');
      else setUploadStatus('Ошибка прошивки: ' + (json.error || 'Неизвестная ошибка'));
    } catch (e) {
      setUploadStatus('Ошибка: ' + e.message);
    }
  };

  // Save: POST config, GET verilog, POST program
  const handleSave = async () => {
    const connectionsArr = connections.map(({ de10Pin, peripheralPin }) => [de10Pin, peripheralPin]);
    try {
      setSaveStatus('Сохранение конфигурации...');
      const saveResp = await apiFetch('/api/pins/config', {
        method: 'POST',
        json: { connections: connectionsArr },
        auth: false,
      });
      if (!saveResp.ok) throw new Error('Failed to save configuration');

      setSaveStatus('Генерация Verilog...');
      const verilogResp = await apiFetch('/api/pins/verilog', { auth: false });
      const verilogData = await verilogResp.json();
      console.log('verilog', verilogData.verilog_code);

      setSaveStatus('Программирование FPGA...');
      const programResp = await apiFetch('/api/pins/program', { method: 'POST', auth: false });
      const programJson = await programResp.json();
      if (programResp.ok) {
        alert('Конфигурация успешно применена!');
      } else {
        throw new Error(programJson.error || 'Failed to program FPGA');
      }
    } catch (e) {
      alert('Ошибка применения конфигурации: ' + e.message);
    } finally {
      setSaveStatus('');
    }
  };

  const normalizeImportedConnections = (importedConnections) => importedConnections
    .map(connection => {
      if (Array.isArray(connection) && connection.length === 2) {
        const [de10Pin, peripheralPin] = connection;
        const foundPeripheral = peripherals.find(peripheral => peripheral.pins.includes(peripheralPin));
        return {
          de10Pin,
          peripheralPin,
          peripheral: foundPeripheral?.name || ''
        };
      }

      if (
        connection
        && typeof connection === 'object'
        && typeof connection.de10Pin === 'string'
        && typeof connection.peripheralPin === 'string'
      ) {
        const foundPeripheral = connection.peripheral
          ? peripherals.find(peripheral => peripheral.name === connection.peripheral)
          : peripherals.find(peripheral => peripheral.pins.includes(connection.peripheralPin));

        return {
          de10Pin: connection.de10Pin,
          peripheralPin: connection.peripheralPin,
          peripheral: foundPeripheral?.name || ''
        };
      }

      return null;
    })
    .filter(Boolean);

   const sanitizePeripheralLimits = (limitsCandidate = {}) => {
    const nextLimits = {};
    peripherals.forEach(peripheral => {
      const maxPins = peripheral.pins.length;
      const raw = limitsCandidate?.[peripheral.name];
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        nextLimits[peripheral.name] = maxPins;
        return;
      }
      const rounded = Math.floor(parsed);
      nextLimits[peripheral.name] = Math.min(maxPins, Math.max(0, rounded));
    });
    return nextLimits;
  };

  const enforcePeripheralLimits = (connectionsToCheck, limits) => {
    const usedByPeripheral = {};
    return connectionsToCheck.filter(connection => {
      const max = limits[connection.peripheral];
      if (!Number.isInteger(max)) return true;
      const used = usedByPeripheral[connection.peripheral] || 0;
      if (used >= max) return false;
      usedByPeripheral[connection.peripheral] = used + 1;
      return true;
    });
  };

  // Load config
  const handleLoad = async () => {
    try {
      const resp = await apiFetch('/api/pins/config', { auth: false });
      const data = await resp.json();
      const importedConnections = Array.isArray(data.connections) ? data.connections : [];
      setConnections(normalizeImportedConnections(importedConnections));
      if (data.peripheral_limits && typeof data.peripheral_limits === 'object') {
        const sanitized = sanitizePeripheralLimits(data.peripheral_limits);
        setPeripheralLimits(sanitized);
        setLabLimitValues(sanitized);
      }
    } catch (e) {
      console.error('Error loading config', e);
    }
  };

  const exportConnections = () => {
    const usedPeripherals = peripherals
      .map(peripheral => ({
        ...peripheral,
        usedPins: connections
          .filter(connection => connection.peripheral === peripheral.name)
          .map(connection => connection.peripheralPin)
      }))
      .filter(peripheral => peripheral.usedPins.length > 0);

    const configToExport = {
      version: 1,
      board: boardConfig,
      peripherals: usedPeripherals,
      connections: connections.map(({ de10Pin, peripheralPin, peripheral }) => ({
        de10Pin,
        peripheral,
        peripheralPin
      }))
    };

    const json = JSON.stringify(configToExport, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fpga-scheme.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportConnections = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importedConnections = Array.isArray(parsed.connections) ? parsed.connections : [];
        const importedLimits = sanitizePeripheralLimits(parsed.peripheralLimits || parsed.laborantLimits || {});
        const normalizedConnections = normalizeImportedConnections(importedConnections);
        const limitedConnections = enforcePeripheralLimits(normalizedConnections, importedLimits);

        setPeripheralLimits(importedLimits);
        setLabLimitValues(importedLimits);
        setConnections(limitedConnections);
        setSelectedPeripheral(null);
        setSelectedDe10(null);
        if (limitedConnections.length !== normalizedConnections.length) {
          setSchemeStatus('Схема загружена, но часть связей отключена из-за лимитов лаборанта');
        } else {
          setSchemeStatus('Схема и лимиты успешно загружены из файла');
        }
      } catch (error) {
        setSchemeStatus('Ошибка загрузки схемы: неверный JSON файл');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const openSchemeImportDialog = () => {
    schemeFileInputRef.current?.click();
  };

  const canUsePeripheralPin = (peripheralName, peripheralPin) => {
    const maxAllowed = peripheralLimits[peripheralName];
    if (!Number.isInteger(maxAllowed)) return true;
    const isAlreadyConnected = connections.some(
      connection => connection.peripheral === peripheralName && connection.peripheralPin === peripheralPin
    );
    if (isAlreadyConnected) return true;
    const usedCount = connections.filter(connection => connection.peripheral === peripheralName).length;
    return usedCount < maxAllowed;
  };

  // ---- Board/Peripheral logic ----

  const onPeripheralPinSelected = (peripheralName, peripheralPin) => {
    if (!canUsePeripheralPin(peripheralName, peripheralPin)) {
      setSchemeStatus(`Лимит для «${peripheralName}» исчерпан. Обратитесь к лаборанту или загрузите другую схему.`);
      return;
    }
    if (pendingDe10Pin) {
      setConnections(prev => {
        const filtered = prev.filter(c =>
          !(c.peripheral === peripheralName && c.peripheralPin === peripheralPin)
          && !(c.de10Pin === pendingDe10Pin)
        );
        filtered.push({
          peripheral: peripheralName,
          peripheralPin,
          de10Pin: pendingDe10Pin
        });
        return filtered;
      });
      setSelectedPeripheral(null);
      setSelectedDe10(pendingDe10Pin);
      setPendingDe10Pin(null);
      setShowPeripheralMenu(false);
      return;
    }
    setSelectedPeripheral({ peripheral: peripheralName, peripheralPin });
      setSelectedDe10(null);
      setPendingDe10Pin(null);
      setShowPeripheralMenu(false);
      setSchemeStatus('');
  };

  const handleBoardPinClick = (de10Pin) => {
    if (nonInteractivePins.includes(de10Pin)) return;

    if (selectedPeripheral) {
      if (!canUsePeripheralPin(selectedPeripheral.peripheral, selectedPeripheral.peripheralPin)) {
        setSchemeStatus(`Лимит для «${selectedPeripheral.peripheral}» исчерпан. Подключение недоступно.`);
        setSelectedPeripheral(null);
        return;
      }
      setConnections(prev => {
        // remove any existing that matches peripheral+pin or de10Pin
        const filtered = prev.filter(c =>
          !(c.peripheral === selectedPeripheral.peripheral && c.peripheralPin === selectedPeripheral.peripheralPin)
          && !(c.de10Pin === de10Pin)
        );
        filtered.push({
          peripheral: selectedPeripheral.peripheral,
          peripheralPin: selectedPeripheral.peripheralPin,
          de10Pin
        });
        return filtered;
      });
      setSelectedPeripheral(null);
      setSelectedDe10(de10Pin);
      setPendingDe10Pin(null);
    } else {
      // no peripheral selected: if pin occupied -> remove, else just select/highlight
      const existing = connections.find(c => c.de10Pin === de10Pin);
      if (existing) {
        setConnections(prev => prev.filter(c => c.de10Pin !== de10Pin));
        setSelectedDe10(null);
        setPendingDe10Pin(null);
      } else {
        setSelectedDe10(de10Pin);
        setPendingDe10Pin(de10Pin);
        setShowPeripheralMenu(true);
      }
    }
  };

   if (currentPage === '/login') {
    return (
      <div className="app-container auth-page">
        <div className="auth-card">
          <h1>Вход в систему</h1>
          <p>Введите логин и пароль для доступа.</p>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label htmlFor="login">Логин</label>
            <input id="login" name="login" type="text" placeholder="admin или lab" required />

            <label htmlFor="password">Пароль</label>
            <input id="password" name="password" type="password" placeholder="Пароль из users.json на сервере" required />

            {authError && <div className="auth-error">{authError}</div>}

            <button className="compile-btn" type="submit">Войти</button>
            <button className="control-button" type="button" onClick={() => navigateTo('/')}>Вернуться на главную</button>
          </form>
        </div>
      </div>
    );
  }

  if (currentPage === '/admin') {
    if (authUser?.role !== 'admin') {
      return (
        <div className="app-container auth-page">
          <div className="auth-card">
            <h1>Доступ запрещён</h1>
            <p>Для страницы администратора выполните вход под пользователем admin.</p>
            <button className="compile-btn" type="button" onClick={() => navigateTo('/login')}>Перейти к входу</button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container auth-page">
        <div className="auth-card admin-card">
          <h1>Панель администратора</h1>
          <p>Загрузка таблиц коммутации на сервер: <code>de10lite.csv</code> и <code>perif.csv</code> (валидация на API).</p>

          <label className="file-upload-label" htmlFor="admin-de10-upload">de10lite.csv</label>
          <input
            id="admin-de10-upload"
            className="file-input"
            type="file"
            accept=".csv"
            onChange={handleAdminDe10Change}
          />
          {adminDe10File && <div className="upload-status success">de10lite: {adminDe10File.name}</div>}

          <label className="file-upload-label" htmlFor="admin-perif-upload" style={{ marginTop: 12 }}>perif.csv</label>
          <input
            id="admin-perif-upload"
            className="file-input"
            type="file"
            accept=".csv"
            onChange={handleAdminPerifChange}
          />
          {adminPerifFile && <div className="upload-status success">perif: {adminPerifFile.name}</div>}

          {adminUploadStatus && (
            <div className={`upload-status ${adminUploadStatus.includes('успеш') ? 'success' : adminUploadStatus.includes('Ошиб') ? 'error' : ''}`}>
              {adminUploadStatus}
            </div>
          )}

          <div className="admin-actions">
            <button className="compile-btn" type="button" onClick={handleAdminUploadTables}>
              Загрузить на сервер
            </button>
            <button className="compile-btn" type="button" onClick={() => navigateTo('/')}>На главную</button>
            <button
              className="control-button"
              type="button"
              onClick={() => {
                clearStoredAuth();
                setAuthUser(null);
                navigateTo('/login');
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === '/lab') {
    if (authUser?.role !== 'lab_assistant') {
      return (
        <div className="app-container auth-page">
          <div className="auth-card">
            <h1>Доступ запрещён</h1>
            <p>Для страницы лаборанта войдите под учётной записью с ролью лаборанта (логин <code>lab</code> по умолчанию).</p>
            <button className="compile-btn" type="button" onClick={() => navigateTo('/login')}>Перейти к входу</button>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container auth-page">
        <div className="auth-card admin-card">
          <h1>Панель лаборанта</h1>
          <p>Укажите, сколько устройств каждого типа должно остаться доступным пользователю (можно 0).</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {peripherals.map(peripheral => (
              <label key={peripheral.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
                <span>{peripheral.name} (макс. {peripheral.pins.length})</span>
                <input
                  type="number"
                  min={0}
                  max={peripheral.pins.length}
                  value={labLimitValues[peripheral.name]}
                  onChange={(event) => handleLabLimitChange(peripheral.name, event.target.value)}
                  style={{ width: 100, height: 36, borderRadius: 8, border: '1px solid #7e9dcc', padding: '0 10px' }}
                />
              </label>
            ))}
          </div>

          {labValidationError && <div className="auth-error">{labValidationError}</div>}
          {labExportStatus && <div className="upload-status success">{labExportStatus}</div>}

          <div className="admin-actions">
            <button className="compile-btn" type="button" onClick={applyLabLimits}>Применить лимиты</button>
            <button className="compile-btn" type="button" onClick={exportLabConfig}>Скачать конфиг</button>
            <button className="control-button" type="button" onClick={() => navigateTo('/')}>На главную</button>
            <button
              className="control-button"
              type="button"
              onClick={() => {
                clearStoredAuth();
                setAuthUser(null);
                navigateTo('/login');
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <button className="admin-entry-btn" type="button" onClick={() => navigateTo('/login')}>
        Вход для сотрудника
      </button>

      {/* Header with + and selected peripheral hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: '#ffffff' }}>FPGA Pin Map</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selectedPeripheral ? (
            <div style={{ color: '#fff', fontWeight: 600 }}>
              Выбрано: <span style={{ color: '#ffd54f' }}>{selectedPeripheral.peripheral} — {getPeripheralPinLabel(selectedPeripheral.peripheral, selectedPeripheral.peripheralPin)}</span>
              <span style={{ marginLeft: 10, fontWeight: 400, color: '#ddd' }}>(Нажмите пин платы чтобы подключить)</span>
            </div>
          ) : pendingDe10Pin ? (
            <div style={{ color: '#fff', fontWeight: 600 }}>
              Выбран пин платы: <span style={{ color: '#ffd54f' }}>{pendingDe10Pin}</span>
              <span style={{ marginLeft: 10, fontWeight: 400, color: '#ddd' }}>(Выберите пин периферии в открытом меню)</span>
            </div>
          ) : (
            <div style={{ color: '#ddd' }}>Периферию можно выбрать по +</div>
          )}
          <button className="export-btn" onClick={exportConnections}>Сохранить схему</button>
          <button className="export-btn" onClick={openSchemeImportDialog}>Загрузить схему</button>
          <input
            ref={schemeFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportConnections}
            style={{ display: 'none' }}
          />
          <button
            className="control-button"
            onClick={() => setShowPeripheralMenu(true)}
            title="Открыть меню периферии"
            style={{ fontSize: 18, padding: '6px 10px', borderRadius: 8 }}
          >
            +
          </button>
        </div>
      </div>

      {/* CENTER: BoardMap */}
      <BoardMap
        leftPins={de10PinsLeft}
        rightPins={de10PinsRight}
        pinColorMap={pinColorMap}
        pinTooltipMap={pinTooltipMap}
        peripheralColorMap={peripheralColorMap}
        nonInteractivePins={nonInteractivePins}
        nonInteractiveColor={powerPinsHighlightColor}
        selectedDe10={selectedDe10}
        onPinClick={handleBoardPinClick}
      />

      {/* BOTTOM: сохраняем оригинальную нижнюю панель функционала */}
      <div className="bottom-controls" style={{ marginTop: 18 }}>
        <div className="file-upload-container">
          <label className="file-upload-label" htmlFor="sof-upload">Выберите .sof файл</label>
          <input id="sof-upload" className="file-input" type="file" accept=".sof" onChange={handleFileUpload} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select value={selectedSof} onChange={e => setSelectedSof(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
              <option value="">Выберите .sof файл для прошивки</option>
              {sofFiles.map((f, idx) => <option key={idx} value={f}>{f}</option>)}
            </select>
            <button className="compile-btn" onClick={handleProgramDe10} disabled={!selectedSof}>Программировать</button>
          </div>

          <div style={{ marginTop: 8 }}>
            <div className={`upload-status ${uploadStatus.toLowerCase().includes('ошиб') ? 'error' : ''} ${uploadStatus.toLowerCase().includes('успеш') ? 'success' : ''}`}>
              {uploadStatus || 'Статус загрузки: —'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <button className="code-btn" onClick={handleSave} disabled={saveStatus !== ''}>{saveStatus || 'Save'}</button>
          <div className={`upload-status ${schemeStatus.toLowerCase().includes('ошиб') ? 'error' : ''} ${schemeStatus.toLowerCase().includes('успеш') ? 'success' : ''}`}>
            {schemeStatus || 'Статус схемы: —'}
          </div>
        </div>
      </div>

      {/* Peripheral menu modal */}
      <PeripheralMenu
        open={showPeripheralMenu}
        onClose={() => {
          setShowPeripheralMenu(false);
          setPendingDe10Pin(null);
        }}
        peripherals={peripherals}
        onSelectPeripheralPin={onPeripheralPinSelected}
        connections={connections}
        peripheralLimits={peripheralLimits}
      />
    </div>
  );
}

export default App;

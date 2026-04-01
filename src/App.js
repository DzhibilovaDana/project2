import React, { useState, useEffect } from 'react';
import './App.css';
import de10Image from './de10-lite.jpg';
import lampImg from './lamp.jpg';
import semiImg from './semi.jpg';
import servoImg from './servo.jpg';
import { useAuth } from './AuthContext';
import { apiFetch } from './api';

// Примерные данные периферий и их пинов (теперь из perif.csv)
const peripherals = [
  {
    name: 'Arduino MEGA',
    pins: ['22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42', '44'],
  },
  {
    name: 'LED-массив',
    pins: ['led1', 'led2', 'led3', 'led4', 'led5', 'led6', 'led7', 'RGB1', 'RGB2', 'RGB3'],
  },
  {
    name: 'Семисегментник',
    pins: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'DIG1', 'DIG2', 'DIG3', 'DIG4'],
  },
  {
    name: 'Сервопривод',
    pins: ['serv1'],
  },
];

// Пины DE10-Lite (разделение на левый и правый ряд, по 18 пинов)
const de10PinsLeft = [
  'V10', 'V9', 'V8', 'V7', 'W6', 'W5', 'AA14', 'W12', 'AB12', 'AB11', 'AB10', 'AA9', 'AA8', 'AA7', 'AA6', 'AA5', 'AB3', 'AB2'
];
const de10PinsRight = [
  'W10', 'W9', 'W8', 'W7', 'V5', 'AA15', 'W13', 'AB13', 'Y11', 'W11', 'AA10', 'Y8', 'Y7', 'Y6', 'Y5', 'Y4', 'Y3', 'AA2'
];

function App() {
  const { user, login, logout, isAdmin, isLab } = useAuth();
  const [selectedPin, setSelectedPin] = useState(null);
  const [connections, setConnections] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [code, setCode] = useState('');
  const [buttonStates, setButtonStates] = useState(
    Array.from({ length: 12 }, (_, i) => ({ id: `but${i + 1}`, pressed: false }))
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [sofFiles, setSofFiles] = useState([]);
  const [selectedSof, setSelectedSof] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [disabledPeripherals, setDisabledPeripherals] = useState([]); // для лаборанта
  const [adminUploadStatus, setAdminUploadStatus] = useState('');
  const [adminDe10File, setAdminDe10File] = useState(null);
  const [adminPerifFile, setAdminPerifFile] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await login(loginForm.login, loginForm.password);
      setShowLoginModal(false);
      setLoginForm({ login: '', password: '' });
    } catch (err) {
      setLoginError(err.message || 'Ошибка входа');
    }
  };

  const handleAdminUploadTables = async () => {
    if (!adminDe10File || !adminPerifFile) {
      setAdminUploadStatus('Выберите оба файла: de10lite.csv и perif.csv');
      return;
    }
    setAdminUploadStatus('Загрузка...');
    try {
      const fd = new FormData();
      fd.append('de10lite', adminDe10File);
      fd.append('perif', adminPerifFile);
      const r = await apiFetch('/admin/upload_tables', { method: 'POST', body: fd });
      const data = await r.json();
      if (r.ok) {
        setAdminUploadStatus('Таблицы загружены');
        setAdminDe10File(null);
        setAdminPerifFile(null);
      } else {
        setAdminUploadStatus(data.error + (data.details ? ': ' + data.details.join(', ') : ''));
      }
    } catch (err) {
      setAdminUploadStatus('Ошибка: ' + err.message);
    }
  };

  const togglePeripheralDisabled = (name) => {
    setDisabledPeripherals(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const isPeripheralEnabled = (name) => !disabledPeripherals.includes(name);

  const handlePinClick = (peripheralIdx, pinIdx) => {
    if (!isPeripheralEnabled(peripherals[peripheralIdx].name)) return;
    const peripheral = peripherals[peripheralIdx].name;
    const peripheralPin = peripherals[peripheralIdx].pins[pinIdx];
    
    // Проверяем, есть ли уже соединение для этого пина
    const existingConnection = connections.find(
      c => c.peripheral === peripheral && c.peripheralPin === peripheralPin
    );
    
    // Если соединение существует, удаляем его
    if (existingConnection) {
      setConnections(prev => prev.filter(
        c => !(c.peripheral === peripheral && c.peripheralPin === peripheralPin)
      ));
    } else {
      // Если соединения нет, показываем селектор для выбора нового пина
      setSelectedPin({ peripheralIdx, pinIdx });
      setShowSelector(true);
    }
  };

  const handleDe10PinSelect = (de10Pin) => {
    const { peripheralIdx, pinIdx } = selectedPin;
    const peripheral = peripherals[peripheralIdx].name;
    const peripheralPin = peripherals[peripheralIdx].pins[pinIdx];
    
    // Добавляем новое соединение
    setConnections((prev) => [
      ...prev.filter(
        (c) => !(c.peripheral === peripheral && c.peripheralPin === peripheralPin)
      ),
      { peripheral, peripheralPin, de10Pin },
    ]);
    setShowSelector(false);
    setSelectedPin(null);
  };

  const sendButtonState = async (buttonId, pressed) => {
    try {
      await fetch('http://localhost:5050/api/buttons/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buttonId, pressed })
      });
    } catch (error) {
      console.error('Ошибка отправки состояния кнопки:', error);
    }
  };

  const toggleButton = (buttonId) => {
    setButtonStates(prev =>
      prev.map(btn => {
        if (btn.id === buttonId) {
          const newPressed = !btn.pressed;
          sendButtonState(buttonId, newPressed);
          return { ...btn, pressed: newPressed };
        }
        return btn;
      })
    );
  };

  // Получить список занятых пинов DE10-lite
  const usedDe10Pins = connections.map((c) => c.de10Pin);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('Выбран файл:', file.name);
      
      // Проверяем расширение файла
      if (!file.name.toLowerCase().endsWith('.sof')) {
        console.log('Неверное расширение файла');
        setUploadStatus('Ошибка: поддерживаются только файлы формата .sof');
        return;
      }

      setSelectedFile(file);
      setUploadStatus('Загрузка...');

      try {
        // Создаем FormData для отправки файла
        const formData = new FormData();
        formData.append('file', file);
        console.log('Отправка файла на сервер...');

        // Отправляем файл на сервер
        const response = await fetch('http://localhost:5050/api/pins/upload_sof', {
          method: 'POST',
          body: formData,
        });

        console.log('Ответ сервера:', response.status);
        const result = await response.json();
        console.log('Результат:', result);

        if (response.ok) {
          setUploadStatus('Файл успешно загружен');
        } else {
          throw new Error(result.error || 'Ошибка загрузки файла');
        }
      } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        setUploadStatus('Ошибка загрузки файла: ' + error.message);
      }
    }
  };

  const fetchSofFiles = async () => {
    try {
      const filesResp = await fetch('http://localhost:5050/api/pins/sof_files');
      const filesData = await filesResp.json();
      setSofFiles(filesData.files || []);
    } catch (error) {
      setSofFiles([]);
    }
  };

  useEffect(() => {
    fetchSofFiles();
  }, [uploadStatus]); // обновлять список после загрузки

  const handleProgramDe10 = async () => {
    if (!selectedSof) return;
    setUploadStatus('Программирование...');
    try {
      const response = await fetch('http://localhost:5050/api/pins/program_de10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sof_path: selectedSof })
      });
      const result = await response.json();
      if (response.ok) {
        setUploadStatus('Плата DE10 успешно прошита!');
      } else {
        setUploadStatus('Ошибка прошивки: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      setUploadStatus('Ошибка при прошивке: ' + error.message);
    }
  };

  // Сохранить соединения в JSON
  const handleSave = async () => {
    // Исключаем соединения отключённой периферии (чтобы сохранялось для всех пользователей)
    const filtered = connections.filter(c => isPeripheralEnabled(c.peripheral));
    const connectionsArr = filtered.map(({ de10Pin, peripheralPin }) => [de10Pin, peripheralPin]);
    const payload = { connections: connectionsArr };
    if (disabledPeripherals.length > 0) {
      payload.disabled_peripherals = disabledPeripherals;
    }
    try {
      setSaveStatus('Сохранение конфигурации...');
      const saveResponse = await apiFetch('/pins/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!saveResponse.ok) {
        throw new Error('Failed to save configuration');
      }
      console.log('Configuration saved successfully');

      // 2. Генерация Verilog
      setSaveStatus('Генерация Verilog...');
      console.log('Generating Verilog...');
      const verilogResponse = await apiFetch('/pins/verilog');
      const verilogData = await verilogResponse.json();
      if (verilogData.verilog_code) {
        console.log('Generated Verilog code:', verilogData.verilog_code);
      } else {
        console.error('No Verilog code in response');
      }

      // 3. Программирование FPGA
      setSaveStatus('Программирование FPGA...');
      console.log('Programming FPGA...');
      const programResponse = await apiFetch('/pins/program', {
        method: 'POST'
      });
      const programData = await programResponse.json();
      
      if (programResponse.ok) {
        console.log('FPGA programming result:', programData.message);
        alert('Конфигурация успешно применена!');
      } else {
        console.error('FPGA programming error:', programData.error);
        throw new Error(programData.error || 'Failed to program FPGA');
      }
    } catch (error) {
      console.error('Error in save process:', error);
      alert('Ошибка применения конфигурации: ' + error.message);
    } finally {
      setSaveStatus('');
    }
  };

  // Загрузить соединения из JSON (только официальные имена)
  const handleLoad = async () => {
    try {
      const response = await apiFetch('/pins/config');
      const data = await response.json();
      if (Array.isArray(data.connections)) {
        const newConnections = data.connections.map(([de10Pin, peripheralPin]) => {
          let peripheral = '';
          for (const p of peripherals) {
            if (p.pins.includes(peripheralPin)) {
              peripheral = p.name;
              break;
            }
          }
          return { peripheral, peripheralPin, de10Pin };
        });
        setConnections(newConnections);
        if (Array.isArray(data.disabled_peripherals)) {
          setDisabledPeripherals(data.disabled_peripherals);
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      alert('Ошибка загрузки конфигурации');
    }
  };

  return (
    <div className="app-container">
      {/* Шапка: роли, вход, админ/лаборант */}
      <header className="app-header">
        <span className="role-badge">
          {user ? `${user.login} (${user.role === 'admin' ? 'Админ' : 'Лаборант'})` : 'Пользователь'}
        </span>
        {user ? (
          <button className="auth-btn" onClick={logout}>Выйти</button>
        ) : (
          <button className="auth-btn" onClick={() => setShowLoginModal(true)}>Войти (админ/лаборант)</button>
        )}
        {isAdmin && (
          <div className="admin-panel">
            <input type="file" accept=".csv" onChange={e => setAdminDe10File(e.target.files?.[0] || null)} />
            <input type="file" accept=".csv" onChange={e => setAdminPerifFile(e.target.files?.[0] || null)} />
            <button className="compile-btn small" onClick={handleAdminUploadTables} disabled={!adminDe10File || !adminPerifFile}>
              Загрузить таблицы
            </button>
            {adminUploadStatus && <span className="admin-status">{adminUploadStatus}</span>}
          </div>
        )}
      </header>

      {/* Модальное окно входа */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Вход (админ / лаборант)</h3>
            <form onSubmit={handleLogin}>
              <input type="text" placeholder="Логин" value={loginForm.login} onChange={e => setLoginForm(f => ({ ...f, login: e.target.value }))} required />
              <input type="password" placeholder="Пароль" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} required />
              {loginError && <div className="login-error">{loginError}</div>}
              <button type="submit" className="compile-btn">Войти</button>
              <button type="button" className="compile-btn" onClick={() => setShowLoginModal(false)}>Отмена</button>
            </form>
          </div>
        </div>
      )}

      {/* Видео окно */}
      <div className="video-container">
        <div className="video-placeholder">
          Видео трансляция
        </div>
      </div>

      {/* Кнопки управления и Arduino MEGA */}
      <div className={`peripheral-block ${!isPeripheralEnabled('Arduino MEGA') ? 'disabled' : ''}`} style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="but-arduino-grid" style={{ gridTemplateRows: '1fr 1fr' }}>
          {/* Первый ряд — круглые кнопки управления */}
          {buttonStates.map((btn, idx) => (
            <div className="but-arduino-cell" key={`but-cell-${btn.id}`}> 
              <button
                className={`control-button round ${btn.pressed ? 'pressed' : ''}`}
                onClick={() => toggleButton(btn.id)}
              >
                {btn.id}
              </button>
            </div>
          ))}
          {/* Второй ряд — пины Arduino MEGA */}
          {Array.from({ length: 12 }).map((_, idx) => {
            const pin = peripherals[0].pins[idx];
            if (!pin) return <div className="but-arduino-cell" key={`pin-cell-empty-${idx}`}></div>;
            const connected = connections.find(
              (c) => c.peripheral === 'Arduino MEGA' && c.peripheralPin === pin
            );
            return (
              <div className="but-arduino-cell" key={`pin-cell-${pin}`}> 
                <button
                  className={`pin-btn${connected ? ' connected' : ''}`}
                  onClick={() => handlePinClick(0, idx)}
                >
                  {pin}
                  {connected && <span className="de10-label">→ {connected.de10Pin}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="peripheral-title">Панель кнопок</div>
      </div>

      {/* Лаборант: чекбоксы отключения периферии */}
      {isLab && (
        <div className="lab-disable-panel">
          <span>Отключить периферию:</span>
          {peripherals.map(p => (
            <label key={p.name}>
              <input type="checkbox" checked={disabledPeripherals.includes(p.name)} onChange={() => togglePeripheralDisabled(p.name)} />
              {p.name}
            </label>
          ))}
        </div>
      )}

      {/* Остальные периферии */}
      <div className="peripherals-container">
        {peripherals.slice(1).map((peripheral, pIdx) => (
          <div className={`peripheral-row ${!isPeripheralEnabled(peripheral.name) ? 'disabled' : ''}`} key={peripheral.name}>
            {peripheral.name === 'LED-массив' && (
              <img src={lampImg} alt="LED-массив" className="peripheral-icon" />
            )}
            {peripheral.name === 'Семисегментник' && (
              <img src={semiImg} alt="Семисегментник" className="peripheral-icon" />
            )}
            {peripheral.name === 'Сервопривод' && (
              <img src={servoImg} alt="Сервопривод" className="peripheral-icon" />
            )}
            <div className="peripheral-block">
              <div className="pins-list">
                {peripheral.pins.map((pin, pinIdx) => {
                  const connected = connections.find(
                    (c) => c.peripheral === peripheral.name && c.peripheralPin === pin
                  );
                  return (
                    <div key={pin} className="pin-container">
                      <button
                        className={`pin-btn${connected ? ' connected' : ''}`}
                        onClick={() => handlePinClick(pIdx + 1, pinIdx)}
                      >
                        {pin}
                        {connected && <span className="de10-label">→ {connected.de10Pin}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="peripheral-title">{peripheral.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Нижняя панель управления */}
      <div className="bottom-controls">
        <div className="file-upload-container">
          <input
            type="file"
            id="file-upload"
            onChange={handleFileUpload}
            className="file-input"
            accept=".sof"
          />
          <label htmlFor="file-upload" className="file-upload-label">
            {selectedFile ? selectedFile.name : 'Выберите .sof файл'}
          </label>
          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.includes('Ошибка') ? 'error' : 'success'}`}>
              {uploadStatus}
            </div>
          )}
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <select
            value={selectedSof}
            onChange={e => setSelectedSof(e.target.value)}
            style={{marginBottom:8, minWidth:220}}
          >
            <option value="">Выберите .sof файл для прошивки</option>
            {sofFiles.map(f => (
              <option key={f} value={f}>{f.split('/').pop()}</option>
            ))}
          </select>
          <button 
            className="compile-btn" 
            onClick={handleProgramDe10}
            disabled={!selectedSof}
          >
            Программировать
          </button>
        </div>
        <button 
          className="compile-btn" 
          onClick={handleSave}
          disabled={saveStatus !== ''}
        >
          {saveStatus || 'Save'}
        </button>
        <button className="compile-btn" onClick={handleLoad}>Load</button>
      </div>

      {/* Модальное окно выбора пина DE10-Lite */}
      {showSelector && (
        <div className="de10-modal">
          <div className="de10-layout">
            <img src={de10Image} alt="DE10-Lite" className="de10-img-vertical" />
            <div className="de10-pins-scroll-area-fixed">
              {de10PinsLeft.map((pin, idx) => (
                <div className="de10-pin-row" key={pin + de10PinsRight[idx]}> 
                  <span className="de10-pin-label left">{pin}</span>
                  <button
                    className={`de10-pin-dot${(pin === '5V' || pin === '3.3V' || pin === 'GND') ? ' power' : ''}${connections.some(c => c.de10Pin === pin) ? ' used' : ''}`}
                    onClick={() => !connections.some(c => c.de10Pin === pin) && pin !== '5V' && pin !== '3.3V' && pin !== 'GND' && handleDe10PinSelect(pin)}
                    disabled={connections.some(c => c.de10Pin === pin) || pin === '5V' || pin === '3.3V' || pin === 'GND'}
                  />
                  <button
                    className={`de10-pin-dot${(de10PinsRight[idx] === '5V' || de10PinsRight[idx] === '3.3V' || de10PinsRight[idx] === 'GND') ? ' power' : ''}${connections.some(c => c.de10Pin === de10PinsRight[idx]) ? ' used' : ''}`}
                    onClick={() => !connections.some(c => c.de10Pin === de10PinsRight[idx]) && de10PinsRight[idx] !== '5V' && de10PinsRight[idx] !== '3.3V' && de10PinsRight[idx] !== 'GND' && handleDe10PinSelect(de10PinsRight[idx])}
                    disabled={connections.some(c => c.de10Pin === de10PinsRight[idx]) || de10PinsRight[idx] === '5V' || de10PinsRight[idx] === '3.3V' || de10PinsRight[idx] === 'GND'}
                  />
                  <span className="de10-pin-label right">{de10PinsRight[idx]}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="close-btn" onClick={() => setShowSelector(false)}>Отмена</button>
        </div>
      )}
    </div>
  );
}

export default App;

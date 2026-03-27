// frontend/src/components/PeripheralMenu.jsx
import React, { useState } from 'react';

/**
 * PeripheralMenu
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - peripherals: [{ name, pins: [], color }, ...]
 *  - onSelectPeripheralPin(peripheralName, pinName): fn
 *  - connections: [{ peripheral, peripheralPin, de10Pin }]
 */
export default function PeripheralMenu({
  open,
  onClose,
  peripherals = [],
  onSelectPeripheralPin = () => {},
  connections = [],
  peripheralLimits = {}
}) {
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (name) => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  if (!open) return null;

  const peripheralHasPinConnected = (peripheralName, pin) =>
    connections.some(c => c.peripheral === peripheralName && c.peripheralPin === pin);

  const getConnectedDe10 = (peripheralName, pin) => {
    const found = connections.find(c => c.peripheral === peripheralName && c.peripheralPin === pin);
    return found ? found.de10Pin : null;
  };

  const getPinLabel = (peripheralName, pin, index) => {
    if (peripheralName === 'Кнопки') {
      return `Кнопка ${index + 1}`;
    }
    const buttonMatch = String(pin).match(/(?:but|button)(\d+)/i);
    if (buttonMatch) return `Кнопка ${buttonMatch[1]}`;
    return pin;
  };
  const getConnectionPinLabel = (peripheralName, pin) => {
    if (peripheralName === 'Кнопки') {
      const idx = peripherals.find(p => p.name === 'Кнопки')?.pins.indexOf(pin);
      return idx !== undefined && idx >= 0 ? `Кнопка ${idx + 1}` : pin;
    }
    return getPinLabel(peripheralName, pin, 0);
  };

  const getConnectedCount = (peripheralName) => connections.filter(c => c.peripheral === peripheralName).length;
  const getPeripheralLimit = (peripheralName) => (
    Number.isInteger(peripheralLimits[peripheralName]) ? peripheralLimits[peripheralName] : null
  );

  return (
    <div className="modal-overlay" style={{ zIndex: 400 }}>
       <div className="modal-window peripheral-modal-window" style={{ maxWidth: 1000 }}>
        <button className="modal-close-x" onClick={onClose} aria-label="Закрыть меню">×</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title">Периферия</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ minWidth: 360 }}>
            {peripherals.map((p) => (
              <div key={p.name} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      display: 'inline-block',
                      width: 14, height: 14, borderRadius: 3,
                      background: p.color, boxShadow: '0 1px 6px rgba(0,0,0,0.25)'
                    }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#ffe600' }}>{p.name}</div>
                      {getPeripheralLimit(p.name) !== null && (
                        <div style={{ color: '#d6def2', fontSize: 12 }}>
                          Доступно: {getConnectedCount(p.name)} / {getPeripheralLimit(p.name)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <button
                      className="control-button"
                      onClick={() => toggleExpand(p.name)}
                      style={{ padding: '6px 10px', borderRadius: 6 }}
                    >
                      {expanded[p.name] ? '–' : '+'}
                    </button>
                  </div>
                </div>

                {expanded[p.name] && (
                  <div className="pins-list" style={{ marginTop: 8 }}>
                    {p.pins.map((pin, index) => {
                      const connected = peripheralHasPinConnected(p.name, pin);
                      const de10 = getConnectedDe10(p.name, pin);
                      const limit = getPeripheralLimit(p.name);
                      const disabledByLimit = !connected && limit !== null && getConnectedCount(p.name) >= limit;
                      return (
                        <div className="pin-container" key={`${p.name}-${pin}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <button
                            className={`pin-btn ${connected ? 'connected' : ''}`}
                            onClick={() => {
                              onSelectPeripheralPin(p.name, pin);
                            }}
                            title={pin}
                            disabled={disabledByLimit}
                            style={disabledByLimit ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                          >
                            {getPinLabel(p.name, pin, index)}
                          </button>
                          {connected && (
                            <div style={{ fontSize: 12, color: '#fff', opacity: 0.85 }}>
                              → {de10}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: '#ffe600', marginBottom: 8 }}>Текущие подключения</div>
            <div style={{ maxHeight: 240, overflow: 'auto', paddingRight: 8 }}>
              {connections.length === 0 && <div style={{ color: '#aaa' }}>Нет подключений</div>}
              {connections.map((c, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #222' }}>
                  <div style={{ color: '#fff' }}>{c.peripheral} — {getConnectionPinLabel(c.peripheral, c.peripheralPin)}</div>
                  <div style={{ color: '#ffe600' }}>{c.de10Pin}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, color: '#ffe600', marginBottom: 6 }}>Подсказка</div>
              <div style={{ color: '#ddd', fontSize: 13 }}>
                Нажмите свободный пин на плате, затем выберите пин периферии в этом меню — подключение выполнится автоматически.
                Если кликнуть по занятому пину платы (без выбора периферии), соединение удалится.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// frontend/src/components/BoardMap.jsx
import React, { useMemo, useState } from 'react';
import de10Image from '../de10-lite.jpg';

/**
 * BoardMap
 * Props:
 *  - leftPins: array of pin names (left column)
 *  - rightPins: array of pin names (right column)
 *  - pinColorMap: { pinName: '#rrggbb' }  // если пин задействован, его цвет
 *  - pinTooltipMap: { pinName: 'Peripheral Name' } // tooltip для подключенных пинов
 *  - peripheralColorMap: { peripheralName: '#rrggbb' }  // для легенды
 *  - selectedDe10: pinName
 *  - onPinClick(pinName)
 */
export default function BoardMap({
  leftPins = [],
  rightPins = [],
  pinColorMap = {},
  pinTooltipMap = {},
  peripheralColorMap = {},
  nonInteractivePins = [],
  nonInteractiveColor = '#d81b60',
  selectedDe10 = null,
  onPinClick = () => {}
}) {
  // helper: determine readable text color (black or white) based on background
  const [isHeaderFocusMode, setIsHeaderFocusMode] = useState(false);

  const getContrastColor = (hex) => {
    if (!hex) return '#fff';
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111' : '#fff';
  };

  const getPinInteractiveStyle = (pin) => {
    const isNonInteractive = nonInteractivePins.includes(pin);
    const color = pinColorMap[pin];
    const isSelected = selectedDe10 === pin;
    const baseColor = color || (isNonInteractive ? nonInteractiveColor : null);

    return {
      color: baseColor,
      isSelected,
      isNonInteractive,
      style: baseColor
        ? {
            background: baseColor,
            color: getContrastColor(baseColor),
            boxShadow: `0 0 0 2px rgba(255,255,255,0.22), 0 0 16px ${baseColor}99`,
            opacity: isNonInteractive ? 0.9 : 1
          }
        : undefined,
      tooltip: pinTooltipMap[pin] || (isNonInteractive ? `${pin} (питание/земля)` : pin)
    };
  };

  const renderPinButton = (pin) => {
    const { color, isSelected, style, tooltip, isNonInteractive } = getPinInteractiveStyle(pin);
    const className = `board-pin ${isSelected ? 'selected' : ''} ${color ? 'has-color' : ''} ${isNonInteractive ? 'non-interactive' : ''}`;
    

    return (
      <button
        key={pin}
        className={className}
        onClick={() => onPinClick(pin)}
        title={tooltip}
        style={style}
        disabled={isNonInteractive}
      >
        <span className="pin-label">{pin}</span>
      </button>
    );
  };

  const headerRows = useMemo(
    () => leftPins.map((leftPin, idx) => ({ leftPin, rightPin: rightPins[idx] })),
    [leftPins, rightPins]
  );

  const renderHeaderPin = (pin, compact = false) => {
    if (!pin) return <div className="header-pin-empty" aria-hidden="true" />;
    const { color, isSelected, style, tooltip, isNonInteractive } = getPinInteractiveStyle(pin);
    const className = [
      compact ? 'header-pin-dot compact' : 'header-pin-dot',
      color ? 'has-color' : '',
      isSelected ? 'selected' : '',
      isNonInteractive ? 'non-interactive' : ''
    ].join(' ');

    return (
      <button
        key={`${pin}-${compact ? 'compact' : 'full'}`}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onPinClick(pin);
        }}
        title={tooltip}
        style={style}
        aria-label={`Пин ${pin}`}
        disabled={isNonInteractive}
      >
        {!compact && <span>{pin}</span>}
      </button>
    );
  };

  return (
    <div className="board-container" aria-label="Board map">
      <div className={`board-inner ${isHeaderFocusMode ? 'header-focus' : ''}`}>
        {!isHeaderFocusMode && <div className="pins-column pins-left">{leftPins.map((p) => renderPinButton(p))}</div>}

        <div className="board-visual" role="img" aria-label="DE10 board image">
          {!isHeaderFocusMode ? (
            <div className="board-image-wrapper">
              <img src={de10Image} className="board-image" alt="DE10-Lite board" />
              <button
                type="button"
                className="board-header-hotspot"
                title="Открыть детальный вид пинов платы"
                aria-label="Открыть детальный вид пинов платы"
                onClick={() => setIsHeaderFocusMode(true)}
              >
                {headerRows.map((row, idx) => (
                  <div className="header-row-compact" key={`compact-row-${idx}`}>
                    {renderHeaderPin(row.leftPin, true)}
                    {renderHeaderPin(row.rightPin, true)}
                  </div>
                ))}
              </button>
            </div>
          ) : (
            <div className="header-focus-panel">
              <div className="header-focus-title-row">
                <h3>Пины разъёма DE10-Lite</h3>
                <button type="button" className="header-focus-close" onClick={() => setIsHeaderFocusMode(false)}>
                  Назад к фото
                </button>
              </div>
              <div className="header-focus-grid" role="group" aria-label="Детальный вид пинов разъёма">
                {headerRows.map((row, idx) => (
                  <div className="header-row" key={`row-${idx}`}>
                    <div className="header-pin-cell">{renderHeaderPin(row.leftPin)}</div>
                    <div className="header-pin-cell">{renderHeaderPin(row.rightPin)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isHeaderFocusMode && <div className="pins-column pins-right">{rightPins.map((p) => renderPinButton(p))}</div>}
      </div>

      <div className="board-legend" aria-hidden="false">
        {Object.keys(peripheralColorMap).length === 0 ? (
          <div style={{ color: '#fff', opacity: 0.75 }}>No peripheral colors defined</div>
        ) : (
          Object.keys(peripheralColorMap).map((name) => (
            <div key={name} className="legend-item">
              <span className="legend-swatch" style={{ background: peripheralColorMap[name] }} />
              <span className="legend-name">{name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

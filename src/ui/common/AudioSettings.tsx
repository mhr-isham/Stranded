import { AUDIO_DEFAULTS, startAmbient } from '../../game/audio';
import type { Settings } from '../../game/store';
import { Toggle } from './widgets';

export function AudioSettings({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Toggle
        on={settings.sound}
        onChange={(sound) => {
          onChange({ ...settings, sound });
          if (sound) startAmbient();
        }}
        label="Sound"
      />
      {settings.sound &&
        (['musicVolume', 'effectsVolume'] as const).map((key) => (
          <label key={key} className="row between" style={{ gap: 12, fontSize: 13 }}>
            <span style={{ minWidth: 100 }}>{key === 'musicVolume' ? 'Music' : 'Sound effects'}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings[key] ?? AUDIO_DEFAULTS[key]}
              aria-label={key === 'musicVolume' ? 'Music volume' : 'Sound effects volume'}
              onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
              style={{ flex: 1, minWidth: 60 }}
            />
            <span style={{ minWidth: 36, textAlign: 'right' }}>{Math.round((settings[key] ?? AUDIO_DEFAULTS[key]) * 100)}%</span>
          </label>
        ))}
    </div>
  );
}

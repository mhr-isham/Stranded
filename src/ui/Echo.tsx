import { useGame } from '../game/store';
import { useTypewriter } from './Intro';

export function Echo() {
  const line = useGame((s) => s.echo[0]);
  const dismiss = useGame((s) => s.dismissEcho);
  if (!line) return null;
  return <EchoLineView key={line.id} text={line.text} mood={line.mood} onDone={dismiss} />;
}

function EchoLineView({ text, mood, onDone }: { text: string; mood?: string; onDone: () => void }) {
  const tw = useTypewriter(text, 70);
  return (
    <div className={`echo panel panel-pad ${mood === 'alert' ? 'alert' : ''}`} onClick={() => (tw.done ? onDone() : tw.finish())}>
      <div className="avatar" />
      <div style={{ flex: 1 }}>
        <div className="name">ECHO</div>
        <div className="text">{tw.shown}</div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn small primary" onClick={(e) => (e.stopPropagation(), tw.done ? onDone() : tw.finish())}>
            {tw.done ? 'Got it' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  );
}

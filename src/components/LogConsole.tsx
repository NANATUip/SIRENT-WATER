import React, { useEffect, useRef } from 'react';
import { GameLog } from '../types';
import { Terminal, Shield, Crosshair, HelpCircle, AudioLines, Radio } from 'lucide-react';

interface LogConsoleProps {
  logs: GameLog[];
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when logs update
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogStyle = (type: GameLog['type']) => {
    switch (type) {
      case 'alert':
        return 'text-red-400 bg-red-950/20 border-l-2 border-red-500 font-semibold animate-pulse';
      case 'warning':
        return 'text-amber-400 bg-amber-950/10 border-l-2 border-amber-500';
      case 'success':
        return 'text-emerald-400 bg-emerald-950/10 border-l-2 border-emerald-500';
      case 'info':
      default:
        return 'text-neutral-300 border-l-2 border-neutral-700';
    }
  };

  return (
    <div className="bg-neutral-950/85 backdrop-blur border border-neutral-800 rounded-xl p-3.5 font-mono flex flex-col h-full overflow-hidden min-h-0 relative shadow-inner" id="log-console-container">
      {/* Console Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2 text-xs text-neutral-500 shrink-0">
        <div className="flex items-center gap-1.5 font-bold tracking-wider">
          <Terminal className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>通信・ソナーログ端末 (TACTICAL LOGS)</span>
        </div>
        <span className="text-[10px] text-emerald-600/60 font-semibold animate-pulse">LIVE</span>
      </div>

      {/* Logs Scroll Window */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent min-h-[120px]"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-600 italic">
            水中ノイズ計測中... ログデータなし
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`p-1.5 text-xs rounded transition-all duration-150 ${getLogStyle(log.type)}`}
            >
              <span className="text-neutral-500 mr-2">[{log.timestamp}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Quick Operative Manual Sheet inside Logs HUD */}
      <div className="mt-3 pt-2.5 border-t border-neutral-900 grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
        <div className="space-y-1 flex flex-col justify-between">
          <div className="flex items-start gap-1">
            <AudioLines className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              <strong>パッシブ(聴音) [常時]</strong>:<br />
              敵の推進音の方向（方位線）のみを検知。静かに近づく手がかり。
            </span>
          </div>
          <div className="flex items-start gap-1">
            <Radio className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>アクティブ [PING]</strong>:<br />
              音波を放ち敵艦・魚雷を完全に映す。但し、自艦位置も敵に即バレする。
            </span>
          </div>
        </div>
        <div className="space-y-1 flex flex-col justify-between border-l border-neutral-900 pl-2">
          <div className="flex items-start gap-1">
            <Crosshair className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
            <span>
              <strong>誘導魚雷 [FIRE]</strong>:<br />
              レーダーをクリックした方向に魚雷を射出。敵の発する音にホーミング。
            </span>
          </div>
          <div className="flex items-start gap-1">
            <Shield className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>デコイ [DECOY]</strong>:<br />
              気泡音響源を放ち、迫りくる敵魚雷を引きつけて爆破回避する。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

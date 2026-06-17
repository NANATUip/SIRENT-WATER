import React from 'react';
import { Submarine, EngineSpeed } from '../types';
import { RotateCcw, RotateCw, Play, CircleDot, ChevronLeft, ChevronRight, Compass } from 'lucide-react';

interface ControlPanelProps {
  sub: Submarine;
  onSetSpeed: (speed: EngineSpeed) => void;
  onSetHeading: (heading: number) => void;
  onAdjustHeading: (delta: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  sub,
  onSetSpeed,
  onSetHeading,
  onAdjustHeading,
}) => {
  const speeds: { speed: EngineSpeed; jp: string; desc: string; color: string; hover: string }[] = [
    { 
      speed: 0, 
      jp: '全停止', 
      desc: '放射音0 / 感度MAX', 
      color: 'bg-white/10 text-slate-300 border-slate-500 font-semibold shadow-[0_0_8px_rgba(255,255,255,0.1)]', 
      hover: 'hover:bg-white/10' 
    },
    { 
      speed: 1, 
      jp: '無音微速', 
      desc: '極小音 / 探知されず', 
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' +
             ' shadow-[0_0_10px_rgba(52,211,153,0.2)]', 
      hover: 'hover:bg-emerald-500/10' 
    },
    { 
      speed: 2, 
      jp: '巡航速度', 
      desc: '通常速度 / 中音圧', 
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.15)]', 
      hover: 'hover:bg-amber-500/10' 
    },
    { 
      speed: 3, 
      jp: '急速戦速', 
      desc: '最高速 / 探知不可避', 
      color: 'bg-rose-500/20 text-rose-300 border-rose-500/35 border-dashed animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.2)]', 
      hover: 'hover:bg-rose-500/10' 
    }
  ];

  const presets = [
    { label: '北 0°', val: 0 },
    { label: '東 90°', val: 90 },
    { label: '南 180°', val: 180 },
    { label: '西 270°', val: 270 },
  ];

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-3 font-mono select-none shadow-[0_10px_30px_rgba(0,0,0,0.3)]" id="control-panel-root">
      {/* Engine Speed Orders */}
      <div className="mb-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
          機関速力発令 (ENGINE TELEGRAPH)
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {speeds.map((item) => {
            const isSelected = sub.speed === item.speed;
            return (
              <button
                key={item.speed}
                id={`btn-speed-${item.speed}`}
                onClick={() => onSetSpeed(item.speed)}
                className={`p-1.5 rounded-xl border text-[11px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected 
                    ? `${item.color} border-current font-bold scale-[1.01]` 
                    : `bg-white/5 text-slate-400 border-white/10 ${item.hover} scale-100`
                }`}
              >
                <span className="font-bold tracking-wide">{item.jp}</span>
                <span className="text-[8px] opacity-70 mt-0.5 text-center leading-none scale-90">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Steering Helm Controls */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center justify-between">
          <span>転舵指示 (STEERING WHEEL)</span>
          <span className="text-[8px] text-cyan-400 tracking-wider">HELM IDLE</span>
        </span>

        {/* Digital Compass Tape Mock visualizer */}
        <div className="bg-white/5 backdrop-blur px-2 py-1 rounded-xl border border-white/10 flex items-center justify-between mb-2.5 relative overflow-hidden h-7">
          <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none opacity-5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/30 to-cyan-500/0"></div>
          
          <div className="text-[8px] text-slate-500">◀</div>
          <div className="flex gap-3 overflow-hidden text-[9px] select-none text-slate-450 items-center">
            <span>{Math.round((sub.heading - 60 + 360) % 360)}°</span>
            <span className="text-cyan-500/40">{Math.round((sub.heading - 30 + 360) % 360)}°</span>
            <span className="text-cyan-350 font-bold bg-cyan-950/40 border border-cyan-550/30 px-1 py-0.5 rounded-md border-b border-b-cyan-400 text-[10px] shadow-[0_0_8px_rgba(34,211,238,0.2)]">
              {Math.round(sub.heading)}°
            </span>
            <span className="text-cyan-500/40">{Math.round((sub.heading + 30) % 360)}°</span>
            <span>{Math.round((sub.heading + 60) % 360)}°</span>
          </div>
          <div className="text-[8px] text-slate-500">▶</div>
        </div>

        {/* Port and Starboard rudder controls */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            id="btn-steer-left"
            onClick={() => onAdjustHeading(-15)}
            className="flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-bold text-cyan-400 bg-cyan-600/10 border border-cyan-500/25 rounded-xl hover:bg-cyan-600/20 active:scale-95 transition-all cursor-pointer"
            title="取り舵 (左に15度回頭)"
          >
            <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            <span>左操舵 (-15°)</span>
          </button>
          <button
            id="btn-steer-right"
            onClick={() => onAdjustHeading(15)}
            className="flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-bold text-rose-400 bg-rose-600/10 border border-rose-500/25 rounded-xl hover:bg-rose-600/20 active:scale-95 transition-all cursor-pointer"
            title="面舵 (右に15度回頭)"
          >
            <span>右操舵 (+15°)</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>

        {/* Quick presets compass directions */}
        <div className="flex gap-1">
          {presets.map((p) => {
            const isNear = Math.abs(sub.targetHeading - p.val) < 2;
            return (
              <button
                key={p.label}
                onClick={() => onSetHeading(p.val)}
                className={`flex-1 text-[9px] py-1 rounded-xl border transition-all cursor-pointer ${
                  isNear 
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400 font-bold' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

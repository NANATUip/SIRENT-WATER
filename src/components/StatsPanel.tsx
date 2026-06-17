import React from 'react';
import { Submarine, EngineSpeed } from '../types';
import { Shield, Zap, Wind, Navigation, Radio, Compass, AlertTriangle } from 'lucide-react';

interface StatsPanelProps {
  sub: Submarine;
  noiseLevel: number; // 0 to 100
  reloadProgress: number; // 0 to 100
  onSurface: () => void;
  canSurface: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  sub,
  noiseLevel,
  reloadProgress,
  onSurface,
  canSurface,
}) => {
  // Translate engine speed label
  const getSpeedLabel = (s: EngineSpeed) => {
    switch (s) {
      case 0: return { jp: '全停止 (Stop)', color: 'text-neutral-500' };
      case 1: return { jp: '無音微速 (Silent)', color: 'text-emerald-400 font-bold' };
      case 2: return { jp: '通常航行 (Standard)', color: 'text-amber-400' };
      case 3: return { jp: '急速戦速 (FLANK!)', color: 'text-rose-500 font-bold animate-pulse' };
    }
  };

  const speedInfo = getSpeedLabel(sub.speed);

  // Calculate battery percentage color
  const getProgressColor = (val: number) => {
    if (val < 25) return 'bg-rose-500 animate-pulse';
    if (val < 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 font-mono select-none" id="stats-panel-root">
      {/* 1. Hull Integrity Gauge */}
      <div 
        id="gauge-hull"
        className={`bg-neutral-900/80 backdrop-blur border ${
          sub.hull < 30 ? 'border-rose-500 animate-pulse ring-1 ring-rose-500/10' : 'border-neutral-800'
        } rounded-xl p-2.5 transition-all`}
      >
        <div className="flex justify-between items-center mb-1 text-[11px]">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>船体耐久 (HULL)</span>
          </span>
          <span className={sub.hull < 30 ? 'text-rose-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
            {Math.ceil(sub.hull)}%
          </span>
        </div>
        <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getProgressColor(sub.hull)}`}
            style={{ width: `${sub.hull}%` }}
          />
        </div>
      </div>

      {/* 2. Passive Noise Output Gauge */}
      <div id="gauge-noise" className="bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-xl p-2.5">
        <div className="flex justify-between items-center mb-1 text-[11px]">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>自艦ノイズ (ACOUSTIC)</span>
          </span>
          <span className={noiseLevel > 60 ? 'text-rose-400 font-bold' : 'text-cyan-400 font-bold'}>
            {Math.ceil(noiseLevel)} dB
          </span>
        </div>
        <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden flex">
          <div 
            className={`h-full transition-all duration-150 ${
              noiseLevel > 60 ? 'bg-rose-500' : noiseLevel > 30 ? 'bg-amber-400' : 'bg-cyan-500'
            }`}
            style={{ width: `${noiseLevel}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-neutral-500 mt-1 leading-none">
          <span>{noiseLevel > 60 ? '⚠️探知されやすい' : '🔇高ステルス維持中'}</span>
          <span className={noiseLevel > 60 ? 'text-rose-400 font-bold animate-pulse' : 'text-neutral-400'}>
            {noiseLevel > 60 ? '逆探知注意' : '隠密'}
          </span>
        </div>
      </div>

      {/* 3. Battery System */}
      <div id="gauge-battery" className="bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-xl p-2.5">
        <div className="flex justify-between items-center mb-1 text-[11px]">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>主蓄電池 (BATTERY)</span>
          </span>
          <span className="text-amber-400 font-bold">{Math.ceil(sub.battery)}%</span>
        </div>
        <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${sub.battery}%` }}
          />
        </div>
        <div className="text-[8px] text-neutral-500 mt-1 leading-none font-mono">
          {sub.isSurfaced ? (
            <span className="text-emerald-400 animate-pulse">⚡ 急速充電中 (Diesel Active)</span>
          ) : (
            <span>アクティブピン・デコイで消費</span>
          )}
        </div>
      </div>

      {/* 4. Oxygen Life Support */}
      <div id="gauge-oxygen" className="bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-xl p-2.5">
        <div className="flex justify-between items-center mb-1 text-[11px]">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <Wind className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>艦内酸素 (OXYGEN)</span>
          </span>
          <span className="text-sky-400 font-bold">{Math.ceil(sub.oxygen)}%</span>
        </div>
        <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-sky-500 transition-all duration-300"
            style={{ width: `${sub.oxygen}%` }}
          />
        </div>
        <div className="text-[8px] text-neutral-500 mt-1 leading-none">
          {sub.isSurfaced ? (
            <span className="text-emerald-400 animate-pulse">🍃 外気換気中 (Ventilating)</span>
          ) : (
            <span>酸素残量 (徐々に低下)</span>
          )}
        </div>
      </div>

      {/* 5. Navigation Control States */}
      <div id="gauge-nav" className="bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-xl p-2.5">
        <div className="text-[11px] text-neutral-400 mb-1.5 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>艦位測定 (NAV STATUS)</span>
        </div>
        <div className="space-y-1 mt-0.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-neutral-500">推進速力:</span>
            <span className={speedInfo?.color}>{speedInfo?.jp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">舵角/目標:</span>
            <span className="text-indigo-450 font-bold">
              {Math.round(sub.heading)}° <span className="text-neutral-500">/</span> {Math.round(sub.targetHeading)}°
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">現在深度:</span>
            <span className={sub.isSurfaced ? "text-amber-400 font-semibold" : "text-sky-400 font-semibold"}>
              {sub.isSurfaced ? "海面 (浮上航行中)" : "深海 (潜航作戦中)"}
            </span>
          </div>
        </div>
      </div>

      {/* 6. Weapons Reload Terminal */}
      <div id="gauge-weapons" className="bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-xl p-2.5">
        <div className="text-[11px] text-neutral-400 mb-1 flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>兵装残弾 (WEAPONS ACC)</span>
        </div>
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-neutral-500">誘導魚雷:</span>
            <span className={sub.torpedoes > 0 ? "text-rose-400 font-bold" : "text-neutral-600"}>
              {sub.torpedoes} / {sub.maxTorpedoes}
            </span>
          </div>
          <div className="flex justify-between items-center text-[9px]">
            <span className="text-neutral-500">装填状況:</span>
            <span>
              {reloadProgress >= 100 ? (
                <span className="text-emerald-400 text-[8px] bg-emerald-500/15 px-1 border border-emerald-500/20 rounded font-bold">
                  装填完了
                </span>
              ) : (
                <span className="text-neutral-400">{Math.round(reloadProgress)}%</span>
              )}
            </span>
          </div>
          <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-rose-500 transition-all duration-100"
              style={{ width: `${Math.min(100, reloadProgress)}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">音響デコイ:</span>
            <span className={sub.decoys > 0 ? "text-emerald-400 font-semibold" : "text-neutral-600"}>
              {sub.decoys} / {sub.maxDecoys}
            </span>
          </div>
          {sub.hasEmpTorpedo && (
            <div className="flex justify-between border-t border-neutral-800/40 pt-1 mt-1">
              <span className="text-neutral-500">EMP魚雷:</span>
              <span className={sub.empTorpedoes > 0 ? "text-pink-400 font-bold" : "text-neutral-600"}>
                {sub.empTorpedoes} / {sub.maxEmpTorpedoes}
              </span>
            </div>
          )}
          {sub.hasShockwave && (
            <div className="flex justify-between">
              <span className="text-neutral-500">パルス衝撃波:</span>
              <span className={sub.shockwaves > 0 ? "text-sky-400 font-semibold animate-pulse" : "text-neutral-600"}>
                {sub.shockwaves} / {sub.maxShockwaves}
              </span>
            </div>
          )}
          {sub.hasShield && (
            <div className="flex justify-between">
              <span className="text-neutral-500">音響シールド:</span>
              <span>
                {sub.shieldActive ? (
                  <span className="text-cyan-450 font-bold text-[9px] bg-cyan-500/15 px-1 border border-cyan-500/30 rounded">
                    稼働中 (ACTIVE)
                  </span>
                ) : (
                  <span className="text-red-500 font-bold text-[9px]">被雷消失</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Surface Action Option Button */}
      <button
        id="btn-surface-switch"
        onClick={onSurface}
        disabled={!canSurface && !sub.isSurfaced}
        className={`w-full py-2 px-3 text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 border font-bold col-span-2 lg:col-span-1 ${
          sub.isSurfaced
            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border-amber-500/40 cursor-pointer active:scale-95'
            : canSurface
              ? 'bg-sky-950/40 hover:bg-sky-500/20 text-sky-400 border-sky-500/50 cursor-pointer animate-pulse active:scale-95'
              : 'bg-neutral-900/60 text-neutral-600 border-neutral-800/80 cursor-not-allowed'
        }`}
        title={sub.isSurfaced ? '潜航開始' : '推進を停止（全停止または無音微速）し、海面に浮上して酸素換気とバッテリーの急速充電を行います。'}
      >
        <span className="relative flex h-2 w-2">
          {canSurface && !sub.isSurfaced && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${sub.isSurfaced ? 'bg-amber-500' : canSurface ? 'bg-sky-400' : 'bg-neutral-600'}`}></span>
        </span>
        {sub.isSurfaced ? '緊急潜航せよ (DIVING)' : '海面浮上・充電 (SURFACE)'}
      </button>
    </div>
  );
};

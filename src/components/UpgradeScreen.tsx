import React from 'react';
import { UpgradeStats } from '../types';
import { Radio, Heart, Zap, ArrowRight, Shield, RefreshCw, Layers, Wind } from 'lucide-react';

interface UpgradeScreenProps {
  gold: number;
  stats: UpgradeStats;
  onPurchaseUpgrade: (key: keyof UpgradeStats, cost: number) => void;
  onNextStage: () => void;
  stage: number;
}

export const UpgradeScreen: React.FC<UpgradeScreenProps> = ({
  gold,
  stats,
  onPurchaseUpgrade,
  onNextStage,
  stage,
}) => {
  // Costs configuration
  const costs = {
    sonarRange: Math.round(150 * stats.sonarRange),
    engineSilence: Math.round(140 * (stats.engineSilence + 1)),
    torpedoReload: Math.round(130 * (stats.torpedoReload + 1)),
    hullPlating: Math.round(120 * (stats.hullPlating / 50)),
    batteryCapacity: Math.round(110 * (stats.batteryCapacity / 50)),
    decoyRange: Math.round(100 * stats.decoyRange),
    ammoCapacity: Math.round(110 * (stats.ammoCapacity + 1)),
    oxygenEfficiency: Math.round(100 * (stats.oxygenEfficiency + 1)),
  };

  const upgradeList = [
    {
      key: 'sonarRange' as keyof UpgradeStats,
      title: '広帯域新型ソナー・アレイ (Wide-Band Sonar Array)',
      current: `${Math.round(250 * stats.sonarRange)}m`,
      next: `${Math.round(250 * (stats.sonarRange + 0.25))}m`,
      cost: costs.sonarRange,
      desc: 'パッシブ聴音角、及びアクティブ魚雷探査半径を大きく拡大します。',
      icon: <Radio className="w-5 h-5 text-emerald-400" />,
      maxed: stats.sonarRange >= 2.0,
    },
    {
      key: 'engineSilence' as keyof UpgradeStats,
      title: '高耐久スクリュー消音システム (Silent Propulsion Dampeners)',
      current: `${Math.round(stats.engineSilence * 100)}% 遮音`,
      next: `${Math.round((stats.engineSilence + 0.15) * 100)}% 遮音`,
      cost: costs.engineSilence,
      desc: '推進機キャビテーション音を極限までカット。通常巡航速度でも敵に探知されにくくなります。',
      icon: <RefreshCw className="w-5 h-5 text-cyan-400" />,
      maxed: stats.engineSilence >= 0.75,
    },
    {
      key: 'torpedoReload' as keyof UpgradeStats,
      title: '急速自動給弾油圧発射管 (Rapid Torpedo Hydraulic Autofeed)',
      current: `リロード レベル ${stats.torpedoReload}`,
      next: `リロード レベル ${stats.torpedoReload + 1}`,
      cost: costs.torpedoReload,
      desc: '自動魚雷再装填速度をさらに高速化（装填時間が約20%減少）。',
      icon: <ArrowRight className="w-5 h-5 text-red-400" />,
      maxed: stats.torpedoReload >= 5,
    },
    {
      key: 'hullPlating' as keyof UpgradeStats,
      title: '二重加圧高張力鋼チタン外殻 (Titanium Pressure Hull)',
      current: `最大船体耐久 ${100 + stats.hullPlating}`,
      next: `最大船体耐久 ${100 + stats.hullPlating + 25}`,
      cost: costs.hullPlating,
      desc: '船体限界圧力を引き上げ、最大強度上限を+25補強します。深海潜水艦戦のマスト。',
      icon: <Heart className="w-5 h-5 text-pink-400" />,
      maxed: stats.hullPlating >= 150,
    },
    {
      key: 'batteryCapacity' as keyof UpgradeStats,
      title: '固体電解イオン新型主蓄電池 (Solid-State Dual Cell)',
      current: `最大蓄電容量 ${100 + stats.batteryCapacity}%`,
      next: `最大蓄電容量 ${100 + stats.batteryCapacity + 25}%`,
      cost: costs.batteryCapacity,
      desc: 'ポテンシャル蓄電容量上限を+25充填。アクティブピンや高性能デコイの連射に耐えます。',
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      maxed: stats.batteryCapacity >= 150,
    },
    {
      key: 'decoyRange' as keyof UpgradeStats,
      title: '音響膨張式気泡デコイ改 (Extended Decoy Bubbler)',
      current: `デコイ出力補正 x${stats.decoyRange.toFixed(1)}`,
      next: `デコイ出力補正 x${(stats.decoyRange + 0.3).toFixed(1)}`,
      cost: costs.decoyRange,
      desc: 'デコイ of duration とノイズ強度を強化。追従魚雷をより長く、遠くから引きつけます。',
      icon: <Shield className="w-5 h-5 text-indigo-400" />,
      maxed: stats.decoyRange >= 2.5,
    },
    {
      key: 'ammoCapacity' as keyof UpgradeStats,
      title: '兵装格納庫増設架 (Expanded Ordnance Locker)',
      current: `容量補正 +${stats.ammoCapacity * 3}魚雷 / +${stats.ammoCapacity * 2}デコイ`,
      next: `容量補正 +${(stats.ammoCapacity + 1) * 3}魚雷 / +${(stats.ammoCapacity + 1) * 2}デコイ`,
      cost: costs.ammoCapacity,
      desc: '急速魚雷ラック及びデコイ展開ドラムのスロットを拡張します。最大装填数が魚雷+3、デコイ+2増加。',
      icon: <Layers className="w-5 h-5 text-orange-400" />,
      maxed: stats.ammoCapacity >= 3,
    },
    {
      key: 'oxygenEfficiency' as keyof UpgradeStats,
      title: '半結晶超微細薄膜酸素還流器 (Oxygen Recirculator)',
      current: `酸素消費量 ${Math.round((1 - Math.min(0.7, stats.oxygenEfficiency * 0.18)) * 100)}%`,
      next: `酸素消費量 ${Math.round((1 - Math.min(0.7, (stats.oxygenEfficiency + 1) * 0.18)) * 100)}%`,
      cost: costs.oxygenEfficiency,
      desc: '二酸化炭素吸着効率を高め、潜航時の基礎酸素消費速度を削減します（レベル毎に消費-18%）。',
      icon: <Wind className="w-5 h-5 text-sky-400" />,
      maxed: stats.oxygenEfficiency >= 3,
    },
  ];

  // Dynamic Weapon Systems unlocked in Wave 2+ (after Stage 1 completed)
  if (stage >= 1) {
    upgradeList.push(
      {
        key: 'hasEmpTorpedo' as keyof UpgradeStats,
        title: '【超特兵器】高周波磁気EMP魚雷 (EMP Torpedo)',
        current: stats.hasEmpTorpedo ? '開発完了・搭載済' : '未開発 (UNLOCKED)',
        next: stats.hasEmpTorpedo ? '限界改修完了' : 'パルス信管搭載',
        cost: 200,
        desc: '敵駆逐艦の主推進機関を10秒間完全にショート・停止させる強力な電磁誘導弾。（WAVE開始時5発充填）',
        icon: <Radio className="w-5 h-5 text-rose-450 animate-pulse" />,
        maxed: stats.hasEmpTorpedo,
      },
      {
        key: 'hasShockwave' as keyof UpgradeStats,
        title: '【緊急兵装】広域共鳴パルス衝撃波 (Sonic Pulse)',
        current: stats.hasShockwave ? '開発完了・搭載済' : '未開発 (UNLOCKED)',
        next: stats.hasShockwave ? '限界改修完了' : '全方位発振機増設',
        cost: 250,
        desc: '放射した全方位の衝撃音響共鳴により、周囲350mの「全敵弾」を即時粉砕消滅・敵をマヒさせます。（残弾型3発）',
        icon: <Zap className="w-5 h-5 text-sky-450" />,
        maxed: stats.hasShockwave,
      },
      {
        key: 'hasShield' as keyof UpgradeStats,
        title: '【至高防壁】音響偏向シールド (Acoustic Shield)',
        current: stats.hasShield ? '開発完了・稼働中' : '未開発 (UNLOCKED)',
        next: stats.hasShield ? '限界改修完了' : '気泡防護シールド展開',
        cost: 150,
        desc: '敵の強力な魚雷や爆雷の直撃を1度だけ100%吸収し、船体損傷を完全に無効化します。（WAVE毎に自動充電）',
        icon: <Shield className="w-5 h-5 text-cyan-400" />,
        maxed: stats.hasShield,
      }
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-neutral-900/85 backdrop-blur-md border border-neutral-850 rounded-2xl p-5 font-mono select-none my-auto shadow-[0_12px_40px_rgba(0,0,0,0.6)]" id="upgrade-screen-root">
      {/* Wave Summary */}
      <div className="flex justify-between items-center border-b border-neutral-800 pb-3 mb-4 shrink-0">
        <div>
          <span className="text-[10px] text-neutral-500 block tracking-widest uppercase">WAVE #{stage} CLEAR - STATUS: SECURED</span>
          <h2 className="text-md sm:text-lg font-bold text-emerald-400 tracking-wider">
            海底工廠兵装改修室 (SUBMARINE WORKSHOP)
          </h2>
        </div>
        <div className="bg-neutral-950/80 px-4 py-1.5 border border-neutral-800 rounded-xl text-right">
          <span className="text-[9px] text-neutral-500 block">獲得軍用資材 (GOLD BALANCE)</span>
          <span className="text-md sm:text-lg font-bold text-amber-400">{gold} <span className="text-[10px] text-neutral-400">CREDITS</span></span>
        </div>
      </div>

      <p className="text-[11px] text-neutral-400 mb-4 leading-relaxed shrink-0">
        回収した敵艦のスクラップ（ゴールド）を当ドック工廠に支給し、自艦の推進機関および戦闘音響センサ機器を大幅強化できます。
      </p>

      {/* Upgrades List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 overflow-y-auto pr-1">
        {upgradeList.map((cfg) => {
          const isAffordable = gold >= cfg.cost && !cfg.maxed;
          return (
            <div 
              key={cfg.key}
              className={`p-4 bg-neutral-950 border rounded-lg transition-all ${
                cfg.maxed 
                  ? 'border-neutral-850 opacity-70' 
                  : isAffordable 
                    ? 'border-neutral-800 hover:border-emerald-500/40 bg-neutral-950/80 shadow-md' 
                    : 'border-neutral-900'
              }`}
            >
              <div className="flex gap-3 mb-2">
                <div className="p-2 bg-neutral-900 rounded border border-neutral-800 shrink-0">
                  {cfg.icon}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-100 leading-tight">
                    {cfg.title}
                  </h3>
                  <p className="text-[10px] text-neutral-500 mt-1 leading-normal">
                    {cfg.desc}
                  </p>
                </div>
              </div>

              {/* Specs Compare info */}
              <div className="flex justify-between items-center text-[10px] bg-neutral-900 p-2 rounded mt-3 text-neutral-400">
                <span>現在: <strong className="text-neutral-200">{cfg.current}</strong></span>
                {!cfg.maxed && (
                  <>
                    <span className="text-neutral-600">▶</span>
                    <span>改修後: <strong className="text-emerald-400">{cfg.next}</strong></span>
                  </>
                )}
                {cfg.maxed && <span className="text-amber-400 font-bold">限界改修 (MAX)</span>}
              </div>

              {/* Purchase button */}
              {!cfg.maxed && (
                <button
                  id={`btn-buy-${cfg.key}`}
                  disabled={!isAffordable}
                  onClick={() => onPurchaseUpgrade(cfg.key, cfg.cost)}
                  className={`w-full mt-3 py-1.5 px-3 rounded text-xs font-bold font-mono transition-all duration-150 flex justify-between items-center border ${
                    isAffordable
                      ? 'bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border-amber-500/40 cursor-pointer active:scale-95'
                      : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                  }`}
                >
                  <span>改修申請 (UPGRADE)</span>
                  <span>{cfg.cost} Cr</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center border-t border-neutral-850 pt-4">
        <span className="text-[10px] text-neutral-500">
          次なる海域にはさらに高度な敵潜、機雷網が敷設されています。準備を怠るな。
        </span>
        <button
          id="btn-next-mission"
          onClick={onNextStage}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold px-6 py-2.5 rounded text-xs tracking-wider flex items-center gap-2 active:scale-95 transition-all outline-none"
        >
          <span>次作戦海域へ潜望鏡を降ろす (NEXT SECTOR)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

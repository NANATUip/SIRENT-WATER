import React, { useState, useEffect, useRef } from 'react';
import { 
  Submarine, 
  Enemy, 
  Torpedo, 
  Decoy, 
  GameLog, 
  UpgradeStats, 
  GameState, 
  EngineSpeed,
  Obstacle
} from './types';
import { RadarScreen } from './components/RadarScreen';
import { StatsPanel } from './components/StatsPanel';
import { ControlPanel } from './components/ControlPanel';
import { LogConsole } from './components/LogConsole';
import { UpgradeScreen } from './components/UpgradeScreen';
import { audio } from './lib/audio';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  Anchor, 
  Volume2, 
  VolumeX, 
  Skull, 
  Trophy, 
  Play, 
  Sun, 
  ShieldAlert, 
  Activity, 
  Sparkles,
  Info,
  Radio,
  Shield,
  Zap
} from 'lucide-react';

const MAP_SIZE = 2400; // Wide tactical map
const INITIAL_SONAR_RANGE = 250;

export default function App() {
  // ---------------------------------------------------------------------------
  // 1. GAME STATES
  // ---------------------------------------------------------------------------
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    stage: 1,
    playState: 'TITLE',
    gold: 0,
    highScore: parseInt(localStorage.getItem('sonar_silent_highscore') || '0', 10),
    torpedoReloadTicks: 100, // Loaded by default
  });

  const [soundMuted, setSoundMuted] = useState(false);
  const [subState, setSubState] = useState<Submarine>({
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    heading: 0,
    targetHeading: 0,
    speed: 0,
    hull: 100,
    battery: 100,
    oxygen: 100,
    torpedoes: 10,
    decoys: 5,
    maxTorpedoes: 10,
    maxDecoys: 5,
    isSurfaced: false,
    empTorpedoes: 0,
    maxEmpTorpedoes: 0,
    hasEmpTorpedo: false,
    shockwaves: 0,
    maxShockwaves: 0,
    hasShockwave: false,
    shieldActive: false,
    hasShieldModule: false,
  });

  const [upgradeStats, setUpgradeStats] = useState<UpgradeStats>({
    sonarRange: 1.0,     // multiplier on 250m base
    engineSilence: 0.15, // 15% noise proofed by default
    torpedoReload: 1,    // upgrade levels
    hullPlating: 0,      // + max hull additions
    batteryCapacity: 0,  // + max battery additions
    decoyRange: 1.0,     // decoy duration multiplier
    hasEmpTorpedo: false,
    hasShockwave: false,
    hasShield: false,
    ammoCapacity: 0,     // NEW: Weapon ammo capacity upgrading
    oxygenEfficiency: 0, // NEW: Oxygen depletion reduction level
  });

  const [logs, setLogs] = useState<GameLog[]>([]);
  const [sonarMode, setSonarMode] = useState<'PASSIVE' | 'ACTIVE'>('PASSIVE');
  const [activePingWave, setActivePingWave] = useState<number>(0);
  const [currentLevelKills, setCurrentLevelKills] = useState<number>(0);
  const [totalLevelKillsNeeded, setTotalLevelKillsNeeded] = useState<number>(3);
  const [showManual, setShowManual] = useState<boolean>(false);
  const [activeWeapon, setActiveWeapon] = useState<'NORMAL' | 'EMP'>('NORMAL');
  const [shockwaveVisualRing, setShockwaveVisualRing] = useState<number>(0);
  const [titleTab, setTitleTab] = useState<'mission' | 'sonar' | 'weapons'>('mission');

  // ---------------------------------------------------------------------------
  // 2. REFERENCES FOR PHYSICS & THE LOOP (To avoid re-render lag)
  // ---------------------------------------------------------------------------
  const physicsSubRef = useRef<Submarine>({ ...subState });
  const enemiesRef = useRef<Enemy[]>([]);
  const torpedoesRef = useRef<Torpedo[]>([]);
  const decoysRef = useRef<Decoy[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastTickTime = useRef<number>(0);
  const totalPlaySeconds = useRef<number>(0);
  const isSurfeceRestricted = useRef<boolean>(false);

  // Sync state helpers
  const addLog = (message: string, type: GameLog['type'] = 'info') => {
    const time = new Date();
    const timestampStr = time.toLocaleTimeString('ja-JP', { hour12: false });
    const newLog: GameLog = {
      id: Math.random().toString(),
      timestamp: timestampStr,
      message,
      type
    };
    setLogs((prev) => [...prev.slice(-35), newLog]);
  };

  // Safe battery and hull limits
  const maxHullLimits = 100 + upgradeStats.hullPlating;
  const maxBatteryLimits = 100 + upgradeStats.batteryCapacity;

  // ---------------------------------------------------------------------------
  // 3. GAME INITIALIZATION / SETUP LEVELS
  // ---------------------------------------------------------------------------
  const initLevel = (level: number) => {
    addLog(`--- 第${level}作戦海域 潜入指揮開始 ---`, 'info');
    
    // Spawn submarine in center
    const freshSub: Submarine = {
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      heading: 0,
      targetHeading: 0,
      speed: 0,
      hull: maxHullLimits,
      battery: maxBatteryLimits,
      oxygen: 100,
      torpedoes: 10 + Math.min(2, level - 1) + upgradeStats.ammoCapacity * 3,
      decoys: 5 + Math.min(2, level - 1) + upgradeStats.ammoCapacity * 2,
      maxTorpedoes: 10 + Math.min(2, level - 1) + upgradeStats.ammoCapacity * 3,
      maxDecoys: 5 + Math.min(2, level - 1) + upgradeStats.ammoCapacity * 2,
      isSurfaced: false,
      empTorpedoes: upgradeStats.hasEmpTorpedo ? 4 : 0,
      maxEmpTorpedoes: upgradeStats.hasEmpTorpedo ? 4 : 0,
      hasEmpTorpedo: upgradeStats.hasEmpTorpedo,
      shockwaves: upgradeStats.hasShockwave ? 3 : 0,
      maxShockwaves: upgradeStats.hasShockwave ? 3 : 0,
      hasShockwave: upgradeStats.hasShockwave,
      shieldActive: upgradeStats.hasShield,
      hasShieldModule: upgradeStats.hasShield,
    };
    // Sync references
    physicsSubRef.current = freshSub;
    setSubState(freshSub);

    // Dynamic enemies list based on wave level
    const newEnemies: Enemy[] = [];
    
    // 1. Spawning Submarines
    const subCount = 2 + Math.min(3, Math.floor(level / 1.5));
    for (let i = 0; i < subCount; i++) {
      // Pick random distant location relative to player (avoid spawning directly on player)
      const dist = 500 + Math.random() * 500;
      const angle = Math.random() * Math.PI * 2;
      newEnemies.push({
        id: `SUB_${i}_${Date.now()}`,
        type: 'SUBMARINE',
        x: (MAP_SIZE / 2) + dist * Math.sin(angle),
        y: (MAP_SIZE / 2) - dist * Math.cos(angle),
        heading: Math.floor(Math.random() * 360),
        speed: 1.0 + Math.random() * 1.5,
        hull: 40 + level * 10,
        maxHull: 40 + level * 10,
        isDetected: false,
        lastDetectedTime: 0,
        passiveBearingNoise: 15,
        behaviorState: 'PATROL',
        shootCooldown: 150 + Math.random() * 100,
      });
    }

    // 2. Spawning Surface Destroyers (Starting wave 2)
    if (level >= 2) {
      const destCount = 1 + Math.min(2, Math.floor(level / 3));
      for (let i = 0; i < destCount; i++) {
        const dist = 650 + Math.random() * 450;
        const angle = Math.random() * Math.PI * 2;
        newEnemies.push({
          id: `DST_${i}_${Date.now()}`,
          type: 'DESTROYER',
          x: (MAP_SIZE / 2) + dist * Math.sin(angle),
          y: (MAP_SIZE / 2) - dist * Math.cos(angle),
          heading: Math.floor(Math.random() * 360),
          speed: 2.2 + level * 0.2, // fast screws!
          hull: 80 + level * 15,
          maxHull: 80 + level * 15,
          isDetected: false,
          lastDetectedTime: 0,
          passiveBearingNoise: 55, // Very loud screws! Easy to listen to
          behaviorState: 'PATROL',
          shootCooldown: 120 + Math.random() * 100,
        });
      }
    }

    // 3. Spawning Fixed Sea Mines (Starting wave 2/3)
    if (level >= 2) {
      const mineCount = 1 + Math.min(5, level * 2);
      for (let i = 0; i < mineCount; i++) {
        const dist = 300 + Math.random() * 500;
        const angle = Math.random() * Math.PI * 2;
        newEnemies.push({
          id: `MNE_${i}_${Date.now()}`,
          type: 'MINE',
          x: (MAP_SIZE / 2) + dist * Math.sin(angle),
          y: (MAP_SIZE / 2) - dist * Math.cos(angle),
          heading: 0,
          speed: 0, // static obstacle hazard
          hull: 10,
          maxHull: 10,
          isDetected: false,
          lastDetectedTime: 0,
          passiveBearingNoise: 0, // silent mine!
          behaviorState: 'PATROL',
          shootCooldown: 9999,
        });
      }
    }

    enemiesRef.current = newEnemies;
    torpedoesRef.current = [];
    decoysRef.current = [];
    
    // 4. 入り組んだマップ（岩礁障害物）の配置
    const newObstacles: Obstacle[] = [];
    // マップ密度が適切になりつつお互いに隙間ができるように数を調節
    const count = 24 + Math.min(8, level * 2);
    const MIN_PASSABLE_GAP = 75; // 潜水艦の直径が約36pxなので余裕で通れるサイズ
    
    for (let i = 0; i < count; i++) {
      let ox = 0;
      let oy = 0;
      let radius = 0;
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 150) {
        attempts++;
        ox = 150 + Math.random() * (MAP_SIZE - 300);
        oy = 150 + Math.random() * (MAP_SIZE - 300);
        radius = 40 + Math.random() * 55; // 半径 40 〜 95 px

        // プレイヤー初期位置(MAP_SIZE / 2, MAP_SIZE / 2)との距離
        const px = MAP_SIZE / 2;
        const py = MAP_SIZE / 2;
        const distToPlayer = Math.sqrt((ox - px) ** 2 + (oy - py) ** 2);
        
        // プレイヤーから300px以上の安全距離
        if (distToPlayer < 300) {
          continue;
        }

        // 他の岩礁と重なっておらず、通れる隙間があるかチェック
        let tooClose = false;
        for (const existing of newObstacles) {
          const dx = ox - existing.x;
          const dy = oy - existing.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (radius + existing.radius + MIN_PASSABLE_GAP)) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          valid = true;
        }
      }

      if (valid) {
        newObstacles.push({
          id: `OBS_${i}_${Date.now()}`,
          x: ox,
          y: oy,
          radius: radius,
        });
      }
    }
    obstaclesRef.current = newObstacles;

    setActivePingWave(0);
    setSonarMode('PASSIVE');
    
    // Total targets player must destroy to clear (Mines don't count towards clears)
    const activeTargets = newEnemies.filter((e) => e.type !== 'MINE').length;
    setCurrentLevelKills(0);
    setTotalLevelKillsNeeded(activeTargets);

    addLog(`探知可能距離: ${Math.round(INITIAL_SONAR_RANGE * upgradeStats.sonarRange)}m. 全周囲警戒せよ。`, 'warning');
    addLog('操舵室: エンジン・コントロール、転舵システム、全軸作動準備完了。', 'info');
  };

  // Start game from title
  const startGame = () => {
    audio.setMute(soundMuted);
    setGameState((prev) => ({
      ...prev,
      playState: 'PLAYING',
      stage: 1,
      score: 0,
      gold: 0,
    }));
    setLogs([]);
    initLevel(1);
  };

  // Helper to handle client-side mute toggle
  const handleToggleMute = () => {
    const newState = !soundMuted;
    setSoundMuted(newState);
    audio.setMute(newState);
  };

  // ---------------------------------------------------------------------------
  // 4. ACTION CALLBACKS (Steering, Weapons, Active Sonar)
  // ---------------------------------------------------------------------------
  const handleSetSpeed = (ordSpeed: EngineSpeed) => {
    if (physicsSubRef.current.hull <= 0) return;
    
    // Surfaces can only exist at Speed 0 or 1
    if (physicsSubRef.current.isSurfaced && ordSpeed > 1) {
      addLog('航行制限：浮上中は無音推進（微速）または全停止のみ維持可能。潜望鏡深度へ即行緊急潜航してください。', 'warning');
      return;
    }

    physicsSubRef.current.speed = ordSpeed;
    setSubState((prev) => ({ ...prev, speed: ordSpeed }));
    
    const speedTerms = ['全停止 (All Stop)', '無音・微速 (Silent Speed)', '巡航・半速 (Standard Speed)', '急速・戦速 (Flank Speed)'];
    addLog(`機関長: 主推進推進力を変更 → ${speedTerms[ordSpeed]}`, 'success');
  };

  const handleAdjustHeading = (delta: number) => {
    if (physicsSubRef.current.hull <= 0) return;
    
    let target = (physicsSubRef.current.targetHeading + delta + 360) % 360;
    physicsSubRef.current.targetHeading = target;
    setSubState((prev) => ({ ...prev, targetHeading: target }));
    addLog(`操舵室: 舵角修正、目標進路を ${target}° に設定`, 'info');
  };

  const handleSetHeading = (heading: number) => {
    if (physicsSubRef.current.hull <= 0) return;
    
    physicsSubRef.current.targetHeading = heading;
    setSubState((prev) => ({ ...prev, targetHeading: heading }));
    addLog(`操舵室: 定位回頭、目標進路を ${heading}° に設定`, 'info');
  };

  // Surfacing trigger
  const handleSurface = () => {
    const sub = physicsSubRef.current;
    if (sub.isSurfaced) {
      // Emergency Dive
      sub.isSurfaced = false;
      setSubState((prev) => ({ ...prev, isSurfaced: false }));
      addLog('警報：緊急潜航！両舷急速潜望鏡深度へ (DIVING, DIVING!)', 'alert');
      audio.playLaunch(); // water sound
      return;
    }

    // Check if enemies are nearby and actively hunting (restrict surface safety)
    const hasDangerNearby = enemiesRef.current.some((e) => {
      if (e.hull <= 0) return false; // Ignore destroyed enemies
      if (e.type === 'MINE') return false; // Ignore static mines
      const dx = e.x - sub.x;
      const dy = e.y - sub.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      return d < 250 && e.behaviorState === 'HUNT';
    });

    if (hasDangerNearby) {
      addLog('警告：周囲にアクティブ探知中の敵艦が存在します。浮上すれば主砲の標的になり極めて危険です！', 'alert');
      audio.startKlaxon();
      setTimeout(() => audio.stopKlaxon(), 2000);
      return;
    }

    if (sub.speed > 1) {
      addLog('エラー：浮上するには一度速力を 0 または 1 に抑える必要があります。', 'warning');
      return;
    }

    sub.isSurfaced = true;
    setSubState((prev) => ({ ...prev, isSurfaced: true }));
    addLog('海洋気象：海面浮上完了。ディーゼル機関を始動、主蓄電池の急速充電及び内気循環呼吸装置を作動。', 'success');
    addLog('※注意: 浮上中は敵のパッシブソナーに引っ掛かりやすくなり、見つかれば大打撃を受けます。', 'warning');
  };

  // Launch a heavy Torpedo! Fires in a direction of ordered angle
  const handleFireTorpedo = (heading: number) => {
    const sub = physicsSubRef.current;
    if (sub.hull <= 0 || gameState.playState !== 'PLAYING') return;
    if (sub.isSurfaced) {
      addLog('兵装：浮上中は魚雷発射管に注水できません。潜航してください。', 'warning');
      return;
    }

    const firingEmp = activeWeapon === 'EMP' && sub.hasEmpTorpedo;

    if (firingEmp) {
      if (sub.empTorpedoes <= 0) {
        addLog('兵装：EMP魚雷エンプティ！通常の誘導魚雷（Acoustic Torpedo）を選択してください。', 'alert');
        return;
      }
    } else {
      if (sub.torpedoes <= 0) {
        addLog('兵装：魚雷弾薬庫エンプティ！ 次ステージのドックで補給が必要です。', 'alert');
        return;
      }
    }

    if (gameState.torpedoReloadTicks < 100) {
      addLog('兵装：魚雷発射管は現在自動装填中（再装填完了まで待機）', 'warning');
      return;
    }

    // Launch torpedo! Spawns at submarine's center pointing to heading
    const speed = firingEmp ? 4.8 : 4.2;
    const bulletId = `TORP_PL_${Date.now()}`;
    const newTorp: Torpedo = {
      id: bulletId,
      x: sub.x,
      y: sub.y,
      heading: heading,
      speed: speed,
      isPlayerOwned: true,
      homingStrength: firingEmp ? 0.22 : 0.12, // EMP has slightly higher homing response
      isHomingDecoy: false,
      timeLeft: firingEmp ? 320 : 400, // Range frames
      isEmp: firingEmp,
    };

    torpedoesRef.current.push(newTorp);
    
    // Decrement ammo, trigger reload
    if (firingEmp) {
      sub.empTorpedoes--;
      setSubState((prev) => ({ ...prev, empTorpedoes: sub.empTorpedoes }));
    } else {
      sub.torpedoes--;
      setSubState((prev) => ({ ...prev, torpedoes: sub.torpedoes }));
    }
    setGameState((prev) => ({ ...prev, torpedoDoReload: true, torpedoReloadTicks: 0 }));

    if (firingEmp) {
      addLog(`兵装：第2高圧EMP魚雷発射！ 高速音響シグネチャ放射（角度 ${heading}° 方向）`, 'success');
    } else {
      addLog(`兵装：第1魚雷発射管、放圧！ 魚雷射出（角度 ${heading}° 方向）`, 'success');
    }
    audio.playLaunch();
    
    // ALERT NEARBY ENEMIES to shooter position because launched torpedo makes high sound pressure level!
    enemiesRef.current.forEach((e) => {
      const d = Math.sqrt((e.x - sub.x) ** 2 + (e.y - sub.y) ** 2);
      if (d < 500) {
        e.behaviorState = 'HUNT';
        e.isDetected = true;
        e.lastDetectedTime = Date.now();
      }
    });
  };

  // Launch a Sonic Pulse Shockwave
  const handleSonicShockwave = () => {
    const sub = physicsSubRef.current;
    if (sub.hull <= 0 || gameState.playState !== 'PLAYING') return;
    if (sub.isSurfaced) {
      addLog('兵装：浮上中は水中共振パルスを放射できません。', 'warning');
      return;
    }
    if (!sub.hasShockwave) {
      addLog('電力装置：共振パルス衝撃波発振器が装備されていません。', 'warning');
      return;
    }
    if (sub.shockwaves <= 0) {
      addLog('兵装：高弾性衝撃パルス・重蓄電コアの残弾がありません。', 'warning');
      return;
    }
    if (sub.battery < 30) {
      addLog('電力異常：高圧共振衝撃を放出する十分な電位がありません（要30%主電池）', 'alert');
      return;
    }

    sub.shockwaves--;
    sub.battery -= 30;
    setSubState((prev) => ({ ...prev, shockwaves: sub.shockwaves, battery: sub.battery }));

    addLog('【衝撃波放射】：全コンデンサ共振！高圧音響パルス衝撃波を放射！！', 'warning');
    audio.playSonarPing(0.6, 0.5); // heavy crash sound
    
    // Animate a visual expanding sapphire shock ring
    setShockwaveVisualRing(10); // starts animation

    // 1. Destroy all hostile torpedoes within 350m
    const shockDistance = 350;
    let torpedoesCleared = 0;
    torpedoesRef.current.forEach((torp) => {
      if (!torp.isPlayerOwned) {
        const dx = torp.x - sub.x;
        const dy = torp.y - sub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= shockDistance) {
          torp.timeLeft = 0; // destroy!
          torpedoesCleared++;
        }
      }
    });

    if (torpedoesCleared > 0) {
      addLog(`聴音速報：自艦の衝撃パルスにより、接近中だった敵魚雷/爆雷 ${torpedoesCleared} 发が中和されました。`, 'success');
      audio.playExplosion(0.8);
    }

    // 2. Stun and alert nearby enemies
    enemiesRef.current.forEach((e) => {
      const dx = e.x - sub.x;
      const dy = e.y - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      e.isDetected = true;
      e.lastDetectedTime = Date.now();
      e.behaviorState = 'HUNT'; // alert them!

      if (dist <= shockDistance && e.type !== 'MINE') {
        e.isStunned = true;
        e.stunTimer = 100; // 10 seconds stunning (100 frames)
        e.speed = 0;
        e.shootCooldown = 150; // reset cooldown
        addLog(`ソナー報告：衝撃波が敵艦 CON-${e.id.slice(0,3)} に直撃！主推進電磁回路がショート、一時機能停止。`, 'success');
      }
    });
  };

  // Launch an Acoustic Decoy noisemaker.
  const handleLaunchDecoy = () => {
    const sub = physicsSubRef.current;
    if (sub.hull <= 0 || gameState.playState !== 'PLAYING') return;
    if (sub.isSurfaced) {
      addLog('兵装：浮上中はデコイ音響気泡管を使用できません。', 'warning');
      return;
    }
    if (sub.decoys <= 0) {
      addLog('兵装：気泡音響源デコイがありません！', 'warning');
      return;
    }
    if (sub.battery < 15) {
      addLog('電力異常：電磁気デコイを射出するのに十分な電圧がありません（要15%電池）', 'alert');
      return;
    }

    // Launch decoy backwards opposite to submarine heading
    const decoyAngle = (sub.heading + 180) % 360;
    const newDecoy: Decoy = {
      id: `DECOY_${Date.now()}`,
      x: sub.x,
      y: sub.y,
      heading: decoyAngle,
      speed: 0.8,
      noiseLevel: 500, // Massive noise! Extremely loud, pulls homing torpedoes
      timeLeft: 350 * upgradeStats.decoyRange, // Dynamic duration
    };

    decoysRef.current.push(newDecoy);
    
    sub.decoys--;
    sub.battery -= 15;
    
    setSubState((prev) => ({ ...prev, decoys: sub.decoys, battery: sub.battery }));
    addLog(`兵装：気泡音響デコイ射出完了（推進方位 ${decoyAngle}°、残：${sub.decoys}）`, 'success');
    audio.playLaunch();
  };

  // Trigger active high-power Ping wave sweep
  const handleActivePing = () => {
    const sub = physicsSubRef.current;
    if (sub.hull <= 0 || gameState.playState !== 'PLAYING') return;
    if (sub.isSurfaced) {
      addLog('ソナー：大気中への音波ピンは屈折して行えません。潜降してください。', 'warning');
      return;
    }
    if (sub.battery < 20) {
      addLog('電力異常：アクティブ発振器用のコンデンサ電力が不足（要20%蓄電池）', 'alert');
      return;
    }

    // Trigger Expanding wave
    sub.battery -= 20;
    setSubState((prev) => ({ ...prev, battery: sub.battery }));
    setSonarMode('ACTIVE');
    setActivePingWave(5); // Start expanding
    
    addLog('ソナー：アクティブ・超高周波サウンドピン、コンデンサ放電！！ (PING!)', 'warning');
    audio.playSonarPing(0.95);

    // Alert ALL enemies on map! Active pings broadcast player's coordinates immediately!
    enemiesRef.current.forEach((e) => {
      e.behaviorState = 'HUNT';
      const d = Math.sqrt((e.x - sub.x) ** 2 + (e.y - sub.y) ** 2);
      if (d < 950) {
        // immediately marked seen
        e.isDetected = true;
        e.lastDetectedTime = Date.now();
      }
    });
  };

  // ---------------------------------------------------------------------------
  // 5. UPGRADES WORKSHOP HANDLER
  // ---------------------------------------------------------------------------
  const handlePurchaseUpgrade = (key: keyof UpgradeStats, cost: number) => {
    if (gameState.gold < cost) return;

    setGameState((prev) => ({ ...prev, gold: prev.gold - cost }));

    setUpgradeStats((prev) => {
      const next = { ...prev };
      if (key === 'sonarRange') next[key] += 0.25;
      else if (key === 'engineSilence') next[key] += 0.15;
      else if (key === 'torpedoReload') next[key] += 1;
      else if (key === 'decoyRange') next[key] += 0.3;
      else if (key === 'hasEmpTorpedo') {
        next.hasEmpTorpedo = true;
        physicsSubRef.current.hasEmpTorpedo = true;
        physicsSubRef.current.empTorpedoes = 5;
        physicsSubRef.current.maxEmpTorpedoes = 5;
        setTimeout(() => {
          setSubState((p) => ({ ...p, hasEmpTorpedo: true, empTorpedoes: 5, maxEmpTorpedoes: 5 }));
        }, 10);
      }
      else if (key === 'hasShockwave') {
        next.hasShockwave = true;
        physicsSubRef.current.hasShockwave = true;
        physicsSubRef.current.shockwaves = 3;
        physicsSubRef.current.maxShockwaves = 3;
        setTimeout(() => {
          setSubState((p) => ({ ...p, hasShockwave: true, shockwaves: 3, maxShockwaves: 3 }));
        }, 10);
      }
      else if (key === 'hasShield') {
        next.hasShield = true;
        physicsSubRef.current.hasShield = true;
        physicsSubRef.current.shieldActive = true;
        setTimeout(() => {
          setSubState((p) => ({ ...p, hasShield: true, shieldActive: true }));
        }, 10);
      }
      else if (key === 'ammoCapacity') {
        next.ammoCapacity += 1;
        physicsSubRef.current.maxTorpedoes += 3;
        physicsSubRef.current.torpedoes += 3;
        physicsSubRef.current.maxDecoys += 2;
        physicsSubRef.current.decoys += 2;
        setTimeout(() => {
          setSubState((p) => ({
            ...p,
            maxTorpedoes: p.maxTorpedoes + 3,
            torpedoes: p.torpedoes + 3,
            maxDecoys: p.maxDecoys + 2,
            decoys: p.decoys + 2,
          }));
        }, 10);
      }
      else if (key === 'oxygenEfficiency') {
        next.oxygenEfficiency += 1;
      }
      else {
        const numericKey = key as 'hullPlating' | 'batteryCapacity';
        if (numericKey === 'hullPlating' || numericKey === 'batteryCapacity') {
          next[numericKey] += 50;
        }
      }
      return next;
    });

    // Side effects on limits immediately
    if (key === 'hullPlating') {
      physicsSubRef.current.hull += 25;
      setSubState((prev) => ({ ...prev, hull: prev.hull + 25 }));
    } else if (key === 'batteryCapacity') {
      physicsSubRef.current.battery += 25;
      setSubState((prev) => ({ ...prev, battery: prev.battery + 25 }));
    }

    addLog('艦政本部：指定兵装モジュールの工廠改修が認可・増設されました。', 'success');
    audio.playSonarPing(0.6, 1.4); // high pitch tick
  };

  const handleNextStage = () => {
    setGameState((prev) => ({
      ...prev,
      stage: prev.stage + 1,
      playState: 'PLAYING',
    }));
    initLevel(gameState.stage + 1);
  };

  // ---------------------------------------------------------------------------
  // 6. MAIN GAME TICKING LOOP (Unified Physics & AI Tracker)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameState.playState !== 'PLAYING') return;

    const gameInterval = setInterval(() => {
      const sub = physicsSubRef.current;
      if (sub.hull <= 0) {
        // Player Destroyed
        audio.stopKlaxon();
        audio.playExplosion(1.5);
        addLog('【致命的電磁崩壊】：水圧隔壁が圧壊。船体構造破壊に達しました...', 'alert');
        setGameState((prev) => {
          const finalScore = prev.score + prev.stage * 100;
          const isNewHigh = finalScore > prev.highScore;
          if (isNewHigh) {
            localStorage.setItem('sonar_silent_highscore', finalScore.toString());
          }
          return {
            ...prev,
            playState: 'GAMEOVER',
            highScore: isNewHigh ? finalScore : prev.highScore,
            score: finalScore
          };
        });
        clearInterval(gameInterval);
        return;
      }

      // Check level clear state (when all standard enemies are dead)
      const aliveStandardEnemies = enemiesRef.current.filter((e) => e.type !== 'MINE' && e.hull > 0);
      if (aliveStandardEnemies.length === 0) {
        audio.stopKlaxon();
        addLog(`【第${gameState.stage}海域 作戦成功】：警戒敵艦隊の全滅を確認。補給のためドックへ帰還せよ。`, 'success');
        setGameState((prev) => ({
          ...prev,
          gold: prev.gold + 200 + prev.stage * 50,
          score: prev.score + prev.stage * 300,
          playState: 'UPGRADES',
        }));
        clearInterval(gameInterval);
        return;
      }

      // --- A. Dynamic Submarine Position & Turning update ---
      // Smoothly rotate submarine heading toward target ordered heading
      let rawDiff = sub.targetHeading - sub.heading;
      // Normalise difference map
      while (rawDiff < -180) rawDiff += 360;
      while (rawDiff > 180) rawDiff -= 360;

      const turnSpeedCoeff = sub.speed === 3 ? 0.75 : sub.speed === 1 ? 1.6 : 1.2; // faster turning at slow speeds!
      if (Math.abs(rawDiff) > 0.5) {
        sub.heading = (sub.heading + Math.sign(rawDiff) * Math.min(Math.abs(rawDiff), turnSpeedCoeff) + 360) % 360;
      }

      // Smooth speed acceleration toward setting
      const orderedSpeedMap = [0, 0.75, 1.8, 3.5]; // speed multipliers in coords
      const targetSpeedVal = orderedSpeedMap[sub.speed];
      // Store current speed on sub object dynamically
      const currentSpeedKey = 'currentCoordsSpeed';
      if (!(sub as any)[currentSpeedKey]) {
        (sub as any)[currentSpeedKey] = 0;
      }
      let curSp = (sub as any)[currentSpeedKey];
      curSp += (targetSpeedVal - curSp) * 0.05;
      (sub as any)[currentSpeedKey] = curSp;

      // Translate coordinates mathematically (0 heading is straight UP, 90 is RIGHT)
      const moveAngleRad = ((sub.heading - 90) * Math.PI) / 180;
      sub.x += curSp * Math.cos(moveAngleRad);
      sub.y += curSp * Math.sin(moveAngleRad);

      // Keep within map boundaries
      sub.x = Math.max(100, Math.min(MAP_SIZE - 100, sub.x));
      sub.y = Math.max(100, Math.min(MAP_SIZE - 100, sub.y));

      // --- 障害物（岩礁）との衝突判定とノックバック ---
      obstaclesRef.current.forEach((obs) => {
        const dx = sub.x - obs.x;
        const dy = sub.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const subRadius = 18;
        if (dist < obs.radius + subRadius) {
          // 反発方向
          const pushX = dist > 0 ? (dx / dist) : 0;
          const pushY = dist > 0 ? (dy / dist) : -1;
          
          // 位置を強制的に障害物の外側へ押し出す
          sub.x = obs.x + (obs.radius + subRadius + 15) * pushX;
          sub.y = obs.y + (obs.radius + subRadius + 15) * pushY;
          
          // 進行方向と逆にさらに少し下げてノックバック感を出す
          const moveAngleRad = ((sub.heading - 90) * Math.PI) / 180;
          sub.x -= 15 * Math.cos(moveAngleRad);
          sub.y -= 15 * Math.sin(moveAngleRad);
          
          // 再度境界に収める
          sub.x = Math.max(100, Math.min(MAP_SIZE - 100, sub.x));
          sub.y = Math.max(100, Math.min(MAP_SIZE - 100, sub.y));
          
          const damage = 15;
          sub.hull = Math.max(0, sub.hull - damage);
          
          audio.playExplosion(0.8);
          addLog(`【触礁警告】: 岩礁障害物に激突！ 船体にダメージを受けました。 (-${damage} 船体)`, 'alert');
        }
      });

      // --- B. Oxygen & Battery levels maintenance ---
      if (sub.isSurfaced) {
        // Surface: recharge fast!
        sub.oxygen = Math.min(100, sub.oxygen + 1.2);
        sub.battery = Math.min(maxBatteryLimits, sub.battery + 0.8);
        
        // Surf threat: continuous shelling if surfaced when alert enemy Destroyer is tracking you!
        const alertEnemyNear = enemiesRef.current.some((e) => {
          const d = Math.sqrt((e.x - sub.x) ** 2 + (e.y - sub.y) ** 2);
          return d < 700 && e.type === 'DESTROYER' && e.behaviorState === 'HUNT';
        });

        if (alertEnemyNear) {
          sub.hull -= 0.6; // Heavy shell impact!
          if (Math.random() < 0.08) {
            addLog('船体被弾！：敵駆逐艦の沿岸艦砲に捕捉されています！ 緊急潜航してください！', 'alert');
            audio.playExplosion(0.8);
          }
        }
      } else {
        // Submerged: drain oxy slowly
        // Deplete slower if operating Stop or Silent
        let oxDrain = sub.speed === 3 ? 0.07 : sub.speed === 0 ? 0.02 : 0.035;
        if (upgradeStats.oxygenEfficiency > 0) {
          const reduction = Math.min(0.7, upgradeStats.oxygenEfficiency * 0.18);
          oxDrain *= (1 - reduction);
        }
        sub.oxygen = Math.max(0, sub.oxygen - oxDrain);

        if (sub.oxygen <= 0) {
          sub.hull -= 0.25; // Suffocating structural stress
          if (Math.random() < 0.02) {
            addLog('緊急事態：酸素残量が完全に枯渇！ 乗組員が虚脱し船体損傷中。直ちに浮上せよ！', 'alert');
            audio.startKlaxon();
          }
        } else if (sub.oxygen > 20) {
          audio.stopKlaxon();
        }

        // Slow battery recharge under standard fuel auxiliary cells
        if (sub.speed <= 1) {
          sub.battery = Math.min(maxBatteryLimits, sub.battery + 0.02);
        }
      }

      // --- C. Weapon reloads ticks increment ---
      setGameState((prev) => {
        if (prev.torpedoReloadTicks < 100) {
          // speed depends on torpedo reload system levels
          const inc = 0.5 * upgradeStats.torpedoReload;
          const nextTicks = prev.torpedoReloadTicks + inc;
          if (nextTicks >= 100) {
            addLog('兵装：魚雷再自動装填 完了。魚雷射出可能。', 'success');
          }
          return { ...prev, torpedoReloadTicks: Math.min(100, nextTicks) };
        }
        return prev;
      });

      // --- D. Sonar active ping expanding ring physics ---
      if (activePingWave > 0) {
        // Expand active ping vector radius (reaches max range limits)
        const radarBaseRange = INITIAL_SONAR_RANGE * upgradeStats.sonarRange;
        setActivePingWave((prev) => {
          const next = prev + 12;
          if (next >= radarBaseRange) {
            // sweep completed
            setSonarMode('PASSIVE');
            return 0; // stop
          }
          return next;
        });
      }

      // --- D2. Shockwave expanding sapphire ring animation ---
      setShockwaveVisualRing((prev) => {
        if (prev > 0) {
          const next = prev + 18;
          if (next >= 350) return 0; // finished
          return next;
        }
        return 0;
      });

      // --- E. Update Decoys ---
      decoysRef.current.forEach((decoy) => {
        const decoyRad = ((decoy.heading - 90) * Math.PI) / 180;
        decoy.x += decoy.speed * Math.cos(decoyRad);
        decoy.y += decoy.speed * Math.sin(decoyRad);
        decoy.timeLeft--;

        // 障害物との衝突
        obstaclesRef.current.forEach((obs) => {
          const odx = obs.x - decoy.x;
          const ody = obs.y - decoy.y;
          const odist = Math.sqrt(odx * odx + ody * ody);
          if (odist < obs.radius + 6) {
            decoy.timeLeft = 0; // 当たると消滅
          }
        });
      });
      // Filter out expired decoys safely
      decoysRef.current = decoysRef.current.filter((d) => d.timeLeft > 0);

      // --- F. Enemy Vessels AI, Navigation and firing ticks ---
      let warningIncomingTorp = false;

      enemiesRef.current.forEach((enemy) => {
        if (enemy.hull <= 0) return;

        // --- Handle EMP Stunned Timer Countdown ---
        if (enemy.isStunned) {
          if (enemy.stunTimer && enemy.stunTimer > 0) {
            enemy.stunTimer--;
            // Frozen in place, emits minimal sensor noise
            enemy.passiveBearingNoise = 2;
            return; // Skip AI maneuvering and shooting
          } else {
            enemy.isStunned = false;
            addLog(`聴音速報：敵艦 CON-${enemy.id.slice(0, 3)} の電磁パルス障害がクリア。主機関が再起動しました。`, 'warning');
          }
        }

        // Vector to player
        const dx = sub.x - enemy.x;
        const dy = sub.y - enemy.y;
        const distToPlayer = Math.sqrt(dx * dx + dy * dy);

        // Mine handling
        if (enemy.type === 'MINE') {
          if (distToPlayer < 75) {
            // DETONATE mine
            enemy.hull = 0;
            sub.hull -= 35; // Heavy blow!
            addLog('【触雷警告】: 係維機雷に直接接触！ 隔壁が大破、海水が流入しています！', 'alert');
            audio.playExplosion(1.5);
          }
          return; // skips AI maneuvering
        }

        // Homing behavior based on noise emissions
        // Combine current ordered speed noise and active pings
        const subSpeedNoise = sub.speed === 3 ? 90 : sub.speed === 2 ? 40 : sub.speed === 1 ? 8 : 1;
        // Pinging or Surfacing gives giant noise footprint
        const totalAcousticFootprint = subSpeedNoise + (sonarMode === 'ACTIVE' ? 120 : 0) + (sub.isSurfaced ? 80 : 0);

        // Turn down sub noise based on Propeller Silencer upgrades
        const dampenedFootprint = totalAcousticFootprint * (1 - upgradeStats.engineSilence);

        // AI Hearing threshold
        const hearingThresholdRange = enemy.type === 'DESTROYER' ? 450 : 350;
        const canHearSub = distToPlayer < (hearingThresholdRange * (dampenedFootprint / 30));

        if (canHearSub && enemy.behaviorState !== 'HUNT') {
          enemy.behaviorState = 'HUNT';
          enemy.isDetected = true;
          enemy.lastDetectedTime = Date.now();
          addLog(`ソナー速報: 標的 CON-${enemy.id.slice(0,3)} が自艦ノイズをキャッチ。戦闘突入機動に入りました！`, 'warning');
        }

        // AI State Engine
        if (enemy.behaviorState === 'HUNT') {
          // Face directly to player coords
          let targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          if (targetAngle < 0) targetAngle += 360;

          // Steer towards player
          let enemyDiff = targetAngle - enemy.heading;
          while (enemyDiff < -185) enemyDiff += 360;
          while (enemyDiff > 185) enemyDiff -= 360;
          enemy.heading = (enemy.heading + Math.sign(enemyDiff) * Math.min(Math.abs(enemyDiff), 2.0) + 360) % 360;

          // Charge forward
          const enemySpeedRad = ((enemy.heading - 90) * Math.PI) / 180;
          enemy.x += enemy.speed * Math.cos(enemySpeedRad);
          enemy.y += enemy.speed * Math.sin(enemySpeedRad);

          // Shooting weapons logic!
          enemy.shootCooldown--;
          if (enemy.shootCooldown <= 0 && distToPlayer < 550 && !sub.isSurfaced) {
            enemy.shootCooldown = 180 + Math.random() * 120; // reset

            if (enemy.type === 'DESTROYER') {
              // Destroyer drops Depth Charges (Spawns a bomb that runs slowly, then detonate)
              // We model Depth Charges as short range, slower-speed mines that deploy from the stern!
              const chargeHeading = (enemy.heading + 180) % 360; // backwards from ship stern
              const newDepthCharge: Torpedo = {
                id: `CHARG_${Date.now()}`,
                x: enemy.x,
                y: enemy.y,
                heading: chargeHeading,
                speed: 1.0, // floats downwards slowly
                isPlayerOwned: false,
                isHomingDecoy: false,
                homingStrength: 0, // static sink
                timeLeft: 120, // detonates fast
              };
              torpedoesRef.current.push(newDepthCharge);
              addLog(`聴音チーム警報：敵駆逐艦 CON-${enemy.id.slice(0,3)} が爆雷（Depth Charge）を投下中！ 自艦位置から ${Math.round(distToPlayer)}m！`, 'alert');
              audio.playLaunch();
            } else {
              // Submarine launches a modern acoustic-homing Torpedo!
              const torpHeading = enemy.heading;
              const hostileTorp: Torpedo = {
                id: `TORP_EN_${Date.now()}`,
                x: enemy.x,
                y: enemy.y,
                heading: torpHeading,
                speed: 3.2,
                isPlayerOwned: false,
                homingStrength: 0.18, // homes strongly on sound
                isHomingDecoy: false,
                timeLeft: 350,
              };
              torpedoesRef.current.push(hostileTorp);
              addLog(`聴音チーム警報：敵潜 CON-${enemy.id.slice(0,3)} からアクティブ魚雷発射！ 高速スクリュー音を探知！`, 'alert');
              audio.playLaunch();
              audio.startKlaxon();
              warningIncomingTorp = true;
            }
          }
        } else {
          // Patrol random navigation
          if (Math.random() < 0.005) {
            enemy.heading = (enemy.heading + 45 + Math.random() * 90) % 360;
          }
          const patrolSpeedRad = ((enemy.heading - 90) * Math.PI) / 180;
          enemy.x += (enemy.speed * 0.4) * Math.cos(patrolSpeedRad);
          enemy.y += (enemy.speed * 0.4) * Math.sin(patrolSpeedRad);

          // Bound checking
          if (enemy.x < 150 || enemy.x > MAP_SIZE - 150) enemy.heading = (enemy.heading + 180) % 360;
          if (enemy.y < 150 || enemy.y > MAP_SIZE - 150) enemy.heading = (enemy.heading + 180) % 360;
        }

        // --- 敵艦の岩礁衝突と衝突回避AI ---
        obstaclesRef.current.forEach((obs) => {
          const edx = enemy.x - obs.x;
          const edy = enemy.y - obs.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          const enemyRadius = 18;

          // 回避行動：衝突距離の手前（obs.radius + 110px）にいる場合、障害物から離れる方向に操舵する
          if (edist < obs.radius + 110) {
            // 障害物から離れる角度
            let escapeAngle = (Math.atan2(edy, edx) * 180) / Math.PI + 90;
            if (escapeAngle < 0) escapeAngle += 360;

            let diff = escapeAngle - enemy.heading;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;

            // 回避するために少しずつ舵を回す（障害物回避を優先度を高くして転舵）
            enemy.heading = (enemy.heading + Math.sign(diff) * 3.5 + 360) % 360;
          }

          // 直接衝突判定
          if (edist < obs.radius + enemyRadius) {
            const pushX = edist > 0 ? (edx / edist) : 0;
            const pushY = edist > 0 ? (edy / edist) : -1;

            // 障害物の外側へ押し戻す
            enemy.x = obs.x + (obs.radius + enemyRadius + 12) * pushX;
            enemy.y = obs.y + (obs.radius + enemyRadius + 12) * pushY;

            // headingを障害物の反対側に向ける（跳ね返って進路を変える）
            enemy.heading = (enemy.heading + 140 + Math.random() * 80) % 360;

            // 衝突による船体ダメージ
            const crashDamage = 15;
            enemy.hull = Math.max(0, enemy.hull - crashDamage);

            addLog(`聴音速報: 標的 CON-${enemy.id.slice(0, 3)} が岩礁障害物に衝突！ 金属大破壊音を探知！ (-${crashDamage} 船体)`, 'warning');
            audio.playExplosion(0.65);
          }
        });
      });

      // --- G. Torpedo physics & tracking (Acoustic Homing) ---
      const activeHostileTorpedoesExist = torpedoesRef.current.some((t) => !t.isPlayerOwned && t.homingStrength > 0);

      torpedoesRef.current.forEach((torp) => {
        // Evaluate homing targets
        if (torp.homingStrength > 0) {
          let loudestX = sub.x;
          let loudestY = sub.y;
          let highestIntensity = sub.isSurfaced ? 300 : (sub.speed === 3 ? 150 : sub.speed === 2 ? 80 : sub.speed === 1 ? 15 : 2);
          
          if (torp.isPlayerOwned) {
            // Player Torpedo homes in on loud moving enemies (Destroyers are very loud)
            let maxIntensity = 0;
            enemiesRef.current.forEach((e) => {
              if (e.hull <= 0 || e.type === 'MINE') return;
              const eNoise = e.passiveBearingNoise + e.speed * 15;
              const edx = e.x - torp.x;
              const edy = e.y - torp.y;
              const edist = Math.sqrt(edx * edx + edy * edy);
              
              if (edist < 450) {
                // intensity drops over square distance
                const intensity = eNoise / (edist * 0.1);
                if (intensity > maxIntensity) {
                  maxIntensity = intensity;
                  loudestX = e.x;
                  loudestY = e.y;
                }
              }
            });

            if (maxIntensity > 0) {
              const dx = loudestX - torp.x;
              const dy = loudestY - torp.y;
              let targetAng = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
              if (targetAng < 0) targetAng += 360;

              let diff = targetAng - torp.heading;
              while (diff < -180) diff += 360;
              while (diff > 180) diff -= 360;
              torp.heading = (torp.heading + Math.sign(diff) * Math.min(Math.abs(diff), 2.5) + 360) % 360;
            }
          } else {
            // Hostile Torpedo homes in on the loudest target:
            // Could be player submarine, OR any running player decoy!
            decoysRef.current.forEach((dec) => {
              const ddx = dec.x - torp.x;
              const ddy = dec.y - torp.y;
              const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
              
              if (ddist < 550) {
                const decIntensity = dec.noiseLevel / (ddist * 0.1);
                if (decIntensity > highestIntensity) {
                  highestIntensity = decIntensity;
                  loudestX = dec.x;
                  loudestY = dec.y;
                }
              }
            });

            const dx = loudestX - torp.x;
            const dy = loudestY - torp.y;
            const distToTarget = Math.sqrt(dx * dx + dy * dy);

            // 敵の魚雷はある程度の距離進むと（残り時間が 200 以下になると）追尾を停止し直進する
            if (torp.timeLeft > 210 && distToTarget < 500 && highestIntensity > 3) {
              let targetAng = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
              if (targetAng < 0) targetAng += 360;

              let diff = targetAng - torp.heading;
              while (diff < -180) diff += 360;
              while (diff > 180) diff -= 360;
              torp.heading = (torp.heading + Math.sign(diff) * Math.min(Math.abs(diff), 3.2) + 360) % 360;
            }
          }
        }

        // Move torpedo forward
        const tRad = ((torp.heading - 90) * Math.PI) / 180;
        torp.x += torp.speed * Math.cos(tRad);
        torp.y += torp.speed * Math.sin(tRad);
        torp.timeLeft--;

        // 障害物との衝突
        obstaclesRef.current.forEach((obs) => {
          const odx = obs.x - torp.x;
          const ody = obs.y - torp.y;
          const odist = Math.sqrt(odx * odx + ody * ody);
          if (odist < obs.radius + 4) {
            torp.timeLeft = 0; // 当たると消滅
            audio.playExplosion(0.35);
          }
        });

        // Collision Checks!
        if (torp.isPlayerOwned) {
          // Check collision with enemies (mines could also be targets)
          enemiesRef.current.forEach((enemy) => {
            if (enemy.hull <= 0) return;
            const edx = enemy.x - torp.x;
            const edy = enemy.y - torp.y;
            const edist = Math.sqrt(edx * edx + edy * edy);

            if (edist < 24) {
              // Torpedo HIT enemy!
              torp.timeLeft = 0; // destroy torpedo
              
              if (torp.isEmp) {
                enemy.hull -= 15; // smaller hull damage
                enemy.isStunned = true;
                enemy.stunTimer = 100; // 10 seconds (100 frame ticks of 100ms)
                enemy.isDetected = true;
                enemy.lastDetectedTime = Date.now();
                enemy.behaviorState = 'HUNT';
                
                addLog(`【高周波電磁パルス炸裂】：敵艦 CON-${enemy.id.slice(0,3)} に高圧EMPが直撃！電子・推進計器を無効化、完全に機能停止（システム・マヒ状態）！`, 'success');
                audio.playExplosion(0.9);
              } else {
                enemy.hull -= 50; // Deal heavy blow
                enemy.isDetected = true;
                enemy.lastDetectedTime = Date.now();
                enemy.behaviorState = 'HUNT';

                addLog(`ソナー報告。敵艦 CON-${enemy.id.slice(0,3)} に直接雷撃命中を確認！ 爆発音が反響しています。`, 'success');
                audio.playExplosion(1.2);
              }

              if (enemy.hull <= 0) {
                // Killed target!
                addLog(`【標的沈没】敵艦 CON-${enemy.id.slice(0,3)} の轟沈、水圧圧壊音を聴音（資材 +${enemy.type === 'DESTROYER' ? 150 : 100}g）`, 'success');
                const killBounty = enemy.type === 'DESTROYER' ? 150 : 100;
                setGameState((prev) => ({
                  ...prev,
                  gold: prev.gold + killBounty,
                  score: prev.score + (enemy.type === 'DESTROYER' ? 200 : 120),
                }));
                // Check stage completion count
                if (enemy.type !== 'MINE') {
                  setCurrentLevelKills((k) => k + 1);
                }
              }
            }
          });
        } else {
          // Hostile projectile tracking
          // Check if hitting Player Submarine
          const pdx = sub.x - torp.x;
          const pdy = sub.y - torp.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

          if (pdist < 22) {
            torp.timeLeft = 0; // explode
            
            if (sub.shieldActive) {
              sub.shieldActive = false;
              addLog('【防護シールド作動】：音響障壁シールド（Acoustic Shield）が衝撃エネルギーを完全吸収、無害化に成功しました！', 'success');
              audio.playExplosion(0.5); // faint muffle
            } else {
              // Apply damage based on if it was a deep depth charge or direct torpedo
              const isCharge = torp.id.startsWith('CHARG');
              const damage = isCharge ? 25 : 40;
              sub.hull -= damage;

              addLog(
                isCharge 
                  ? `【至近爆破警告】! 爆雷（Depth Charge）が艦体横甲板にて炸裂、隔壁が激しく損傷！ (-${damage} 船体)`
                  : `【被雷警告】! 敵の魚雷が直撃、船殻が裂け大ダメージ！ (-${damage} 船体)`,
                'alert'
              );
              audio.playExplosion(1.4);
            }
          }
        }
      });

      // Filter out dead torpedoes
      torpedoesRef.current = torpedoesRef.current.filter((t) => t.timeLeft > 0);

      // Warning alarms
      if (warningIncomingTorp && !soundMuted) {
        audio.startKlaxon();
      }

      // Sync subState reference
      setSubState({ ...sub });
    }, 100);

    return () => clearInterval(gameInterval);
  }, [gameState.playState, gameState.stage, upgradeStats, soundMuted]);

  const subSpeedNoise = subState.speed === 3 ? 90 : subState.speed === 2 ? 40 : subState.speed === 1 ? 8 : 1;
  const totalAcousticFootprint = subSpeedNoise + (sonarMode === 'ACTIVE' ? 120 : 0) + (subState.isSurfaced ? 80 : 0);
  const actualDampenedNoise = totalAcousticFootprint * (1 - upgradeStats.engineSilence);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100 select-none font-mono" id="app-wrapper">
      {/* Dynamic Animated Undersea Particles Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/10 via-slate-950 to-neutral-950 pointer-events-none z-0"></div>
      
      {/* Tactical Cockpit Glass Reflection overlay (Frosted Glass theme element) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.015] to-white/0 pointer-events-none z-10"></div>

      {/* Cockpit Status Header */}
      <header className="h-14 border-b border-white/10 shrink-0 flex justify-between items-center px-4 bg-slate-900/95 [backdrop-filter:blur(8px)] z-40 relative shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border border-cyan-500/20 bg-cyan-600/10 text-cyan-400 flex items-center justify-center animate-pulse">
            <Anchor className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-xs tracking-[0.18em] text-white flex items-center gap-2">
              <span>SILENT WATER</span>
              <span className="text-[9px] text-cyan-500 font-semibold tracking-normal px-1.5 py-0.5 bg-cyan-950/40 border border-cyan-500/20 rounded ml-1 animate-pulse">// 対潜音響戦</span>
            </h1>
          </div>
        </div>

        {/* Global info segment */}
        <div className="flex items-center gap-5 shrink-0 select-none">
          {gameState.playState === 'PLAYING' && (
            <>
              {/* Tactical Manual Toggle Button */}
              <button
                id="btn-toggle-manual-cockpit"
                onClick={() => setShowManual((prev) => !prev)}
                className="px-3 py-1 bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-[10px] font-bold text-cyan-400 flex items-center gap-1.5 cursor-pointer hover:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all z-20"
                title="音響戦術説明書を表示"
              >
                <Info className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>作戦説明書 (MANUAL)</span>
              </button>

              <div className="text-right hidden sm:block">
                <span className="text-[9px] text-slate-500 block leading-none">作戦海域</span>
                <span className="font-mono text-xs leading-none text-cyan-400 font-bold">海域 #{gameState.stage}</span>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[9px] text-slate-500 block leading-none">残機雷/敵艦</span>
                <span className="font-mono text-xs leading-none text-rose-400 font-bold">
                  {totalLevelKillsNeeded - currentLevelKills} 隻
                </span>
              </div>
            </>
          )}

          {gameState.playState !== 'TITLE' && (
            <>
              <div className="text-right">
                <span className="text-[9px] text-slate-500 block leading-none">スコア</span>
                <span className="font-mono text-xs leading-none text-emerald-400 font-bold">{gameState.score} pt</span>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-slate-500 block leading-none">軍ゴールド</span>
                <span className="font-mono text-xs leading-none text-amber-400 font-bold">{gameState.gold} Cr</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Screen Layout Container dynamically allowing scrolling on non-playing upgrade/title panels */}
      <main className={`flex-1 w-full max-w-[1450px] mx-auto p-3 flex flex-col relative z-10 min-h-0 ${gameState.playState === 'PLAYING' ? 'justify-center overflow-hidden' : 'overflow-y-auto py-6'}`}>
        <AnimatePresence mode="wait">

          {/* TITLE SCREEN SCENE */}
          {gameState.playState === 'TITLE' && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.01 }}
              className="max-w-2xl mx-auto w-full bg-[#070b13]/95 backdrop-blur-md border border-cyan-500/25 rounded-2xl p-6 my-auto text-center shadow-[0_0_50px_rgba(6,182,212,0.18)] relative overflow-hidden flex flex-col items-center justify-center shrink-0 crt-flicker"
              id="military-terminal-root"
            >
              {/* Retro HUD Styles Injection */}
              <style>{`
                @keyframes terminal-sweep {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                @keyframes terminal-scanline {
                  0% { transform: translateY(-100%); }
                  100% { transform: translateY(100%); }
                }
                @keyframes sound-bounce {
                  0%, 100% { transform: scaleY(0.2); }
                  50% { transform: scaleY(1); }
                }
                .sweep-line {
                  animation: terminal-sweep 12s linear infinite;
                }
                .scan-bar {
                  animation: terminal-scanline 6s linear infinite;
                }
                .animate-bounce-custom {
                  animation: sound-bounce 1s ease-in-out infinite;
                }
                .crt-flicker {
                  animation: crtFlicker 0.25s infinite;
                }
                @keyframes crtFlicker {
                  0%, 100% { opacity: 0.992; }
                  50% { opacity: 1; }
                }
              `}</style>

              {/* CRT Scanline Indicator */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03] z-25">
                <div className="w-full h-1 bg-cyan-400 scan-bar"></div>
              </div>

              {/* Ambient Circular Grid Radar in Background */}
              <div className="absolute -top-12 -right-12 w-64 h-64 border border-cyan-500/10 rounded-full flex items-center justify-center pointer-events-none opacity-40">
                <div className="w-48 h-48 border border-dashed border-cyan-500/5 rounded-full flex items-center justify-center">
                  <div className="w-32 h-32 border border-cyan-500/5 rounded-full flex items-center justify-center">
                    <div className="w-0.5 h-32 bg-cyan-500/15 origin-bottom sweep-line" style={{ transformOrigin: 'center center' }}></div>
                  </div>
                </div>
              </div>

              {/* Submarine Console Corner Brackets */}
              <div className="absolute top-3 left-3 font-mono text-[9px] text-cyan-600/60 leading-none select-none">
                [SYS_LOC: DEEP_SEA_GRID_04]
              </div>
              <div className="absolute top-3 right-3 font-mono text-[9px] text-cyan-600/60 leading-none select-none">
                [SYS_CODE: SW-882-AX]
              </div>
              <div className="absolute bottom-3 left-3 font-mono text-[9px] text-cyan-600/60 leading-none select-none">
                [STATION: AUDIO_CON_PROT]
              </div>
              <div className="absolute bottom-3 right-3 font-mono text-[9px] text-slate-600 select-none">
                VER 2.4.0
              </div>

              {/* Top Submarine Icon Grid */}
              <div className="mb-3.5 relative">
                <div className="w-14 h-14 rounded-full border border-cyan-500/30 p-2 bg-slate-950 text-cyan-400 flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.25)] relative z-10">
                  <Anchor className="w-7 h-7" />
                </div>
                {/* Glowing Radar Sweep Ring beneath */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-cyan-500/10 animate-ping" style={{ animationDuration: '3s' }}></div>
              </div>

              <h2 className="text-3xl font-black text-white tracking-[0.3em] pl-[0.3em] font-sans text-center drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                SILENT WATER
              </h2>
              <p className="text-cyan-455 text-[10px] font-bold tracking-[0.25em] mb-4 uppercase font-mono bg-cyan-950/30 border border-cyan-500/10 px-3 py-1 rounded">
                // 特務潜水艦ステルス音響戦術・模擬管制プロトコル
              </p>

              {/* Dynamic Oscilloscope Display - Simulated Digital Input Waves */}
              <div className="w-full max-w-md bg-slate-950/80 border border-cyan-500/15 rounded-lg py-1.5 px-3 flex items-center justify-between mb-4 font-mono text-[9px] text-cyan-500/70 select-none shadow-inner">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                  HYDROPHONE CORE INPUT:
                </span>
                
                {/* 14 bouncing equalizers representing real-time passive acoustics */}
                <div className="flex items-end gap-0.5 h-5 pr-1" style={{ transform: 'rotate(0deg)' }}>
                  {[1.1, 1.4, 0.7, 1.5, 0.5, 1.8, 1.0, 1.3, 0.6, 1.7, 0.9, 1.2, 0.4, 1.6].map((rate, idx) => (
                    <div
                      key={idx}
                      className="w-1 bg-[#22d3ee] rounded-t-sm origin-bottom"
                      style={{
                        height: '100%',
                        animation: `sound-bounce ${rate}s ease-in-out infinite`,
                        animationDelay: `${idx * -0.15}s`
                      }}
                    ></div>
                  ))}
                </div>
              </div>

              {/* TACTICAL BRIEFING DOSSIER - Tabs Navigation */}
              <div className="w-full flex border-b border-cyan-500/20 mb-3.5 text-xs font-mono select-none" id="briefing-nav">
                <button
                  type="button"
                  onClick={() => {
                    setTitleTab('mission');
                    audio.playSonarPing(0.08, 1.8);
                  }}
                  className={`flex-1 py-1.5 text-center border-t border-x rounded-t-lg transition-all ${
                    titleTab === 'mission'
                      ? 'bg-slate-950 border-cyan-500/30 text-cyan-400 font-bold shadow-[0_-2px_10px_rgba(6,182,212,0.1)]'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  【1. 極秘任務 BRIEF】
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleTab('sonar');
                    audio.playSonarPing(0.08, 1.8);
                  }}
                  className={`flex-1 py-1.5 text-center border-t border-x rounded-t-lg transition-all ${
                    titleTab === 'sonar'
                      ? 'bg-slate-950 border-cyan-500/30 text-cyan-400 font-bold shadow-[0_-2px_10px_rgba(6,182,212,0.1)]'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  【2. 聴音解析 SONAR】
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleTab('weapons');
                    audio.playSonarPing(0.08, 1.8);
                  }}
                  className={`flex-1 py-1.5 text-center border-t border-x rounded-t-lg transition-all ${
                    titleTab === 'weapons'
                      ? 'bg-slate-950 border-cyan-500/30 text-cyan-400 font-bold shadow-[0_-2px_10px_rgba(6,182,212,0.1)]'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  【3. 潜航兵装 GEAR】
                </button>
              </div>

              {/* TACTICAL BRIEFING DOSSIER - Content Panel */}
              <div className="bg-slate-950/70 p-4 border border-cyan-500/10 rounded-xl text-left text-[11px] mb-5 font-sans leading-relaxed min-h-[175px] max-h-[175px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                
                {titleTab === 'mission' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2.5"
                  >
                    <p className="text-slate-200 font-bold border-b border-cyan-500/15 pb-1 flex items-center gap-1.5 text-xs text-cyan-400">
                      <span className="p-0.5 bg-cyan-500/10 rounded"><Info className="w-3.5 h-3.5 text-cyan-400" /></span>
                      ハイドロフォンの「聴音」のみで深海の支配者となれ
                    </p>
                    <p className="text-slate-350 leading-relaxed">
                      ここは漆黒の冷たき深海。艦外カメラもレーザー目視も一切機能しない。
                      視覚的探知が封じられた特殊作戦領域において、<strong>周囲を飛び交う極超低周波ノイズ（青い方位軸ログ）だけが唯一の「眼」となる。</strong>
                    </p>
                    <p className="text-slate-350">
                      敵の駆逐艦や機雷敷設型潜水艦は刻一刻と自艦へ迫る。音を消して忍び寄り、パッシブソナーによる「測的操作」と「無音潜水航法」を用いて敵の先手を取り、深海底の亡霊に仕立て上げよ。
                    </p>
                  </motion.div>
                )}

                {titleTab === 'sonar' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <p className="text-cyan-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">// A. パッシブ探知 (NOISE)</p>
                        <p className="text-slate-400 leading-normal text-[10px]">
                          敵艦がスクリューから放出する「音響ノイズ」は青い波形ビームとしてコックピット周囲に描画されます。推進速度や砲撃に近いほど、ビームは太く明瞭に変化します。
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">// B. 音響掃射 (ACTIVE PING)</p>
                        <p className="text-slate-400 leading-normal text-[10px]">
                          「PING」は全標的・障害物の座標をソナー上に一瞬で完全に投影しますが、<b>放散した大音響エネルギーにより自艦の真の位置をすべての敵艦に漏洩する諸刃 of 剣。</b>
                        </p>
                      </div>
                    </div>

                    <div className="p-1.5 bg-amber-500/10 border border-amber-500/25 text-[9px] text-amber-300 rounded leading-normal font-mono">
                      【警告：酸素制限】 前進中（微速〜極限加速）および各電磁デバイスは電力を激しく消費します。限界深度にて速度「0」で完全に機関を止め、「海面浮上」を指示して即時急速充電を。
                    </div>
                  </motion.div>
                )}

                {titleTab === 'weapons' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-2.5"
                  >
                    <p className="text-slate-200 font-bold border-b border-cyan-500/15 pb-1 flex items-center gap-1.5 text-xs text-rose-455 font-mono">
                      <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                      SUB-ARSENAL: ステルス型高精密自動音響誘導システム
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px]">
                      <div>
                        <span className="text-rose-400 font-bold">1. 音響追従誘導魚雷 (TORPEDO)</span>
                        <p className="text-slate-400 text-[9.5px]">周囲ディスプレイの任意の箇所を長押し/タップして投射。その音響特性により、付近の最騒音標的に吸い寄せられる音響ホーミングを搭載。</p>
                      </div>
                      <div>
                        <span className="text-cyan-400 font-bold">2. 気泡音響デコイ (DECOY)</span>
                        <p className="text-slate-400 text-[9.5px]">ロックオントリガを無力化するためのボイド強気泡。迫りくる誘導魚雷の追従目標をバブルダミーへ転写・爆散誘発させます。</p>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-cyan-500/10 text-[9px] text-slate-400 flex items-center gap-2">
                      <span className="text-sky-450 font-semibold bg-sky-950/40 px-1 py-0.5 rounded border border-sky-500/10">STAGE 1 クリア解放</span>
                      <span>超特兵器「電磁波EMP魚雷」「広域共鳴衝撃波」「音響偏向シールド」の開発がドックにて可能になります。</span>
                    </div>
                  </motion.div>
                )}

              </div>

              {/* Action play button with Hazard strip border panel */}
              <button
                id="btn-play-game"
                onClick={() => {
                  audio.playSonarPing(0.6, 0.9); // Deep epic ping
                  startGame();
                }}
                className="w-full relative group bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-extrabold py-3 px-4 rounded-xl tracking-[0.2em] text-xs uppercase flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer shadow-[0_4px_25px_rgba(34,211,238,0.2)] hover:shadow-[0_4px_35px_rgba(34,211,238,0.45)] border border-cyan-400/50 outline-none active:scale-[0.98]"
              >
                {/* Visual indicator lines */}
                <div className="absolute inset-y-0 left-0 w-3 bg-cyan-300 opacity-20 rounded-l-xl group-hover:opacity-40 transition-opacity"></div>
                <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
                <span>潜航開始 (CRASH DIVE PROT)</span>
                <div className="absolute inset-y-0 right-0 w-3 bg-cyan-300 opacity-20 rounded-r-xl group-hover:opacity-40 transition-opacity"></div>
              </button>

              {/* Footer Panel displaying Tactical Rating telemetry */}
              <div className="mt-4 w-full flex justify-between items-center text-[10px] text-slate-500 font-mono border-t border-cyan-500/10 pt-3">
                <span className="flex items-center gap-1 bg-[#091520] border border-cyan-500/10 px-2 py-0.5 rounded text-[9.5px]">
                  司令評価最高値: <strong className="text-amber-400 font-bold ml-1">{gameState.highScore} pt</strong>
                </span>
                <span className="flex items-center gap-1.5 text-[#22d3ee]/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  HYDRO-SYSTEM: ONLINE
                </span>
              </div>
            </motion.div>
          )}

          {/* ACTIVE PLAYING GAME INTERFACE - 1 Screen Cockpit Fit */}
          {gameState.playState === 'PLAYING' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full max-h-full overflow-hidden items-stretch text-slate-100 min-h-0 w-full"
            >
              {/* Left Column: Submarine Gauges & Speed Controls */}
              <div className="lg:col-span-3 flex flex-col gap-2.5 max-h-full overflow-y-auto scrollbar-none min-h-0 shrink-0">
                {/* Gauge parameters console block */}
                <StatsPanel
                  sub={subState}
                  noiseLevel={actualDampenedNoise}
                  reloadProgress={gameState.torpedoReloadTicks}
                  onSurface={handleSurface}
                  canSurface={subState.speed <= 1}
                />
                
                {/* Telegraph & rudder steering block */}
                <ControlPanel
                  sub={subState}
                  onSetSpeed={handleSetSpeed}
                  onSetHeading={handleSetHeading}
                  onAdjustHeading={handleAdjustHeading}
                />
              </div>

              {/* Center Column: Interactive Tactical Scope display */}
              <div className="lg:col-span-6 flex flex-col justify-center items-center h-full min-h-0 overflow-hidden relative" id="center-radar-container">
                <RadarScreen
                  sub={subState}
                  enemies={enemiesRef.current}
                  torpedoes={torpedoesRef.current}
                  decoys={decoysRef.current}
                  obstacles={obstaclesRef.current}
                  sonarRange={INITIAL_SONAR_RANGE * upgradeStats.sonarRange}
                  onFireTorpedo={handleFireTorpedo}
                  onLaunchDecoy={handleLaunchDecoy}
                  onActivePing={handleActivePing}
                  sonarMode={sonarMode}
                  activePingWave={activePingWave}
                  setActivePingWave={setActivePingWave}
                  soundMuted={soundMuted}
                  onToggleMute={handleToggleMute}
                  shockwaveVisualRing={shockwaveVisualRing}
                  activeWeapon={activeWeapon}
                  setActiveWeapon={setActiveWeapon}
                  onLaunchShockwave={handleSonicShockwave}
                />
              </div>

              {/* Right Column: Communications console & warnings */}
              <div className="lg:col-span-3 flex flex-col gap-2.5 h-full min-h-0 overflow-hidden shrink-0">
                <LogConsole logs={logs} />
                
                {/* Visual state cockpit warnings (only populated when necessary) */}
                <div className="space-y-2 shrink-0">
                  {subState.hull < 30 && (
                    <div className="bg-rose-950/20 border border-rose-500/80 p-2.5 rounded-xl text-rose-450 font-bold mt-1.5 animate-pulse flex items-center justify-center gap-2">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <div className="text-left text-xs leading-normal">
                        <p className="text-[11px] font-extrabold uppercase">// 船体圧潰臨界警報 (HULL BREACH imminent)</p>
                        <p className="text-[9px] font-normal opacity-80 text-slate-300 mt-0.5">
                          外殻構造が限界深度圧により破られます。ただちに浮上及び修復せよ！
                        </p>
                      </div>
                    </div>
                  )}

                  {subState.isSurfaced && (
                    <div className="bg-amber-500/10 border border-amber-500/40 p-2.5 rounded-xl text-amber-400 font-bold mt-1.5 flex items-center gap-2">
                      <Sun className="w-5 h-5 shrink-0 animate-spin" style={{ animationDuration: '20s' }} />
                      <div className="text-left text-xs leading-normal">
                        <p className="text-[11px] font-extrabold uppercase">// 海面浮上航行：非隠蔽</p>
                        <p className="text-[9px] font-normal opacity-75 text-slate-400 mt-0.5">
                          ディーゼル吸気中。空からの駆逐艦砲撃に極めて脆弱です。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* BETWEEN MISSION UPGRADES SCREEN */}
          {gameState.playState === 'UPGRADES' && (
            <motion.div
              key="upgrades"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full my-auto flex flex-col items-center"
            >
              <UpgradeScreen
                gold={gameState.gold}
                stats={upgradeStats}
                onPurchaseUpgrade={handlePurchaseUpgrade}
                onNextStage={handleNextStage}
                stage={gameState.stage}
              />
            </motion.div>
          )}

          {/* GAME OVER SCENE */}
          {gameState.playState === 'GAMEOVER' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto bg-neutral-900 border border-red-950 rounded-lg p-6 my-auto text-center shadow-[0_15px_40px_rgba(240,0,0,0.15)] select-none"
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full border border-red-500/30 p-3 bg-red-950/20 text-red-500 flex items-center justify-center animate-pulse">
                  <Skull className="w-10 h-10" />
                </div>
              </div>

              <h2 className="text-xl font-extrabold text-red-500 uppercase tracking-widest mb-1">
                【潜水艦大破圧壊】
              </h2>
              <p className="text-neutral-500 text-xs mb-6">
                SOUND DEFEAT IN INTENSIVE DEPTHS
              </p>

              {/* Game Stats */}
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-md text-left text-xs mb-6 space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-500">到達作戦海域 (LAST SECTOR):</span>
                  <span className="font-bold text-neutral-100">WAVE {gameState.stage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">最終獲得軍資 (SALVAGED CREDITS):</span>
                  <span className="font-bold text-amber-400">{gameState.gold} Cr</span>
                </div>
                <div className="flex justify-between border-t border-neutral-900 pt-2 text-sm">
                  <span className="text-neutral-400 font-bold">最終獲得スコア (TOTAL SCORE):</span>
                  <span className="font-extrabold text-emerald-400">{gameState.score} pt</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>過去の最高スコア (HIGH SCORE):</span>
                  <span>{gameState.highScore} pt</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  id="btn-restart-game"
                  onClick={startGame}
                  className="w-full bg-red-500 hover:bg-red-400 text-black font-extrabold py-2.5 rounded text-xs tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all outline-none animate-pulse"
                >
                  <Trophy className="w-4 h-4" />
                  <span>主機関再始動・再挑戦 (REDEPLOY TACTICAL)</span>
                </button>
                
                <button
                  id="btn-back-to-home"
                  onClick={() => setGameState((prev) => ({ ...prev, playState: 'TITLE' }))}
                  className="w-full bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-slate-200 font-bold py-2.5 rounded text-xs tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all outline-none"
                >
                  <span>司令部ホーム画面に戻る (RETURN TO BASE)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* OPERATIONS GUIDE JAPANESE INTERACTIVE MODAL OVERLAY */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
            id="manual-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-neutral-900 border-2 border-cyan-500/80 rounded-2xl p-6 max-w-2xl w-full text-slate-100 font-mono shadow-[0_0_50px_rgba(6,182,212,0.35)] relative overflow-hidden"
              id="manual-modal-content"
            >
              {/* Decorative corner grid marks */}
              <div className="absolute top-2 left-2 text-[8px] text-cyan-500/30 font-bold select-none">[SYS_MAN_A2]</div>
              <div className="absolute bottom-2 right-2 text-[8px] text-cyan-500/30 font-bold select-none">CONFIDENTIAL</div>

              <div className="flex justify-between items-center border-b border-cyan-500/30 pb-3 mb-4">
                <h3 className="text-md sm:text-lg font-bold text-cyan-400 flex items-center gap-2">
                  <Info className="w-5 h-5 shrink-0 animate-bounce" />
                  <span>深海音響戦術マニュアル (TACTICAL HANDBOOK)</span>
                </h3>
                <button
                  onClick={() => setShowManual(false)}
                  className="px-2.5 py-1 text-[10px] sm:text-xs font-semibold bg-cyan-950/40 hover:bg-cyan-500 hover:text-black border border-cyan-500/40 rounded transition-all cursor-pointer animate-pulse"
                  id="btn-close-manual"
                >
                  閉じる (CLOSE)
                </button>
              </div>

              {/* Handbook detail body */}
              <div className="space-y-4 text-xs max-h-[320px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-900">
                <div>
                  <h4 className="text-cyan-400 font-bold mb-1 border-l-2 border-cyan-400 pl-1.5">// 敵艦の探知（聴音と能動波）</h4>
                  <p className="text-[11px] text-slate-350 leading-relaxed pl-1.5">
                    - <strong>パッシブ（聴音）[常時]</strong>: ディスプレイ上の<strong>「青い帯光線」</strong>は敵航行音の角度を指します。敵との距離が近いか、敵が激しい推進をしているほど太く輝きますが、敵が全停止している場合は方位線すら検知できません。
                    <br />
                    - <strong>アクティブ・ピン (PING) [蓄電20%消費]</strong>: 「PING」ボタンは強力な音波を放ち、自艦から全方向へ反射波を飛ばします。これによって<strong>敵の位置、艦種、敵の魚雷、および水中機雷をすべて赤く・黄色く数秒間マップ上に完全可視化</strong>します。
                    <br />
                    <span className="text-rose-450 font-bold text-[10px]">※極めて重要: PINGを放つと、自艦の座標情報が完全に露出するため、警戒中の全ての敵が瞬間に自艦をターゲットとして猛加速し、対潜魚雷を乱射してきます。</span>
                  </p>
                </div>

                <div>
                  <h4 className="text-rose-400 font-bold mb-1 border-l-2 border-rose-500 pl-1.5">// 兵装の使用（指向型魚雷の発射）</h4>
                  <p className="text-[11px] text-slate-350 leading-relaxed pl-1.5">
                    - <strong>ソナー面を直接クリック (FIRE)</strong>: ディスプレイ上のクリックした座標に向けて、高能動誘導魚雷を射出します。
                    <br />
                    - <strong>音響ホーミング（誘導精度）</strong>: 本機の魚雷は、<strong>現在動いている中で一番大きなノイズ（推進力）を発している物体</strong>へ向かって自動的に舵を切り突撃します。「急速戦速」で走る駆逐艦・敵潜には百発百中ですが、完全に「停止」している無音艦は誘導できずに通り抜けてしまいます。
                  </p>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold mb-1 border-l-2 border-emerald-500 pl-1.5">// 防御戦術（音響ソナーデコイ）</h4>
                  <p className="text-[11px] text-slate-350 leading-relaxed pl-1.5">
                    - <strong>デコイの射出 (DECOY) [蓄電15%消費]</strong>: 自艦に敵魚雷がロックオンして迫ってきた場合は、即座に「DECOY」を射出して下さい。強力な膨張気泡音を放つダミー標的を放出し、敵魚雷のホーミング標的を強力に誘引します。引きつけられた魚雷はデコイへ向かい、そこで自爆します。
                  </p>
                </div>

                <div>
                  <h4 className="text-amber-400 font-bold mb-1 border-l-2 border-amber-500 pl-1.5">// 推進速度と、酸素・充電の回復システム</h4>
                  <p className="text-[11px] text-slate-350 leading-relaxed pl-1.5">
                    - <strong>「無音微速 (Silent)」</strong>: この状態で走れば、自艦ノイズは極限まで抑え込まれ、敵魚雷からも実質完全に不可視になります。
                    <br />
                    - <strong>「海面浮上 (SURFACE)」</strong>: 電池を消費するか酸素が少なくなったら、速度を「全停止」か「無音微速」に落とし、敵の射程外（赤いソナー警告ラインが光っていない状況）で「海面浮上」をタップ。
                    海面に上がって酸素吸気と蓄電池をフル補給します。<strong>追撃されている段階で浮上するとディーゼル音が敵に伝わり、駆逐艦から大砲撃されます。</strong>
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-cyan-500/20 flex justify-between items-center text-[10px] text-slate-400 leading-none">
                <span>深海域ハイドロフォン通信・オペレータパネル端末</span>
                <span className="text-cyan-400 font-bold">COMMANDS READY</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Cockpit bottom credit lines conforming with simple anti-clutter */}
      <footer className="py-2.5 px-4 bg-neutral-950 text-center text-[9px] text-neutral-600 border-t border-neutral-900 shrink-0 z-20 font-sans tracking-wide">
        Developed in high-contrast submarine cockpit mode. Headphones highly recommended for acoustic navigation. (C) Deep Sea Naval Tactical Command.
      </footer>
    </div>
  );
}

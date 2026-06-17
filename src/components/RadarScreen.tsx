import React, { useRef, useEffect, useState } from 'react';
import { Submarine, Enemy, Torpedo, Decoy, SonarBlip, Obstacle } from '../types';
import { audio } from '../lib/audio';
import { Volume2, VolumeX, Eye, Radio, Shield, Zap } from 'lucide-react';

// 決定論的なノイズによって、岩礁に歪(いびつ)で自然な形を与える関数
// IDごとに固有のハッシュ(シード値)を計算し、描画フレーム間で揺れないようにします
function getWarpedObstaclePoints(id: string, cx: number, cy: number, radius: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const segments = 24; // 滑らかで複雑な岩肌を表現するために24分割
  
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed += id.charCodeAt(i) * (i + 1);
  }

  for (let i = 0; i < segments; i++) {
    const angle = (i * Math.PI * 2) / segments;
    
    // サイン波やハッシュ化した乱数を組み合わせ、うねりと尖りを作成
    const pseudoRandom = Math.abs(Math.sin(seed + i * 2.3) * 10000) % 1;
    const offsetFactor = 0.78 + pseudoRandom * 0.42; // 半径が0.78倍〜1.2倍の間で変形するように
    
    const r = radius * offsetFactor;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }

  return points;
}

interface RadarScreenProps {
  sub: Submarine;
  enemies: Enemy[];
  torpedoes: Torpedo[];
  decoys: Decoy[];
  obstacles?: Obstacle[];
  sonarRange: number;
  onFireTorpedo: (heading: number) => void;
  onLaunchDecoy: () => void;
  onActivePing: () => void;
  sonarMode: 'PASSIVE' | 'ACTIVE';
  activePingWave: number; // radius of active ping expanding (0-1000)
  setActivePingWave: React.Dispatch<React.SetStateAction<number>>;
  soundMuted: boolean;
  onToggleMute: () => void;
  shockwaveVisualRing: number;
  activeWeapon: 'NORMAL' | 'EMP';
  setActiveWeapon: (weapon: 'NORMAL' | 'EMP') => void;
  onLaunchShockwave: () => void;
}

export const RadarScreen: React.FC<RadarScreenProps> = ({
  sub,
  enemies,
  torpedoes,
  decoys,
  obstacles = [],
  sonarRange,
  onFireTorpedo,
  onLaunchDecoy,
  onActivePing,
  sonarMode,
  activePingWave,
  setActivePingWave,
  soundMuted,
  onToggleMute,
  shockwaveVisualRing,
  activeWeapon,
  setActiveWeapon,
  onLaunchShockwave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 450, height: 450 });
  
  // Rotating passive sweep line indicator
  const sweepAngleRef = useRef(0);
  const previousBlipAngles = useRef<{[id: string]: boolean}>({});

  // Monitor container size dynamically for desktop-first responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Get parent bounds to avoid overflowing vertically on PC screens
        const parentElement = containerRef.current?.parentElement;
        const parentHeight = parentElement ? parentElement.clientHeight : 450;
        const width = entry.contentRect.width;
        
        // Calculate maximum available space based on both height and width limits
        const titleAndControlOffset = 180; // height taken by title bar and active ping controls
        const availableHeight = Math.max(220, parentHeight - titleAndControlOffset);
        const minEdge = Math.min(width, availableHeight);
        
        // Keep it square within optimized console bounds (220px to 480px)
        const size = Math.max(220, Math.min(480, minEdge));
        setDimensions({ width: size, height: size });
      }
    });
    // Start observing
    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Main canvas animation and drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const radarRadius = Math.min(cx, cy) - 15;

      // 1. Solid Depth Ocean Background
      ctx.fillStyle = '#050c0a'; // ultra-dark marine green
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Radial background light glow
      const radialGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, radarRadius);
      radialGlow.addColorStop(0, '#0a1d17');
      radialGlow.addColorStop(0.8, '#060f0c');
      radialGlow.addColorStop(1, '#020605');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // 2. Compass Dial & Rings
      ctx.strokeStyle = '#10b98125'; // Emerald transparency
      ctx.lineWidth = 1;
      
      // Draw Concentric Reference Rings
      const rings = [0.25, 0.5, 0.75, 1.0];
      rings.forEach((ring) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radarRadius * ring, 0, Math.PI * 2);
        ctx.stroke();

        // Draw ring labels
        if (ring < 1.0) {
          ctx.fillStyle = '#05966950';
          ctx.font = '9px monospace';
          ctx.fillText(`${Math.round(sonarRange * ring)}m`, cx + 3, cy - (radarRadius * ring) - 2);
        }
      });

      // Draw Cross Heading lines
      ctx.strokeStyle = '#10b98115';
      ctx.beginPath();
      ctx.moveTo(cx - radarRadius, cy);
      ctx.lineTo(cx + radarRadius, cy);
      ctx.moveTo(cx, cy - radarRadius);
      ctx.lineTo(cx, cy + radarRadius);
      ctx.stroke();

      // Outer bezel circle
      ctx.strokeStyle = '#10b98150';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw Heading degrees on Outer bezel
      ctx.fillStyle = '#10b98170';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const degrees = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
      degrees.forEach((deg) => {
        // Compute position on circle
        const angleRad = ((deg - 90) * Math.PI) / 180;
        const x = cx + (radarRadius + 10) * Math.cos(angleRad);
        const y = cy + (radarRadius + 10) * Math.sin(angleRad);
        ctx.fillText(`${deg}°`, x, y);
      });

      // 3. Update & Draw Passive Sweep Vector
      sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360;
      const sweepRad = ((sweepAngleRef.current - 90) * Math.PI) / 180;
      
      // Sweep Phosphor Arc Tail (Fading gradient wedge)
      const tailLength = 40; // degrees
      for (let i = 0; i < tailLength; i++) {
        const alpha = (1 - i / tailLength) * 0.25;
        const trailRad = (((sweepAngleRef.current - 90 - i) % 360) * Math.PI) / 180;
        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radarRadius * Math.cos(trailRad), cy + radarRadius * Math.sin(trailRad));
        ctx.stroke();
      }

      // Strong Leading sweep arm
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radarRadius * Math.cos(sweepRad), cy + radarRadius * Math.sin(sweepRad));
      ctx.stroke();

      // 4. Draw Passive Sonar Hydrophone Hearing Spectrum Lines (Cyan wedges/beams)
      // Represent passive acoustic logs: lines going from center outwards matching relative bearing
      enemies.forEach((enemy) => {
        // Distance and heading
        const dx = enemy.x - sub.x;
        const dy = enemy.y - sub.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > sonarRange * 1.5) return; // Out of acoustic hearing threshold

        // Compute polar bearing relative to player sub position
        // angle is from 0 to 360
        let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (angleDeg < 0) angleDeg += 360;

        // Sound intensity depends on distance and speed of enemy (engine turn rate)
        const speedNoise = enemy.speed === 0 ? 5 : enemy.speed * 20; // quiet stationary mine vs fast destroyer
        const emissionLevel = enemy.passiveBearingNoise + speedNoise;
        
        // Passive detection coefficient
        const passiveVol = Math.max(0, Math.min(1, emissionLevel / (distance * 0.1)));

        if (passiveVol > 0.05) {
          const bearingRad = ((angleDeg - 90) * Math.PI) / 180;
          
          // Draw thin radiating listen line
          ctx.strokeStyle = `rgba(6, 182, 212, ${passiveVol * 0.4})`; // Cyan listening lines
          ctx.lineWidth = 1.2 + passiveVol * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          // stops short of the outer beaker
          ctx.lineTo(cx + (radarRadius * 0.95) * Math.cos(bearingRad), cy + (radarRadius * 0.95) * Math.sin(bearingRad));
          ctx.stroke();

          // Also trigger sound echo if sweep arm passes over
          const angleDiff = Math.abs((sweepAngleRef.current - angleDeg + 360) % 360);
          if (angleDiff < 2 && !previousBlipAngles.current[enemy.id]) {
            previousBlipAngles.current[enemy.id] = true;
            // Play faint sound click
            const panVal = Math.cos(bearingRad); // custom pan
            audio.playEcho(panVal, passiveVol * 0.4);
          } else if (angleDiff > 10) {
            previousBlipAngles.current[enemy.id] = false;
          }
        }
      });

      // 5. Active Sonar Expanding Wave Ping
      if (activePingWave > 0) {
        // Expand wave radius
        const relativeWaveRadius = activePingWave; // 0 to 1000 representing global coords range
        const viewWaveRadius = (relativeWaveRadius / sonarRange) * radarRadius;

        if (viewWaveRadius < radarRadius * 1.5) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.min(radarRadius, viewWaveRadius), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow

          // Trigger echoes and show enemies as the active ping wave strikes them
          enemies.forEach((enemy) => {
            const dx = enemy.x - sub.x;
            const dy = enemy.y - sub.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If active ping has reached the contact
            if (Math.abs(dist - relativeWaveRadius) < 18) {
              // Mark detected
              enemy.isDetected = true;
              enemy.lastDetectedTime = Date.now();
              enemy.behaviorState = 'HUNT'; // alerting enemies turns them hostile!

              // Play sharp metallic reflection Echo sound
              let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
              const bearingRad = ((angleDeg - 90) * Math.PI) / 180;
              const panVal = Math.cos(bearingRad);
              audio.playEcho(panVal, 1.0);
            }
          });
        }
      }

      // 5b. Shockwave Expanding Sapphire Pulse
      if (shockwaveVisualRing > 0) {
        const viewShockRadius = (shockwaveVisualRing / sonarRange) * radarRadius;
        if (viewShockRadius < radarRadius * 1.5) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // celestial sapphire sky blue
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.min(radarRadius, viewShockRadius), 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // 5c. Draw Reefs and Rock Obstacles
      obstacles.forEach((obs) => {
        const dx = obs.x - sub.x;
        const dy = obs.y - sub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 探知範囲に近い場合のみ表示（うっすらした索敵感と深度を感じさせるために 1.3 倍まで許容）
        if (dist > sonarRange * 1.3) return;

        const rx = cx + (dx / sonarRange) * radarRadius;
        const ry = cy + (dy / sonarRange) * radarRadius;
        const rRadius = (obs.radius / sonarRange) * radarRadius;

        let alpha = 0.45;
        if (dist > sonarRange) {
          // 探知圏外へのフェード
          alpha = 0.45 * (1 - (dist - sonarRange) / (sonarRange * 0.3));
        }

        ctx.save();
        ctx.beginPath();
        
        // 歪（いびつ）な多角形パスを生成して描画
        const warpedPoints = getWarpedObstaclePoints(obs.id, rx, ry, rRadius);
        if (warpedPoints.length > 0) {
          ctx.moveTo(warpedPoints[0].x, warpedPoints[0].y);
          for (let pIdx = 1; pIdx < warpedPoints.length; pIdx++) {
            ctx.lineTo(warpedPoints[pIdx].x, warpedPoints[pIdx].y);
          }
          ctx.closePath();
        }

        // 半透明の岩肌パターンの表現
        const grad = ctx.createRadialGradient(rx, ry, rRadius * 0.2, rx, ry, rRadius);
        grad.addColorStop(0, `rgba(180, 83, 9, ${alpha * 0.85})`); // amber-700
        grad.addColorStop(0.8, `rgba(120, 53, 4, ${alpha * 0.45})`); // amber-900
        grad.addColorStop(1, `rgba(120, 53, 4, 0)`); // Fade edge
        
        ctx.fillStyle = grad;
        ctx.fill();

        // 輪郭線（ノイズ混じりでリアルなスキャン線に見えるように）
        ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.75})`; // amber-500
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // テキストを一定のサイズ以上の岩礁に添える
        if (rRadius > 20) {
          ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.5})`;
          ctx.font = '8px monospace';
          ctx.fillText('SHALLOW_REEF', rx - 28, ry + 2.5);
        }
        ctx.restore();
      });

      // 6. Draw Decoys (Bubbling decoys that distract torpedoes)
      decoys.forEach((decoy) => {
        const dx = decoy.x - sub.x;
        const dy = decoy.y - sub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > sonarRange) return; // Out of radar scope limits

        const rx = cx + (dx / sonarRange) * radarRadius;
        const ry = cy + (dy / sonarRange) * radarRadius;

        // Pulsing bubbling signature
        const bubbleSec = (Date.now() / 250) % 3;
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rx, ry, 6 + bubbleSec * 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 7. Draw Torpedoes
      torpedoes.forEach((torp) => {
        const dx = torp.x - sub.x;
        const dy = torp.y - sub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > sonarRange) return; // Out of radar scope

        const rx = cx + (dx / sonarRange) * radarRadius;
        const ry = cy + (dy / sonarRange) * radarRadius;

        const headingRad = ((torp.heading - 90) * Math.PI) / 180;

        // Draw torpedo icon & trail
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(headingRad);

        if (torp.isPlayerOwned) {
          // Play torpedo (green cyan)
          ctx.fillStyle = '#06b6d4';
          ctx.strokeStyle = '#06b6d280';
          // Body shape
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(-4, -2.5);
          ctx.lineTo(-4, 2.5);
          ctx.closePath();
          ctx.fill();

          // Bubble tail
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(-8, 0, (Date.now() / 150) % 3 + 1, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Dangerous Enemy Torpedo (Red pulsing alert)
          const flash = Math.floor(Date.now() / 100) % 2 === 0;
          ctx.fillStyle = flash ? '#ef4444' : '#b91c1c';
          
          // Draw a jagged lock icon / torpedo
          ctx.beginPath();
          ctx.moveTo(5, 0);
          ctx.lineTo(-5, -3);
          ctx.lineTo(-5, 3);
          ctx.closePath();
          ctx.fill();

          // Threat circle
          ctx.strokeStyle = '#ef444450';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });

      // 8. Draw Detected / Visible Enemies
      enemies.forEach((enemy) => {
        // Calculate distance & heading relative to player sub
        const dx = enemy.x - sub.x;
        const dy = enemy.y - sub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if visible: either actively detected by a ping in the last 6 seconds
        // OR the enemy is close enough and emits massive sound, OR player surfaced and they are on top.
        const timeSinceDetection = Date.now() - enemy.lastDetectedTime;
        const isActiveDetected = enemy.isDetected && timeSinceDetection < 7500;
        
        // Passive proximity detection (if enemy passes very close or is moving super fast)
        const isCloseDetected = dist < 120 && enemy.speed > 0;
        const isVisible = isActiveDetected || isCloseDetected;

        if (isVisible && dist <= sonarRange) {
          const rx = cx + (dx / sonarRange) * radarRadius;
          const ry = cy + (dy / sonarRange) * radarRadius;

          const headingRad = (((enemy.heading || 0) - 90) * Math.PI) / 180;
          const alphaFade = isActiveDetected ? Math.max(0, 1 - timeSinceDetection / 7500) : 1;

          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(headingRad);

          // Draw distinct graphics per threat type
          if (enemy.hull <= 0) {
            // Dead enemy: Draw "X" cross mark
            ctx.strokeStyle = `rgba(239, 68, 68, ${alphaFade})`;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(-6, -6);
            ctx.lineTo(6, 6);
            ctx.moveTo(6, -6);
            ctx.lineTo(-6, 6);
            ctx.stroke();
          } else if (enemy.type === 'DESTROYER') {
            // Surface Destroyer Dropping charges (Draw elegant ironclad hull outline)
            ctx.fillStyle = `rgba(239, 68, 68, ${alphaFade})`;
            ctx.strokeStyle = `rgba(239, 68, 68, ${alphaFade * 0.5})`;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 4;

            ctx.beginPath();
            ctx.moveTo(9, 0); // bow (pointed front)
            ctx.lineTo(-4, -4.5);
            ctx.lineTo(-12, -3); // stern
            ctx.lineTo(-12, 3);
            ctx.lineTo(-4, 4.5);
            ctx.closePath();
            ctx.fill();

            // Sound propellor wake lines
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-13, -1);
            ctx.lineTo(-19, -2);
            ctx.moveTo(-13, 1);
            ctx.lineTo(-19, 2);
            ctx.stroke();
          } else if (enemy.type === 'MINE') {
            // Anchor underwater mine
            ctx.fillStyle = `rgba(245, 158, 11, ${alphaFade})`; // amber
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();

            // Spikes on mine
            ctx.strokeStyle = `rgba(245, 158, 11, ${alphaFade})`;
            ctx.lineWidth = 1.2;
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(8 * Math.cos(angle), 8 * Math.sin(angle));
              ctx.stroke();
            }
          } else {
            // Enemy Submarine
            ctx.fillStyle = `rgba(239, 85, 239, ${alphaFade})`; // magenta
            ctx.strokeStyle = `rgba(239, 85, 239, ${alphaFade * 0.4})`;
            ctx.shadowColor = '#ee55ee';
            ctx.shadowBlur = 4;

            ctx.beginPath();
            ctx.moveTo(7, 0); // pointy bow
            ctx.lineTo(-1, -3);
            ctx.lineTo(-10, -2.5); // long stern
            ctx.lineTo(-8, 0);
            ctx.lineTo(-10, 2.5);
            ctx.lineTo(-1, 3);
            ctx.closePath();
            ctx.fill();

            // Prop radial lines
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-11, -3);
            ctx.lineTo(-11, 3);
            ctx.stroke();
          }
          
          ctx.restore();
          ctx.shadowBlur = 0; // Reset glow

          // Draw HP bar if the enemy is alive
          if (enemy.hull > 0) {
            const maxH = enemy.maxHull || (enemy.type === 'DESTROYER' ? 80 : (enemy.type === 'SUBMARINE' ? 40 : 10));
            const pct = Math.max(0, Math.min(1, enemy.hull / maxH));
            
            // HP Bar container coordinates directly beneath the enemy icon
            const barW = 24;
            const barH = 3.5;
            const bx = rx - barW / 2;
            const by = ry + 12; // beneath enemy center

            // High-contrast background of HP Bar (dark slate gray/black border)
            ctx.fillStyle = `rgba(15, 23, 42, ${alphaFade * 0.9})`;
            ctx.fillRect(bx, by, barW, barH);

            // Active fill of HP Bar (emerald for high, amber for mid, red for low)
            let hpColor = '#10b981'; // Green
            if (pct < 0.3) {
              hpColor = '#ef4444'; // Red
            } else if (pct < 0.6) {
              hpColor = '#f59e0b'; // Amber
            }
            ctx.fillStyle = hpColor;
            ctx.globalAlpha = alphaFade;
            ctx.fillRect(bx, by, barW * pct, barH);
            ctx.globalAlpha = 1.0;

            // Highly visible light border surrounding parent bar for extreme depth environments
            ctx.strokeStyle = `rgba(255, 255, 255, ${alphaFade * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(bx, by, barW, barH);
          }

          // Enemy distance-bearing HUD coordinate trace label
          ctx.fillStyle = `rgba(16, 185, 129, ${alphaFade * 0.5})`;
          ctx.font = '8px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(
            `CON-${enemy.id.slice(0, 3)}: DST ${Math.round(dist)}m`,
            rx + 12,
            ry - 2
          );
        }
      });

      // 9. Draw Player Own-Ship Submarine in the absolute center
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((sub.heading - 90) * Math.PI) / 180);

      // Simple, beautiful glowing Submarine outline
      ctx.fillStyle = '#10b981'; // vibrant emerald
      ctx.strokeStyle = '#34d399';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 6;

      ctx.beginPath();
      ctx.moveTo(10, 0); // Bow
      ctx.lineTo(1, -4);
      ctx.lineTo(-12, -3.5); // Hull stern
      ctx.lineTo(-9, 0);
      ctx.lineTo(-12, 3.5);
      ctx.lineTo(1, 4);
      ctx.closePath();
      ctx.fill();

      // Sail (Conning tower) top fin detail
      ctx.fillStyle = '#059669';
      ctx.fillRect(-2, -1.5, 4, 3);

      // Stabilizers / rudder fins
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-10, 5);
      ctx.stroke();

      ctx.restore();
      ctx.shadowBlur = 0;

      // 9b. Active Sound Shield Bubble (glowing cyan orbit ring around submarine icon)
      if (sub.shieldActive) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)'; // cyan-500
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        // Pulsing radius slightly
        const pulseRad = 19 + Math.sin(Date.now() / 150) * 1.5;
        ctx.arc(cx, cy, pulseRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw a light glowing fill
        ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
        ctx.fill();
      }

      // Draw own-sub static radar center cross ring
      ctx.strokeStyle = '#10b98140';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();

      // End cycle, request next frame
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [dimensions, sub, enemies, torpedoes, decoys, sonarRange, activePingWave]);

  // Click on radar handler to trigger intuitive torpedo navigation vectors
  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    // Relative displacement
    const dx = clickX - cx;
    const dy = clickY - cy;

    // Angle of target relative to player
    // atan2 gives screen coordinate (0 at right, 90 down). we shift it to polar coordinate (0 top, 90 right)
    let headingDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (headingDeg < 0) headingDeg += 360;

    // Trigger weapon launches
    onFireTorpedo(Math.round(headingDeg));
  };
  return (
    <div className="flex flex-col items-center select-none h-full w-full min-h-0 overflow-hidden bg-neutral-950/80 backdrop-blur border border-neutral-800 rounded-xl shadow-[0_12px_44px_rgba(0,0,0,0.5)]" id="radar-component">
      {/* Radar Panel Header */}
      <div className="w-full flex justify-between items-center bg-neutral-900/60 border-b border-neutral-800 px-3.5 py-1.5 text-xs font-mono shrink-0">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Eye className="w-4 h-4 animate-pulse" />
          <span className="font-bold tracking-wider">作戦水域音響ディスプレイ (SONAR SCOPE)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <button
            onClick={onToggleMute}
            className={`p-1 rounded border transition-colors ${
              soundMuted
                ? 'bg-red-950/20 text-red-500 border-red-500/40 hover:bg-red-900/35'
                : 'bg-neutral-800 text-emerald-450 hover:bg-neutral-75 border-neutral-700'
            }`}
            title={soundMuted ? '音声出力有効化' : '音声ミュート'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[10px] text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-850 font-bold">
            RANGE: {sonarRange}m
          </span>
        </div>
      </div>

      {/* Canvas Frame Wrapper */}
      <div 
        ref={containerRef}
        className="flex-1 w-full bg-neutral-950 flex items-center justify-center p-2 overflow-hidden min-h-0 relative"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleRadarClick}
          className="border border-emerald-950/50 rounded-full cursor-crosshair shadow-[0_0_24px_rgba(16,185,129,0.12)] aspect-square transition-all"
          title="クリックすると魚雷を指定角へ向けて発射します"
        />
      </div>

      {/* Bottom Tactics Controls Section */}
      <div className="w-full bg-neutral-900 border-t border-neutral-800 p-3.5 rounded-b-lg font-mono text-xs flex flex-col gap-3 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          {/* Active Ping Launcher */}
          <button
            onClick={onActivePing}
            disabled={sub.battery < 20 || sub.isSurfaced}
            className={`py-2 px-3.5 rounded border flex items-center justify-center gap-2 font-bold transition-all ${
              sub.isSurfaced
                ? 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                : sonarMode === 'ACTIVE'
                  ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/50 cursor-pointer animate-pulse'
                  : sub.battery < 20
                    ? 'bg-red-950/10 text-red-500 border-red-950 cursor-not-allowed opacity-50'
                    : 'bg-emerald-950/40 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-pointer active:scale-95'
            }`}
            title="大音波のアクティブパルスを射出し、索敵限界までの全標的・浮遊魚雷をマップ上に鮮明表示します。ただし電力を20%消費し、敵艦全員に自艦の座標情報が通知されます。"
          >
            <Radio className="w-4 h-4 shrink-0" />
            <span>アクティブ・ピン (PING)</span>
          </button>

          {/* Anti-Torpedo Acoustic Decoy */}
          <button
            onClick={onLaunchDecoy}
            disabled={sub.decoys <= 0 || sub.battery < 15 || sub.isSurfaced}
            className={`py-2 px-3.5 rounded border flex items-center justify-center gap-2 font-bold transition-all ${
              sub.isSurfaced
                ? 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                : sub.decoys <= 0
                  ? 'bg-neutral-850 text-neutral-600 border-neutral-800 cursor-not-allowed'
                  : sub.battery < 15
                    ? 'bg-red-950/10 text-red-500 border-red-950 cursor-not-allowed opacity-50'
                    : 'bg-emerald-800/10 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/40 cursor-pointer active:scale-95'
            }`}
            title="高騒音デコイ弾（気泡音響体）を射出します。追いかけてくる敵の音響誘導魚雷の追従ターゲットをデコイ側に引き付けて自艦を守ります。（弾薬1、電磁力15%消費）"
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>音響デコイ射出 (DECOY)</span>
          </button>
        </div>

        {/* Dynamic Weapon Systems Row (Unlocked via Wave 2+) */}
        {(sub.hasEmpTorpedo || sub.hasShockwave) && (
          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-neutral-850">
            {/* EMP Weapon Toggle Selector */}
            {sub.hasEmpTorpedo ? (
              <div className="flex border border-neutral-750 rounded p-1 items-center bg-neutral-950/40 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveWeapon('NORMAL')}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-bold text-center transition-all ${
                    activeWeapon === 'NORMAL'
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  魚雷 ({sub.torpedoes})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWeapon('EMP')}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-bold text-center transition-all ${
                    activeWeapon === 'EMP'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title="高周波磁気パルス衝撃を敵艦へ放ち、10秒間移動及び遠距離索敵能力を完全にマヒさせます。"
                >
                  EMP ({sub.empTorpedoes})
                </button>
              </div>
            ) : (
              <div className="text-[10px] text-neutral-500 border border-dashed border-neutral-800 py-2 px-2 text-center rounded">
                魚雷射撃: 通常弾一択
              </div>
            )}

            {/* Sonic Pulse Shockwave trigger button */}
            {sub.hasShockwave ? (
              <button
                type="button"
                onClick={onLaunchShockwave}
                disabled={sub.shockwaves <= 0 || sub.battery < 30 || sub.isSurfaced}
                className={`py-2 px-2.5 rounded border flex items-center justify-center gap-1.5 font-bold transition-all text-[11px] ${
                  sub.isSurfaced
                    ? 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                    : sub.shockwaves <= 0
                      ? 'bg-neutral-850 text-neutral-600 border-neutral-800 cursor-not-allowed'
                      : sub.battery < 30
                        ? 'bg-red-955/10 text-red-500 border-red-950 cursor-not-allowed opacity-50'
                        : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/40 cursor-pointer active:scale-95'
                }`}
                title="全方位に高圧共振音響ショック波を放射し、自艦から350m以内の「敵魚雷・爆雷」をすべて無力化・消滅させ、同時にその範囲の敵艦を一時マヒさせます。（弾薬1、電力30%消費、自艦騒音レベル上昇）"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>衝撃波 ({sub.shockwaves})</span>
              </button>
            ) : (
              <div className="text-[10px] text-neutral-500 border border-dashed border-neutral-800 py-2 px-2 text-center rounded">
                衝撃波装置: 未搭載
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

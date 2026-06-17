export type EngineSpeed = 0 | 1 | 2 | 3; // Stop, Slow (Silent), Standard, Flank

export interface Submarine {
  x: number; // 0-1000 coordinate space
  y: number;
  heading: number; // Degrees 0-359 (0 is Up, 90 is Right)
  speed: EngineSpeed;
  targetHeading: number;
  hull: number; // Max 100
  battery: number; // Max 100 (for Active Sonar & Decoys)
  oxygen: number; // Max 100 (decreases over time, refills at surface)
  torpedoes: number; // Ammo count
  decoys: number; // Ammo count
  maxTorpedoes: number;
  maxDecoys: number;
  isSurfaced: boolean;
  // --- NEW WEAPONS & EQUIPMENT (Wave 2+) ---
  empTorpedoes: number;
  maxEmpTorpedoes: number;
  hasEmpTorpedo: boolean;
  shockwaves: number;
  maxShockwaves: number;
  hasShockwave: boolean;
  shieldActive: boolean;
  hasShieldModule: boolean;
}

export type EnemyType = 'SUBMARINE' | 'DESTROYER' | 'MINE';

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  heading: number;
  speed: number;
  hull: number;
  isDetected: boolean;          // True when actively pinged or highly noisy
  lastDetectedTime: number;     // Timestamp or game time tick of last detection
  passiveBearingNoise: number;  // Noise level currently emitted (visible on passive)
  behaviorState: 'PATROL' | 'HUNT' | 'EVADE';
  targetX?: number;
  targetY?: number;
  shootCooldown: number;        // Cooldown for depth charges or torpedoes
  isStunned?: boolean;          // NEW: Stunned state by EMP
  stunTimer?: number;           // NEW: Remaining stun frames
}

export interface Torpedo {
  id: string;
  x: number;
  y: number;
  heading: number;
  speed: number;
  isPlayerOwned: boolean;
  targetX?: number; // Homing target
  targetY?: number;
  homingStrength: number; // How aggressively it turns toward noise (0-1)
  isHomingDecoy: boolean; // Tracking decoy or player/enemy
  timeLeft: number; // Remaining lifetime in frames
  isEmp?: boolean;        // NEW: EMP shock payload
}

export interface Decoy {
  id: string;
  x: number;
  y: number;
  heading: number;
  speed: number;
  noiseLevel: number; // Attracts enemy homing torpedoes
  timeLeft: number; // Expiry timer
}

export interface SonarBlip {
  id: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  type: 'ENEMY' | 'PING' | 'EXPLOSION' | 'NOISE' | 'DECOY';
  timestamp: number;
}

export interface GameLog {
  id: string;
  timestamp: string; // "14:24:02" game-style clock
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
}

export interface UpgradeStats {
  sonarRange: number;       // Layer multiplier
  engineSilence: number;    // % noise reduction
  torpedoReload: number;    // Reload speed upgrade level
  hullPlating: number;      // Max hull addition
  batteryCapacity: number;  // Max battery level
  decoyRange: number;       // Power of decoys
  hasEmpTorpedo: boolean;   // Wave 2+ EMP Torpedo Unlock
  hasShockwave: boolean;    // Wave 2+ Sonic Pulse Shockwave Unlock
  hasShield: boolean;       // Wave 2+ Active sound shield Unlock
}

export interface GameState {
  score: number;
  stage: number;
  playState: 'TITLE' | 'PLAYING' | 'GAMEOVER' | 'VICTORY' | 'UPGRADES';
  gold: number;
  highScore: number;
  torpedoReloadTicks: number; // current progress
}

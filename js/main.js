// =============================================
// MAIN.JS — Entry point, screens, char creation
// =============================================
import { RACES, JOBS } from './data.js';
import { GameEngine } from './engine.js';

// =============================================
// SCREEN MANAGEMENT
// =============================================
let currentScreen = 'title';
let engine = null;

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (el) {
    el.classList.add('active');
    currentScreen = name;
  }
}

window.showScreen = showScreen;

// =============================================
// TITLE SCREEN
// =============================================
document.getElementById('btn-new-game').addEventListener('click', () => {
  showScreen('char-create');
  initCharCreation();
});

document.getElementById('btn-how-to').addEventListener('click', () => {
  showScreen('howto');
});

document.getElementById('btn-back-title').addEventListener('click', () => {
  showScreen('title');
});

document.getElementById('btn-load-game').addEventListener('click', () => {
  // Simple: try to load from localStorage
  const save = localStorage.getItem('dcss_multi_save');
  if (save) {
    alert('Carregamento salvo encontrado, mas ainda não implementado nesta versão demo. Iniciando nova partida.');
  }
  showScreen('char-create');
  initCharCreation();
});

// =============================================
// CHARACTER CREATION
// =============================================
const selections = {
  p1: { race: null, job: null },
  p2: { race: null, job: null }
};

function initCharCreation() {
  buildChoiceGrid('p1-race-grid', 'p1', 'race', RACES);
  buildChoiceGrid('p1-class-grid', 'p1', 'job', JOBS);
  buildChoiceGrid('p2-race-grid', 'p2', 'race', RACES);
  buildChoiceGrid('p2-class-grid', 'p2', 'job', JOBS);

  // Default selections
  selectChoice('p1', 'race', 'human');
  selectChoice('p1', 'job',  'fighter');
  selectChoice('p2', 'race', 'minotaur');
  selectChoice('p2', 'job',  'wizard');

  // Default names
  document.getElementById('p1-name').value = 'Aldric';
  document.getElementById('p2-name').value = 'Zara';
}

function buildChoiceGrid(containerId, player, type, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  const entries = Object.entries(data);
  for (const [id, def] of entries) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.id = id;
    btn.innerHTML = `
      <div class="choice-name">${def.name}</div>
      <div class="choice-desc">${def.desc?.slice(0, 50) || ''}</div>
    `;
    btn.addEventListener('click', () => selectChoice(player, type, id));
    el.appendChild(btn);
  }
}

function selectChoice(player, type, id) {
  selections[player][type] = id;

  // Update button states
  const gridId = `${player}-${type === 'race' ? 'race' : 'class'}-grid`;
  const gridEl = document.getElementById(gridId);
  if (gridEl) {
    gridEl.querySelectorAll('.choice-btn').forEach(btn => {
      btn.classList.remove('selected', 'p1', 'p2');
      if (btn.dataset.id === id) {
        btn.classList.add('selected', player);
      }
    });
  }

  updateCharPreview(player);
}

function updateCharPreview(player) {
  const raceId = selections[player].race;
  const jobId  = selections[player].job;
  if (!raceId || !jobId) return;

  const race = RACES[raceId];
  const job  = JOBS[jobId];
  if (!race || !job) return;

  const previewIdx = player === 'p1' ? 1 : 2;
  const statsEl = document.getElementById(`p${previewIdx}-stats`);
  const spriteCanvas = document.getElementById(`p${previewIdx}-sprite-canvas`);

  if (statsEl) {
    const str = race.baseStats.str;
    const int = race.baseStats.int;
    const dex = race.baseStats.dex;
    const hp  = race.baseHP;
    const mp  = race.baseMP + (job.spells?.length > 0 ? 4 : 0);

    statsEl.innerHTML = `
      <div>STR ${str} | INT ${int} | DEX ${dex}</div>
      <div>HP ${hp} | MP ${mp}</div>
      <div>Arma: ${job.startWeapon?.name || '-'}</div>
      <div>Armadura: ${job.startArmour || '-'}</div>
    `;
  }

  // Draw sprite
  if (spriteCanvas) {
    const ctx = spriteCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 64, 64);
    const spritePath = (player === 'p2' && race.spriteFileMale)
      ? race.spriteFileMale
      : race.spriteFile;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, 64, 64);
    img.src = spritePath;
  }
}

// Start adventure button
document.getElementById('btn-start-adventure').addEventListener('click', () => {
  const p1Name = document.getElementById('p1-name').value.trim() || 'Herói 1';
  const p2Name = document.getElementById('p2-name').value.trim() || 'Herói 2';

  if (!selections.p1.race || !selections.p1.job) {
    alert('Jogador 1: selecione raça e classe!');
    return;
  }
  if (!selections.p2.race || !selections.p2.job) {
    alert('Jogador 2: selecione raça e classe!');
    return;
  }

  const p1Config = { name: p1Name, raceId: selections.p1.race, jobId: selections.p1.job };
  const p2Config = { name: p2Name, raceId: selections.p2.race, jobId: selections.p2.job };

  showScreen('game');

  // Small delay to let CSS transition complete
  setTimeout(() => {
    if (engine) engine.stop();
    engine = new GameEngine();
    engine.init(p1Config, p2Config);
  }, 100);
});

document.getElementById('btn-back-title2').addEventListener('click', () => {
  showScreen('title');
});

// =============================================
// WINDOW RESIZE
// =============================================
window.addEventListener('resize', () => {
  if (engine && engine.renderer) {
    engine.renderer.resize();
  }
});

// =============================================
// INITIAL SCREEN
// =============================================
showScreen('title');

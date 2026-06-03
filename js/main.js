// =============================================
// MAIN.JS — Entry point, screens, char creation
// =============================================
import { RACES, JOBS } from './data.js';
import { GameEngine } from './engine.js';
import { Lobby } from './lobby.js';

let engine = null;

// =============================================
// INITIALIZE LOBBY
// =============================================
function buildChoiceGrid(containerId, player, type, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  const entries = Object.entries(data);
  for (const [id, def] of entries) {
    const btn = document.createElement('button');
    btn.className = `choice-btn ${playerPrefix}`;
    btn.dataset.id = id;
    btn.innerHTML = `
      <div class="choice-name">${def.name}</div>
      <div class="choice-desc">${def.desc?.slice(0, 50) || ''}</div>
    `;
    el.appendChild(btn);
  }
}

// Build UI elements before lobby hooks them
buildChoiceGrid('p1-race-grid', 'p1', 'race', RACES);
buildChoiceGrid('p1-class-grid', 'p1', 'job', JOBS);
buildChoiceGrid('p2-race-grid', 'p2', 'race', RACES);
buildChoiceGrid('p2-class-grid', 'p2', 'job', JOBS);

// Start Lobby
const lobby = new Lobby((config) => {

  const p1Config = { name: config.p1.name, raceId: config.p1.race, jobId: config.p1.cls };
  const p2Config = { name: config.p2.name, raceId: config.p2.race, jobId: config.p2.cls };

  setTimeout(() => {
    if (engine) engine.stop();
    engine = new GameEngine();
    window.engine = engine;
    engine.init(p1Config, p2Config, config); // pass network config
  }, 100);
});

// =============================================
// WINDOW RESIZE
// =============================================
window.addEventListener('resize', () => {
  if (engine && engine.renderer) {
    engine.renderer.resize();
  }
});

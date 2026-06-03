import { db, tx, id } from './db.js';

export class Lobby {
  constructor(onStartGame) {
    this.onStartGame = onStartGame;
    this.currentRoomId = null;
    this.isHost = false;
    this.playerId = id(); // Session ID for this player
    this.roomsSubscription = null;
    this.roomData = null;

    this.bindEvents();
    this.subscribeToRooms();
  }

  bindEvents() {
    document.getElementById('btn-new-game').onclick = () => this.showScreen('screen-lobby');
    document.getElementById('btn-lobby-back').onclick = () => this.showScreen('screen-title');
    document.getElementById('btn-leave-room').onclick = () => this.leaveRoom();
    
    document.getElementById('btn-create-room').onclick = () => {
      const name = document.getElementById('room-name-input').value || 'Nova Sala';
      this.createRoom(name);
    };

    document.getElementById('btn-ready').onclick = () => this.toggleReady();
    
    // Character selection updates
    const choices = document.querySelectorAll('.choice-btn');
    choices.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!this.currentRoomId) return;
        const type = e.currentTarget.parentElement.id.includes('race') ? 'race' : 'class';
        const value = e.currentTarget.dataset.id;
        this.updateSelection(type, value);
      });
    });
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  subscribeToRooms() {
    this.roomsSubscription = db.subscribeQuery({ rooms: {} }, (resp) => {
      if (resp.error) {
        document.getElementById('lobby-status').innerText = 'Erro ao conectar ao DB.';
        return;
      }
      
      document.getElementById('lobby-status').innerText = 'Conectado. Escolha uma sala.';
      
      const roomsList = document.getElementById('rooms-list');
      roomsList.innerHTML = '';
      
      const availableRooms = resp.data.rooms.filter(r => r.state === 'lobby' || r.state === 'char-select');
      
      if (availableRooms.length === 0) {
        roomsList.innerHTML = '<li style="color:#aaa">Nenhuma sala disponível.</li>';
      } else {
        availableRooms.forEach(room => {
          const li = document.createElement('li');
          li.className = 'room-item';
          li.innerHTML = `
            <div>
              <div class="room-name">${room.name}</div>
              <div class="room-players">Jogadores: ${room.p2_id ? '2/2' : '1/2'}</div>
            </div>
            <button class="btn-join-room" data-id="${room.id}" ${room.p2_id ? 'disabled' : ''}>
              ${room.p2_id ? 'Lotado' : 'Entrar'}
            </button>
          `;
          li.querySelector('button').onclick = () => this.joinRoom(room.id);
          roomsList.appendChild(li);
        });
      }

      // If we are currently in a room, update the char select UI
      if (this.currentRoomId) {
        const myRoom = resp.data.rooms.find(r => r.id === this.currentRoomId);
        if (myRoom) {
          this.roomData = myRoom;
          this.updateCharSelectUI();
          this.checkGameStart();
        } else {
          // Room was deleted
          this.leaveRoom();
        }
      }
    });
  }

  createRoom(name) {
    this.isHost = true;
    this.currentRoomId = id();
    
    db.transact([
      tx.rooms[this.currentRoomId].update({
        name: name,
        state: 'char-select',
        p1_id: this.playerId,
        p1_ready: false,
        p1_race: 'human',
        p1_class: 'fighter',
        p2_id: null,
        p2_ready: false,
        p2_race: 'human',
        p2_class: 'fighter',
        seed: Math.floor(Math.random() * 0xFFFFFFFF),
        actions: {} // Store actions as {"1": "KeyW", "2": "KeyA"} etc
      })
    ]);

    this.showScreen('screen-char-create');
  }

  joinRoom(roomId) {
    this.isHost = false;
    this.currentRoomId = roomId;

    db.transact([
      tx.rooms[this.currentRoomId].update({
        p2_id: this.playerId,
        p2_ready: false,
        p2_race: 'human',
        p2_class: 'fighter'
      })
    ]);

    this.showScreen('screen-char-create');
  }

  leaveRoom() {
    if (this.currentRoomId && this.isHost) {
      // Host leaving deletes the room
      db.transact([tx.rooms[this.currentRoomId].delete()]);
    } else if (this.currentRoomId && !this.isHost) {
      // Guest leaving just clears p2
      db.transact([tx.rooms[this.currentRoomId].update({ p2_id: null, p2_ready: false })]);
    }
    this.currentRoomId = null;
    this.isHost = false;
    this.roomData = null;
    this.showScreen('screen-lobby');
  }

  updateSelection(type, value) {
    if (!this.currentRoomId) return;
    const updateObj = {};
    if (this.isHost) {
      updateObj[`p1_${type}`] = value;
      updateObj.p1_ready = false; // Unready if changing
    } else {
      updateObj[`p2_${type}`] = value;
      updateObj.p2_ready = false;
    }
    db.transact([tx.rooms[this.currentRoomId].update(updateObj)]);
  }

  toggleReady() {
    if (!this.currentRoomId || !this.roomData) return;
    const updateObj = {};
    if (this.isHost) {
      updateObj.p1_ready = !this.roomData.p1_ready;
    } else {
      updateObj.p2_ready = !this.roomData.p2_ready;
    }
    db.transact([tx.rooms[this.currentRoomId].update(updateObj)]);
  }

  updateCharSelectUI() {
    if (!this.roomData) return;
    const rd = this.roomData;

    // Update statuses
    document.getElementById('p1-status').innerText = rd.p1_ready ? 'Pronto!' : 'Escolhendo...';
    document.getElementById('p1-status').style.color = rd.p1_ready ? '#55ff55' : '#ffaa00';
    
    if (rd.p2_id) {
      document.getElementById('p2-status').innerText = rd.p2_ready ? 'Pronto!' : 'Escolhendo...';
      document.getElementById('p2-status').style.color = rd.p2_ready ? '#55ff55' : '#ffaa00';
    } else {
      document.getElementById('p2-status').innerText = 'Aguardando Jogador...';
      document.getElementById('p2-status').style.color = '#ffaa00';
    }

    // Sync UI buttons (only visual updates, actual click is bound in bindEvents)
    // Note: To fully sync UI, we'd highlight the selected options for both players.
    // Assuming UI logic for highlighting is in UI.js or we can do it here.
    const highlight = (playerId, type, value) => {
      document.querySelectorAll(`#p${playerId}-${type}-grid .choice-btn`).forEach(btn => {
        if (btn.dataset.id === value) btn.classList.add('selected');
        else btn.classList.remove('selected');
      });
    };

    highlight(1, 'race', rd.p1_race);
    highlight(1, 'class', rd.p1_class);
    if (rd.p2_id) {
      highlight(2, 'race', rd.p2_race);
      highlight(2, 'class', rd.p2_class);
    }
  }

  checkGameStart() {
    if (this.roomData && this.roomData.p1_ready && this.roomData.p2_ready && this.roomData.state !== 'playing') {
      // Both ready!
      if (this.isHost) {
        db.transact([tx.rooms[this.currentRoomId].update({ state: 'playing' })]);
      }
      
      this.showScreen('game-container');
      
      // Call main game start
      this.onStartGame({
        roomId: this.currentRoomId,
        isHost: this.isHost,
        playerId: this.playerId,
        p1: { name: document.getElementById('p1-name').value || 'Jogador 1', race: this.roomData.p1_race, cls: this.roomData.p1_class },
        p2: { name: document.getElementById('p2-name').value || 'Jogador 2', race: this.roomData.p2_race, cls: this.roomData.p2_class },
        seed: this.roomData.seed
      });
    }
  }
}

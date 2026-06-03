import { db, tx, id } from './db.js';

export class Lobby {
  constructor(onStartGame) {
    this.onStartGame = onStartGame;
    this.currentRoomId = null;
    this.isHost = false;
    
    // Check local storage for persistent player ID
    let pid = localStorage.getItem('dcss_player_id');
    if (!pid) {
      pid = id();
      localStorage.setItem('dcss_player_id', pid);
    }
    this.playerId = pid;

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
        
        const parentId = e.currentTarget.parentElement.id; // e.g. p1-race-grid
        if (this.isHost && !parentId.startsWith('p1-')) return; // Host can only edit p1
        if (!this.isHost && !parentId.startsWith('p2-')) return; // Guest can only edit p2

        const type = parentId.includes('race') ? 'race' : 'class';
        const value = e.currentTarget.dataset.id;
        this.updateSelection(type, value);
      });
    });

    document.getElementById('p1-name').addEventListener('input', (e) => {
      if (this.currentRoomId && this.isHost) {
        db.transact([tx.rooms[this.currentRoomId].update({ p1_name: e.target.value, p1_ready: false })]);
      }
    });

    document.getElementById('p2-name').addEventListener('input', (e) => {
      if (this.currentRoomId && !this.isHost) {
        db.transact([tx.rooms[this.currentRoomId].update({ p2_name: e.target.value, p2_ready: false })]);
      }
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
      
      this.allRooms = resp.data.rooms || [];
      document.getElementById('lobby-status').innerText = 'Conectado. Escolha uma sala.';
      
      const roomsList = document.getElementById('rooms-list');
      roomsList.innerHTML = '';
      
      const availableRooms = this.allRooms.filter(r => r.state === 'lobby' || r.state === 'char-select' || r.state === 'playing');
      
      if (availableRooms.length === 0) {
        roomsList.innerHTML = '<li style="color:#aaa">Nenhuma sala disponível.</li>';
      } else {
        availableRooms.forEach(room => {
          const isMyRoom = (room.p1_id === this.playerId || room.p2_id === this.playerId);
          const isHost = (room.p1_id === this.playerId);
          
          let btnHtml = '';
          if (room.state === 'playing') {
            if (isMyRoom) {
              btnHtml = `<button class="btn-join-room reconnect" data-id="${room.id}" style="background:#228822;">Continuar</button>`;
            } else {
              btnHtml = `<button class="btn-join-room" disabled>Em Jogo</button>`;
            }
          } else {
            if (isMyRoom) {
               btnHtml = `<button class="btn-join-room reconnect" data-id="${room.id}" style="background:#228822;">Continuar</button>`;
            } else {
               btnHtml = `<button class="btn-join-room" data-id="${room.id}" ${room.p2_id ? 'disabled' : ''}>${room.p2_id ? 'Lotado' : 'Entrar'}</button>`;
            }
          }
          
          let delBtnHtml = isHost ? `<button class="btn-del-room" style="background:#cc3333; margin-left:10px;" data-id="${room.id}">Deletar</button>` : '';

          const li = document.createElement('li');
          li.className = 'room-item';
          li.innerHTML = `
            <div>
              <div class="room-name">${room.name} ${room.state === 'playing' ? '<span style="color:#ffaa00;font-size:10px;">[EM JOGO]</span>' : ''}</div>
              <div class="room-players">Jogadores: ${room.p2_id ? '2/2' : '1/2'}</div>
            </div>
            <div>
              ${btnHtml}
              ${delBtnHtml}
            </div>
          `;
          
          const joinBtn = li.querySelector('.btn-join-room');
          if (joinBtn && !joinBtn.disabled) {
            joinBtn.onclick = () => this.joinRoom(room.id, isMyRoom, room.state);
          }
          
          const delBtn = li.querySelector('.btn-del-room');
          if (delBtn) {
             delBtn.onclick = () => this.deleteRoom(room.id);
          }
          
          roomsList.appendChild(li);
        });
      }

      // If we are currently in a room, update the char select UI
      if (this.currentRoomId) {
        const myRoom = this.allRooms.find(r => r.id === this.currentRoomId);
        if (myRoom) {
          this.roomData = myRoom;
          this.updateCharSelectUI();
          this.checkGameStart();
        } else {
          // Room was deleted
          this.currentRoomId = null;
          this.isHost = false;
          this.roomData = null;
          this.showScreen('screen-lobby');
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
        p1_name: 'Herói 1',
        p2_id: null,
        p2_ready: false,
        p2_race: 'human',
        p2_class: 'fighter',
        p2_name: 'Herói 2',
        seed: Math.floor(Math.random() * 0xFFFFFFFF),
        actions: {} // Store actions as {"1": "KeyW", "2": "KeyA"} etc
      })
    ]);

    this.showScreen('screen-char-create');
  }

  joinRoom(roomId, isMyRoom, state) {
    const room = this.allRooms.find(r => r.id === roomId);
    if (!room) return;
    
    this.currentRoomId = roomId;
    
    if (room.p1_id === this.playerId) {
      this.isHost = true;
    } else if (room.p2_id === this.playerId) {
      this.isHost = false;
    } else {
      // New join as p2
      this.isHost = false;
      db.transact([
        tx.rooms[roomId].update({
          p2_id: this.playerId,
          p2_ready: false,
          p2_race: 'human',
          p2_class: 'fighter'
        })
      ]);
    }
    
    this.roomData = room; // manually set to allow immediate transition
    
    if (state === 'playing') {
      this.startGameFromReconnection();
    } else {
      this.showScreen('screen-char-create');
    }
  }

  leaveRoom() {
    if (this.currentRoomId) {
      // We no longer delete or clear p2_id to allow resuming.
      // We just leave the screen.
      this.currentRoomId = null;
      this.isHost = false;
      this.roomData = null;
      this.showScreen('screen-lobby');
    }
  }
  
  deleteRoom(roomId) {
    db.transact([tx.rooms[roomId].delete()]);
    if (this.currentRoomId === roomId) {
       this.leaveRoom();
    }
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

    // Sync names only if the input is not currently focused by the user
    if (rd.p1_name !== undefined && document.activeElement !== document.getElementById('p1-name')) {
      document.getElementById('p1-name').value = rd.p1_name;
    }
    if (rd.p2_name !== undefined && document.activeElement !== document.getElementById('p2-name')) {
      document.getElementById('p2-name').value = rd.p2_name;
    }
    
    // Disable inputs for the other player
    document.getElementById('p1-name').disabled = !this.isHost || rd.p1_ready;
    document.getElementById('p2-name').disabled = this.isHost || rd.p2_ready;

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
      this.startGameFromReconnection();
    }
  }

  startGameFromReconnection() {
    if (!this.roomData) return;
    this.showScreen('screen-game');
    this.onStartGame({
      roomId: this.currentRoomId,
      isHost: this.isHost,
      playerId: this.playerId,
      p1: { name: this.roomData.p1_name || 'Jogador 1', race: this.roomData.p1_race, cls: this.roomData.p1_class },
      p2: { name: this.roomData.p2_name || 'Jogador 2', race: this.roomData.p2_race, cls: this.roomData.p2_class },
      seed: this.roomData.seed
    });
  }
}

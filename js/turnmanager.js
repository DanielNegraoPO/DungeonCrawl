// =============================================
// TURN MANAGER — Speed-based AUT queue
// Faithful to DCSS time system
// FIX: advance() now properly tracks who is current
// =============================================

export class TurnManager {
  constructor(actors) {
    this.queue = actors.map(a => ({ actor: a, time: a.nextTurn || 0 }));
    this.globalTime = 0;
    this._current = null; // The actor currently acting
  }

  addActor(actor) {
    // Don't add duplicates
    if (this.queue.some(e => e.actor === actor)) return;
    const time = this.globalTime + (actor.nextTurn || 0);
    this.queue.push({ actor, time });
  }

  removeActor(actor) {
    this.queue = this.queue.filter(e => e.actor !== actor);
    if (this._current && this._current.actor === actor) this._current = null;
  }

  // Returns the next actor WITHOUT removing it
  peekNext() {
    if (this.queue.length === 0) return null;
    this.queue.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      // Tie-break: players act before monsters
      const aP = a.actor.isPlayer ? 0 : 1;
      const bP = b.actor.isPlayer ? 0 : 1;
      return aP - bP;
    });
    return this.queue[0];
  }

  // Call this to begin an actor's turn — sets globalTime and marks current
  advance() {
    if (this.queue.length === 0) return null;
    const entry = this.peekNext();
    this.globalTime = entry.time;
    this._current = entry;
    return entry;
  }

  // After an actor acts, schedule their NEXT turn
  actorDone(actor, actionCost) {
    const entry = this.queue.find(e => e.actor === actor);
    if (entry) {
      entry.time = this.globalTime + Math.max(1, actionCost);
    }
    if (this._current && this._current.actor === actor) {
      this._current = null;
    }
  }

  // Get upcoming actors for display with future simulation look-ahead
  getUpcoming(count = 8) {
    if (this.queue.length === 0) return [];
    
    // Copy active actors and their current AUT schedule times
    const simQueue = this.queue
      .filter(e => !e.actor.isDead)
      .map(e => ({ actor: e.actor, time: e.time }));

    if (simQueue.length === 0) return [];

    const upcoming = [];
    for (let step = 0; step < count; step++) {
      // Sort priority queue to find the next actor to act
      simQueue.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        // Tie-breaker: players act first
        const aP = a.actor.isPlayer ? 0 : 1;
        const bP = b.actor.isPlayer ? 0 : 1;
        return aP - bP;
      });

      const nextEntry = simQueue[0];
      upcoming.push({ actor: nextEntry.actor, time: nextEntry.time });

      // Advance this simulated actor's next action time in the look-ahead timeline
      // using their speed (AUT cost of a standard move)
      const cost = nextEntry.actor.getActionCost ? nextEntry.actor.getActionCost('move') : 10;
      nextEntry.time += Math.max(1, cost);
    }

    return upcoming;
  }

  cleanDead() {
    this.queue = this.queue.filter(e => !e.actor.isDead);
  }

  getActivePlayer() {
    const next = this.peekNext();
    if (next && next.actor.isPlayer && !next.actor.isDead) {
      return next.actor;
    }
    return null;
  }

  isPlayerTurn() {
    return this.getActivePlayer() !== null;
  }
}

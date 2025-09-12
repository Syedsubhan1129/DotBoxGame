document.addEventListener('DOMContentLoaded', () => {
  const setupSection = document.getElementById('setup');
  const setupForm = document.getElementById('setupForm');
  const player2InputWrap = document.getElementById('player2Input');

  const sizeSelect = document.getElementById('size');
  const p1LetterInput = document.getElementById('p1Letter');
  const p2LetterInput = document.getElementById('p2Letter');

  const gameSection = document.getElementById('game');
  const board = document.getElementById('board');
  const boardWrapper = document.getElementById('boardWrapper');

  const p1ScoreEl = document.getElementById('p1Score');
  const p2ScoreEl = document.getElementById('p2Score');
  const p1NameEl = document.getElementById('p1Name');
  const p2NameEl = document.getElementById('p2Name');
  const turnIndicator = document.getElementById('turnIndicator');

  const restartBtn = document.getElementById('restartBtn');
  const newGameBtn = document.getElementById('newGameBtn');
  const resultOverlay = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const changeSetupBtn = document.getElementById('changeSetupBtn');

  const MODE_PVC = 'pvc';
  const MODE_PVP = 'pvp';

  /** Game state */
  let mode = MODE_PVC;
  let gridSize = 4; // number of dots per row/column
  let players = [
    { name: 'Player 1', letter: 'A', className: 'p0', score: 0, isComputer: false },
    { name: 'Player 2', letter: 'B', className: 'p1', score: 0, isComputer: false },
  ];
  let currentPlayerIndex = 0;

  // Edges and boxes ownership
  // H: gridSize rows x (gridSize - 1) cols
  // V: (gridSize - 1) rows x gridSize cols
  let H = [];
  let V = [];
  let boxes = []; // (gridSize - 1) x (gridSize - 1), value is -1 (unowned) or 0/1 for player index

  let totalBoxes = 0;
  let claimedBoxes = 0;
  let gameActive = false;
  let isProcessing = false; // to avoid rapid multi-clicks

  function $(selector, root = document) { return root.querySelector(selector); }

  function getMode() {
    const m = setupForm.querySelector('input[name="mode"]:checked');
    return m ? m.value : MODE_PVC;
  }

  function initState() {
    H = Array.from({ length: gridSize }, () => Array(gridSize - 1).fill(-1));
    V = Array.from({ length: gridSize - 1 }, () => Array(gridSize).fill(-1));
    boxes = Array.from({ length: gridSize - 1 }, () => Array(gridSize - 1).fill(-1));
    totalBoxes = (gridSize - 1) * (gridSize - 1);
    claimedBoxes = 0;
    players[0].score = 0;
    players[1].score = 0;
    currentPlayerIndex = 0;
    gameActive = true;
  }

  function updateScoreboard() {
    p1ScoreEl.textContent = String(players[0].score);
    p2ScoreEl.textContent = String(players[1].score);
    const p = players[currentPlayerIndex];
    turnIndicator.textContent = `${p.name}'s turn`;
  }

  function setBoardGridTemplate() {
    const dimension = 2 * gridSize - 1;
    board.style.gridTemplateColumns = `repeat(${dimension}, auto)`;
    board.style.gridTemplateRows = `repeat(${dimension}, auto)`;
  }

  function createBoard() {
    board.innerHTML = '';
    setBoardGridTemplate();
    const dimension = 2 * gridSize - 1;

    for (let r = 0; r < dimension; r++) {
      for (let c = 0; c < dimension; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';

        const isEvenR = r % 2 === 0;
        const isEvenC = c % 2 === 0;

        if (isEvenR && isEvenC) {
          // Dot
          const dot = document.createElement('div');
          dot.className = 'dot-node';
          cell.appendChild(dot);
        } else if (isEvenR && !isEvenC) {
          // Horizontal edge between (r/2, (c-1)/2) and (r/2, (c+1)/2)
          const i = r / 2;
          const j = (c - 1) / 2;
          const edge = document.createElement('div');
          edge.className = 'edge h-edge';
          edge.setAttribute('data-type', 'H');
          edge.setAttribute('data-i', String(i));
          edge.setAttribute('data-j', String(j));
          edge.addEventListener('click', onEdgeClick);
          cell.appendChild(edge);
        } else if (!isEvenR && isEvenC) {
          // Vertical edge between ((r-1)/2, c/2) and ((r+1)/2, c/2)
          const i = (r - 1) / 2;
          const j = c / 2;
          const edge = document.createElement('div');
          edge.className = 'edge v-edge';
          edge.setAttribute('data-type', 'V');
          edge.setAttribute('data-i', String(i));
          edge.setAttribute('data-j', String(j));
          edge.addEventListener('click', onEdgeClick);
          cell.appendChild(edge);
        } else {
          // Box at ((r-1)/2, (c-1)/2)
          const i = (r - 1) / 2;
          const j = (c - 1) / 2;
          const box = document.createElement('div');
          box.className = 'box';
          box.setAttribute('data-i', String(i));
          box.setAttribute('data-j', String(j));
          cell.appendChild(box);
        }

        board.appendChild(cell);
      }
    }
  }

  function onEdgeClick(e) {
    if (!gameActive || isProcessing) return;
    const edge = e.currentTarget;
    if (edge.classList.contains('claimed')) return;

    const type = edge.getAttribute('data-type');
    const i = Number(edge.getAttribute('data-i'));
    const j = Number(edge.getAttribute('data-j'));
    playMove(type, i, j, currentPlayerIndex, edge);
  }

  function playMove(type, i, j, playerIdx, edgeEl) {
    // Claim the edge if valid
    if (type === 'H') {
      if (H[i][j] !== -1) return false;
      H[i][j] = playerIdx;
    } else {
      if (V[i][j] !== -1) return false;
      V[i][j] = playerIdx;
    }

    const edgeElement = edgeEl || findEdgeElement(type, i, j);
    if (edgeElement) {
      edgeElement.classList.add('claimed');
      edgeElement.classList.add(playerIdx === 0 ? 'p0' : 'p1');
    }

    // Check completed boxes around this edge
    let madeBox = false;
    const affectedBoxes = getAdjacentBoxesForEdge(type, i, j);
    for (const [bi, bj] of affectedBoxes) {
      if (boxes[bi][bj] !== -1) continue;
      if (isBoxCompleted(bi, bj)) {
        boxes[bi][bj] = playerIdx;
        claimedBoxes++;
        players[playerIdx].score++;
        const boxEl = findBoxElement(bi, bj);
        if (boxEl) {
          boxEl.textContent = players[playerIdx].letter.toUpperCase().slice(0, 2);
          boxEl.classList.add(playerIdx === 0 ? 'p0' : 'p1');
        }
        madeBox = true;
      }
    }

    updateScoreboard();

    if (claimedBoxes === totalBoxes) {
      endGame();
      return true;
    }

    if (!madeBox) {
      switchTurn();
    }

    maybeTriggerComputer();
    return true;
  }

  function getAdjacentBoxesForEdge(type, i, j) {
    const list = [];
    if (type === 'H') {
      // Box above (i-1, j) and below (i, j)
      if (i - 1 >= 0) list.push([i - 1, j]);
      if (i < gridSize - 1) list.push([i, j]);
    } else {
      // Box left (i, j-1) and right (i, j)
      if (j - 1 >= 0) list.push([i, j - 1]);
      if (j < gridSize - 1) list.push([i, j]);
    }
    return list;
  }

  function isBoxCompleted(i, j) {
    return (
      H[i][j] !== -1 &&
      H[i + 1][j] !== -1 &&
      V[i][j] !== -1 &&
      V[i][j + 1] !== -1
    );
  }

  function countBoxEdges(i, j) {
    let cnt = 0;
    if (H[i][j] !== -1) cnt++;
    if (H[i + 1][j] !== -1) cnt++;
    if (V[i][j] !== -1) cnt++;
    if (V[i][j + 1] !== -1) cnt++;
    return cnt;
  }

  function findEdgeElement(type, i, j) {
    return board.querySelector(`.edge[data-type="${type}"][data-i="${i}"][data-j="${j}"]`);
  }
  function findBoxElement(i, j) {
    return board.querySelector(`.box[data-i="${i}"][data-j="${j}"]`);
  }

  function switchTurn() {
    currentPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
    updateScoreboard();
  }

  function endGame() {
    gameActive = false;
    const s0 = players[0].score;
    const s1 = players[1].score;
    let msg = '';
    if (s0 > s1) msg = `${players[0].name} wins ${s0} - ${s1}!`;
    else if (s1 > s0) msg = `${players[1].name} wins ${s1} - ${s0}!`;
    else msg = `It's a tie! ${s0} - ${s1}`;
    resultText.textContent = msg;
    resultOverlay.classList.remove('hidden');
  }

  function maybeTriggerComputer() {
    if (!gameActive) return;
    const p = players[currentPlayerIndex];
    if (!p.isComputer) return;

    // Disable user interaction temporarily
    setBoardInteractivity(false);
    isProcessing = true;

    setTimeout(() => {
      const move = computeAIMove();
      if (!move) {
        isProcessing = false;
        setBoardInteractivity(true);
        return;
      }
      const { type, i, j } = move;
      playMove(type, i, j, currentPlayerIndex, findEdgeElement(type, i, j));
      isProcessing = false;
      setBoardInteractivity(true);
    }, 300);
  }

  function setBoardInteractivity(enabled) {
    boardWrapper.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  // AI with simple heuristic
  function computeAIMove() {
    const moves = [];
    // Collect all free edges
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        if (H[i][j] === -1) moves.push({ type: 'H', i, j });
      }
    }
    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (V[i][j] === -1) moves.push({ type: 'V', i, j });
      }
    }
    if (moves.length === 0) return null;

    // 1) Prefer moves that complete a box
    const completing = moves.filter(m => getAdjacentBoxesForEdge(m.type, m.i, m.j).some(([bi, bj]) => countBoxEdges(bi, bj) === 3));
    if (completing.length) return randomPick(completing);

    // 2) Avoid creating 3rd side when possible ("safe" moves)
    const safe = moves.filter(m => getAdjacentBoxesForEdge(m.type, m.i, m.j).every(([bi, bj]) => countBoxEdges(bi, bj) !== 2));
    if (safe.length) return randomPick(safe);

    // 3) Otherwise random among remaining
    return randomPick(moves);
  }

  function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function startGameFromSetup(evt) {
    evt.preventDefault();
    mode = getMode();
    gridSize = Number(sizeSelect.value);
    const p1Letter = (p1LetterInput.value || 'A').trim().slice(0, 2).toUpperCase();
    const p2LetterRaw = (p2LetterInput.value || 'B').trim().slice(0, 2).toUpperCase();

    players[0] = { name: 'Player 1', letter: p1Letter || 'A', className: 'p0', score: 0, isComputer: false };
    if (mode === MODE_PVC) {
      players[1] = { name: 'Computer', letter: p2LetterRaw || 'B', className: 'p1', score: 0, isComputer: true };
    } else {
      players[1] = { name: 'Player 2', letter: p2LetterRaw || 'B', className: 'p1', score: 0, isComputer: false };
    }

    p1NameEl.textContent = players[0].name;
    p2NameEl.textContent = players[1].name;

    initState();
    createBoard();
    updateScoreboard();

    // Switch view
    setupSection.classList.remove('visible');
    setupSection.classList.add('hidden');
    gameSection.classList.remove('hidden');

    // If computer starts in future, we could trigger here. For now, Player 1 starts.
  }

  function restartGame() {
    initState();
    createBoard();
    updateScoreboard();
    resultOverlay.classList.add('hidden');
  }

  function backToSetup() {
    gameActive = false;
    setupSection.classList.remove('hidden');
    setupSection.classList.add('visible');
    gameSection.classList.add('hidden');
    resultOverlay.classList.add('hidden');
  }

  // Wire up setup interactions
  setupForm.addEventListener('submit', startGameFromSetup);
  setupForm.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'mode') {
      const m = getMode();
      if (m === MODE_PVC) {
        player2InputWrap.querySelector('label').textContent = 'Computer Letter';
      } else {
        player2InputWrap.querySelector('label').textContent = 'Player 2 Letter';
      }
    }
  });

  restartBtn.addEventListener('click', restartGame);
  newGameBtn.addEventListener('click', backToSetup);
  playAgainBtn.addEventListener('click', restartGame);
  changeSetupBtn.addEventListener('click', backToSetup);
});



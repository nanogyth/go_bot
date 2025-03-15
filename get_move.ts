export async function main(ns: NS) {
  const sb = [
    ".....",
    ".....",
    "..O..",
    ".X...",
    ".....",
  ];
  ns.tprint(await get_move(sb));
}

export async function get_move(
  simpleBoard: SimpleBoard,
  ai: GoOpponent = GoOpponent.Illuminati,
  player: GoColor = GoColor.black,
): Promise<Play & { type: GoPlayType.move | GoPlayType.pass }> {
  const bs = boardStateFromSimpleBoard(simpleBoard, ai);
  return getMove(bs, player, ai);
}

export function boardStateFromSimpleBoard(
  simpleBoard: SimpleBoard,
  ai: GoOpponent
): BoardState {
  const board = boardFromSimpleBoard(simpleBoard);
  updateChains(board);
  return {
    board,
    previousPlayer: GoColor.empty,
    previousBoards: [],
    ai,
    passCount: 0,
    cheatCount: 0,
    cheatCountForWhite: 0,
  }
}

// src/Go/Enums.ts
export enum GoColor {
  white = "White",
  black = "Black",
  empty = "Empty",
}

export enum GoOpponent {
  none = "No AI",
  Netburners = "Netburners",
  SlumSnakes = "Slum Snakes",
  TheBlackHand = "The Black Hand",
  Tetrads = "Tetrads",
  Daedalus = "Daedalus",
  Illuminati = "Illuminati",
  w0r1d_d43m0n = "????????????",
}

export enum GoPlayType {
  move = "move",
  pass = "pass",
  gameOver = "gameOver",
}

export enum GoValidity {
  pointBroken = "That node is offline; a piece cannot be placed there",
  pointNotEmpty = "That node is already occupied by a piece",
  boardRepeated = "It is illegal to repeat prior board states",
  noSuicide = "It is illegal to cause your own pieces to be captured",
  notYourTurn = "It is not your turn to play",
  gameOver = "The game is over",
  invalid = "Invalid move",
  valid = "Valid move",
}


// src/Go/Types.ts
export type SimpleBoard = string[];

export type PointState = {
  color: GoColor;
  chain: string;
  liberties: (PointState | null)[] | null;
  x: number;
  y: number;
};

export type Neighbor = {
  north: PointState | null;
  east: PointState | null;
  south: PointState | null;
  west: PointState | null;
};

export type Board = (PointState | null)[][];

export type BoardState = {
  board: Board;
  previousPlayer: GoColor | null;
  /** The previous board positions as a SimpleBoard */
  previousBoards: string[];
  ai: GoOpponent;
  passCount: number;
  cheatCount: number;
  cheatCountForWhite: number;
};

export type EyeMove = {
  point: PointState;
  createsLife: boolean;
};

export type MoveType =
  | "capture"
  | "defendCapture"
  | "eyeMove"
  | "eyeBlock"
  | "pattern"
  | "growth"
  | "expansion"
  | "jump"
  | "defend"
  | "surround"
  | "corner"
  | "random";

export type Move = {
  point: PointState;
  oldLibertyCount?: number | null;
  newLibertyCount?: number | null;
  createsLife?: boolean;
};

export type MoveOptions = {
  readonly eyeMove: () => Move | null;
  readonly random: () => Move | null;
  readonly defendCapture: () => Promise<Move | null>;
  readonly corner: () => Move | null;
  readonly defend: () => Move | null;
  readonly pattern: () => Promise<Move | null>;
  readonly capture: () => Promise<Move | null>;
  readonly growth: () => Move | null;
  readonly eyeBlock: () => Move | null;
  readonly surround: () => Move | null;
  readonly expansion: () => Move | null;
  readonly jump: () => Move | null;
};

export type Play =
  | {
    type: GoPlayType.move;
    x: number;
    y: number;
  }
  | {
    type: GoPlayType.gameOver | GoPlayType.pass;
    x: null;
    y: null;
  };


// src/Go/boardAnalysis/goAI.ts
/**
 * Finds an array of potential moves based on the current board state, then chooses one
 * based on the given opponent's personality and preferences. If no preference is given by the AI,
 * will choose one from the reasonable moves at random.
 *
 * @returns a promise that will resolve with a move (or pass) from the designated AI opponent.
 */
export async function getMove(
  boardState: BoardState,
  player: GoColor,
  opponent: GoOpponent,
  // useOfflineCycles = true,
  // rngOverride?: number,
): Promise<Play & { type: GoPlayType.move | GoPlayType.pass }> {
  // await waitCycle(useOfflineCycles);
  await waitCycle(); // ###
  // const rng = new WHRNG(rngOverride || Player.totalPlaytime);
  const rng = Math; // ###
  const smart = isSmart(opponent, rng.random());
  const moves = getMoveOptions(boardState, player, rng.random(), smart);

  const priorityMove = await getFactionMove(moves, opponent, rng.random());
  if (priorityMove) {
    return {
      type: GoPlayType.move,
      x: priorityMove.x,
      y: priorityMove.y,
    };
  }

  // If no priority move is chosen, pick one of the reasonable moves
  const moveOptions = [
    moves.growth()?.point,
    moves.surround()?.point,
    moves.defend()?.point,
    moves.expansion()?.point,
    (await moves.pattern())?.point,
    moves.eyeMove()?.point,
    moves.eyeBlock()?.point,
  ]
    .filter(isNotNullish)
    .filter((point) => evaluateIfMoveIsValid(boardState, point.x, point.y, player, false));

  const chosenMove = moveOptions[Math.floor(rng.random() * moveOptions.length)];
  // await waitCycle(useOfflineCycles);
  await waitCycle(); // ###

  if (chosenMove) {
    //console.debug(`Non-priority move chosen: ${chosenMove.x} ${chosenMove.y}`);
    return { type: GoPlayType.move, x: chosenMove.x, y: chosenMove.y };
  }
  // Pass if no valid moves were found
  return { type: GoPlayType.pass, x: null, y: null };
}

/**
 * Allows time to pass
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Spend some time waiting to allow the UI & CSS to render smoothly
 * If bonus time is available, significantly decrease the length of the wait
 */
function waitCycle(
  // useOfflineCycles = true // ###
): Promise<void> {
  // if (useOfflineCycles && Go.storedCycles > 0) {
  //   Go.storedCycles -= 2;
  //   return sleep(40);
  // }
  // return sleep(200);
  return sleep(1);
}

/**
 * Determines if certain failsafes and mistake avoidance are enabled for the given move
 */
function isSmart(faction: GoOpponent, rng: number) {
  if (faction === GoOpponent.Netburners) {
    return false;
  }
  if (faction === GoOpponent.SlumSnakes) {
    return rng < 0.3;
  }
  if (faction === GoOpponent.TheBlackHand) {
    return rng < 0.8;
  }

  return true;
}

function getDisputedTerritoryMoves(board: Board, availableSpaces: PointState[], maxChainSize = 99) {
  const chains = getAllChains(board).filter((chain) => chain.length <= maxChainSize);

  return availableSpaces.filter((space) => {
    const chain = chains.find((chain) => chain[0].chain === space.chain) ?? [];
    const playerNeighbors = getAllNeighboringChains(board, chain, chains);
    const hasWhitePieceNeighbor = playerNeighbors.find((neighborChain) => neighborChain[0]?.color === GoColor.white);
    const hasBlackPieceNeighbor = playerNeighbors.find((neighborChain) => neighborChain[0]?.color === GoColor.black);

    return hasWhitePieceNeighbor && hasBlackPieceNeighbor;
  });
}

/**
 * Finds a move in an open area to expand influence and later build on
 */
export function getExpansionMoveArray(board: Board, availableSpaces: PointState[]): Move[] {
  // Look for any empty spaces fully surrounded by empty spaces to expand into
  const emptySpaces = availableSpaces.filter((space) => {
    const neighbors = findNeighbors(board, space.x, space.y);
    return (
      [neighbors.north, neighbors.east, neighbors.south, neighbors.west].filter(
        (point) => point && point.color === GoColor.empty,
      ).length === 4
    );
  });

  // Once no such empty areas exist anymore, instead expand into any disputed territory
  // to gain a few more points in endgame
  const disputedSpaces = emptySpaces.length ? [] : getDisputedTerritoryMoves(board, availableSpaces, 1);

  const moveOptions = [...emptySpaces, ...disputedSpaces];

  return moveOptions.map((point) => {
    return {
      point: point,
      newLibertyCount: -1,
      oldLibertyCount: -1,
    };
  });
}

/**
 * Finds all moves that would create an eye for the given player.
 *
 * An "eye" is empty point(s) completely surrounded by a single player's connected pieces.
 * If a chain has multiple eyes, it cannot be captured by the opponent (since they can only fill one eye at a time,
 *  and suiciding your own pieces is not legal unless it captures the opponents' first)
 */
function getEyeCreationMoves(board: Board, player: GoColor, availableSpaces: PointState[], maxLiberties = 99) {
  const allEyes = getAllEyesByChainId(board, player);
  const currentEyes = getAllEyes(board, player, allEyes);

  const currentLivingGroupIDs = Object.keys(allEyes).filter((chainId) => allEyes[chainId].length >= 2);
  const currentLivingGroupsCount = currentLivingGroupIDs.length;
  const currentEyeCount = currentEyes.filter((eye) => eye.length).length;

  const chains = getAllChains(board);
  const friendlyLiberties = chains
    .filter((chain) => chain[0].color === player)
    .filter((chain) => chain.length > 1)
    .filter((chain) => chain[0].liberties && chain[0].liberties?.length <= maxLiberties)
    .filter((chain) => !currentLivingGroupIDs.includes(chain[0].chain))
    .map((chain) => chain[0].liberties)
    .flat()
    .filter(isNotNullish)
    .filter((point) =>
      availableSpaces.find((availablePoint) => availablePoint.x === point.x && availablePoint.y === point.y),
    )
    .filter((point: PointState) => {
      const neighbors = findNeighbors(board, point.x, point.y);
      const neighborhood = [neighbors.north, neighbors.east, neighbors.south, neighbors.west];
      return (
        neighborhood.filter((point) => !point || point?.color === player).length >= 2 &&
        neighborhood.some((point) => point?.color === GoColor.empty)
      );
    });

  const eyeCreationMoves = friendlyLiberties.reduce((moveOptions: EyeMove[], point: PointState) => {
    const evaluationBoard = evaluateMoveResult(board, point.x, point.y, player);
    const newEyes = getAllEyes(evaluationBoard, player);
    const newLivingGroupsCount = newEyes.filter((eye) => eye.length >= 2).length;
    const newEyeCount = newEyes.filter((eye) => eye.length).length;
    if (
      newLivingGroupsCount > currentLivingGroupsCount ||
      (newEyeCount > currentEyeCount && newLivingGroupsCount === currentLivingGroupsCount)
    ) {
      moveOptions.push({
        point: point,
        createsLife: newLivingGroupsCount > currentLivingGroupsCount,
      });
    }
    return moveOptions;
  }, []);

  return eyeCreationMoves.sort((moveA, moveB) => +moveB.createsLife - +moveA.createsLife);
}

function getEyeCreationMove(board: Board, player: GoColor, availableSpaces: PointState[]) {
  return getEyeCreationMoves(board, player, availableSpaces)[0];
}

/**
 * If there is only one move that would create two eyes for the opponent, it should be blocked if possible
 */
function getEyeBlockingMove(board: Board, player: GoColor, availablePoints: PointState[]) {
  const opposingPlayer = player === GoColor.white ? GoColor.black : GoColor.white;
  const opponentEyeMoves = getEyeCreationMoves(board, opposingPlayer, availablePoints, 5);
  const twoEyeMoves = opponentEyeMoves.filter((move) => move.createsLife);
  const oneEyeMoves = opponentEyeMoves.filter((move) => !move.createsLife);

  if (twoEyeMoves.length === 1) {
    return twoEyeMoves[0];
  }
  if (!twoEyeMoves.length && oneEyeMoves.length === 1) {
    return oneEyeMoves[0];
  }
  return null;
}

/**
 * Finds all moves that increases the liberties of the player's pieces, making them harder to capture and occupy more space on the board.
 */
function getLibertyGrowthMoves(board: Board, player: GoColor, availableSpaces: PointState[]) {
  const friendlyChains = getAllChains(board).filter((chain) => chain[0].color === player);

  if (!friendlyChains.length) {
    return [];
  }

  // Get all liberties of friendly chains as potential growth move options
  const liberties = friendlyChains
    .map((chain) =>
      chain[0].liberties?.filter(isNotNullish).map((liberty) => ({
        libertyPoint: liberty,
        oldLibertyCount: chain[0].liberties?.length,
      })),
    )
    .flat()
    .filter(isNotNullish)
    .filter((liberty) =>
      availableSpaces.find((point) => liberty.libertyPoint.x === point.x && liberty.libertyPoint.y === point.y),
    );

  // Find a liberty where playing a piece increases the liberty of the chain (aka expands or defends the chain)
  return liberties
    .map((liberty) => {
      const move = liberty.libertyPoint;

      const newLibertyCount = findEffectiveLibertiesOfNewMove(board, move.x, move.y, player).length;

      // Get the smallest liberty count of connected chains to represent the old state
      const oldLibertyCount = findMinLibertyCountOfAdjacentChains(board, move.x, move.y, player);

      return {
        point: move,
        oldLibertyCount: oldLibertyCount,
        newLibertyCount: newLibertyCount,
      };
    })
    .filter((move) => move.newLibertyCount > 1 && move.newLibertyCount >= move.oldLibertyCount);
}

/**
 * Find a move that increases the player's liberties by the maximum amount
 */
function getGrowthMove(board: Board, player: GoColor, availableSpaces: PointState[], rng: number) {
  const growthMoves = getLibertyGrowthMoves(board, player, availableSpaces);

  const maxLibertyCount = Math.max(...growthMoves.map((l) => l.newLibertyCount - l.oldLibertyCount));

  const moveCandidates = growthMoves.filter((l) => l.newLibertyCount - l.oldLibertyCount === maxLibertyCount);
  return moveCandidates[Math.floor(rng * moveCandidates.length)];
}

/**
 * Select a move from the list of open-area moves
 */
function getExpansionMove(board: Board, availableSpaces: PointState[], rng: number, moveArray?: Move[]) {
  const moveOptions = moveArray ?? getExpansionMoveArray(board, availableSpaces);
  const randomIndex = Math.floor(rng * moveOptions.length);
  return moveOptions[randomIndex];
}

/**
 * Get a move in open space that is nearby a friendly piece
 */
function getJumpMove(board: Board, player: GoColor, availableSpaces: PointState[], rng: number, moveArray?: Move[]) {
  const moveOptions = (moveArray ?? getExpansionMoveArray(board, availableSpaces)).filter(({ point }) =>
    [
      board[point.x]?.[point.y + 2],
      board[point.x + 2]?.[point.y],
      board[point.x]?.[point.y - 2],
      board[point.x - 2]?.[point.y],
    ].some((point) => point?.color === player),
  );

  const randomIndex = Math.floor(rng * moveOptions.length);
  return moveOptions[randomIndex];
}

/**
 * Find a move that specifically increases a chain's liberties from 1 to more than 1, preventing capture
 */
// function getDefendMove(board: Board, player: GoColor, availableSpaces: PointState[]) {
function getDefendMove(board: Board, player: GoColor, availableSpaces: PointState[], rng: number) { // ###
  const growthMoves = getLibertyGrowthMoves(board, player, availableSpaces);
  const libertyIncreases =
    growthMoves?.filter((move) => move.oldLibertyCount <= 1 && move.newLibertyCount > move.oldLibertyCount) ?? [];

  const maxLibertyCount = Math.max(...libertyIncreases.map((l) => l.newLibertyCount - l.oldLibertyCount));

  if (maxLibertyCount < 1) {
    return null;
  }

  const moveCandidates = libertyIncreases.filter((l) => l.newLibertyCount - l.oldLibertyCount === maxLibertyCount);
  // ### shouldn't be an unconstrained random...
  // return moveCandidates[Math.floor(Math.random() * moveCandidates.length)];
  return moveCandidates[Math.floor(rng * moveCandidates.length)]; // ###
}

/**
 * Find a move that reduces the opponent's liberties as much as possible,
 *   capturing (or making it easier to capture) their pieces
 */
function getSurroundMove(board: Board, player: GoColor, availableSpaces: PointState[], smart = true) {
  const opposingPlayer = player === GoColor.black ? GoColor.white : GoColor.black;
  const enemyChains = getAllChains(board).filter((chain) => chain[0].color === opposingPlayer);

  if (!enemyChains.length || !availableSpaces.length) {
    return null;
  }

  const enemyLiberties = enemyChains
    .map((chain) => chain[0].liberties)
    .flat()
    .filter((liberty) => availableSpaces.find((point) => liberty?.x === point.x && liberty?.y === point.y))
    .filter(isNotNullish);

  const captureMoves: Move[] = [];
  const atariMoves: Move[] = [];
  const surroundMoves: Move[] = [];

  enemyLiberties.forEach((move) => {
    const newLibertyCount = findEffectiveLibertiesOfNewMove(board, move.x, move.y, player).length;

    const weakestEnemyChain = findEnemyNeighborChainWithFewestLiberties(
      board,
      move.x,
      move.y,
      player === GoColor.black ? GoColor.white : GoColor.black,
    );
    const weakestEnemyChainLength = weakestEnemyChain?.length ?? 99;

    const enemyChainLibertyCount = weakestEnemyChain?.[0]?.liberties?.length ?? 99;

    const enemyLibertyGroups = [
      ...(weakestEnemyChain?.[0]?.liberties ?? []).reduce(
        (chainIDs, point) => chainIDs.add(point?.chain ?? ""),
        new Set<string>(),
      ),
    ];

    // Do not suggest moves that do not capture anything and let your opponent immediately capture
    if (newLibertyCount <= 2 && enemyChainLibertyCount > 2) {
      return;
    }

    // If a neighboring enemy chain has only one liberty, the current move suggestion will capture
    if (enemyChainLibertyCount <= 1) {
      captureMoves.push({
        point: move,
        oldLibertyCount: enemyChainLibertyCount,
        newLibertyCount: enemyChainLibertyCount - 1,
      });
    }

    // If the move puts the enemy chain in threat of capture, it forces the opponent to respond.
    // Only do this if your piece cannot be captured, or if the enemy group is surrounded and vulnerable to losing its only interior space
    else if (
      enemyChainLibertyCount === 2 &&
      (newLibertyCount >= 2 || (enemyLibertyGroups.length === 1 && weakestEnemyChainLength > 3) || !smart)
    ) {
      atariMoves.push({
        point: move,
        oldLibertyCount: enemyChainLibertyCount,
        newLibertyCount: enemyChainLibertyCount - 1,
      });
    }

    // If the move will not immediately get re-captured, and limit's the opponent's liberties
    else if (newLibertyCount >= 2) {
      surroundMoves.push({
        point: move,
        oldLibertyCount: enemyChainLibertyCount,
        newLibertyCount: enemyChainLibertyCount - 1,
      });
    }
  });

  return [...captureMoves, ...atariMoves, ...surroundMoves][0];
}

/**
 * Find all non-offline nodes in a given area
 */
function findLiveNodesInArea(board: Board, x1: number, y1: number, x2: number, y2: number) {
  const foundPoints: PointState[] = [];
  board.forEach((column) =>
    column.forEach(
      (point) => point && point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2 && foundPoints.push(point),
    ),
  );
  return foundPoints;
}

/**
 * Determine if a corner is largely intact and currently empty, and thus a good target for corner takeover moves
 */
function isCornerAvailableForMove(board: Board, x1: number, y1: number, x2: number, y2: number) {
  const foundPoints = findLiveNodesInArea(board, x1, y1, x2, y2);
  const foundPieces = foundPoints.filter((point) => point.color !== GoColor.empty);
  return foundPoints.length >= 7 ? foundPieces.length === 0 : false;
}

/**
 * Get a move that places a piece to influence (and later control) a corner
 */
function getCornerMove(board: Board) {
  const boardEdge = board[0].length - 1;
  const cornerMax = boardEdge - 2;
  if (isCornerAvailableForMove(board, cornerMax, cornerMax, boardEdge, boardEdge)) {
    return board[cornerMax][cornerMax];
  }
  // if (isCornerAvailableForMove(board, 0, cornerMax, cornerMax, boardEdge)) {
  if (isCornerAvailableForMove(board, 0, cornerMax, 2, boardEdge)) { // ###
    return board[2][cornerMax];
  }
  if (isCornerAvailableForMove(board, 0, 0, 2, 2)) {
    return board[2][2];
  }
  if (isCornerAvailableForMove(board, cornerMax, 0, boardEdge, 2)) {
    return board[cornerMax][2];
  }
  return null;
}

/**
 * Gets a group of reasonable moves based on the current board state, to be passed to the factions' AI to decide on
 */
function getMoveOptions(boardState: BoardState, player: GoColor, rng: number, smart = true) {
  const board = boardState.board;
  const availableSpaces = findDisputedTerritory(boardState, player, smart);
  const contestedPoints = getDisputedTerritoryMoves(board, availableSpaces);
  const expansionMoves = getExpansionMoveArray(board, availableSpaces);

  // If the player is passing, and all territory is surrounded by a single color: do not suggest moves that
  // needlessly extend the game, unless they actually can change the score
  const endGameAvailable = !contestedPoints.length && boardState.passCount;

  const moveOptions: { [s in MoveType]: Move | null | undefined } = {
    capture: undefined,
    defendCapture: undefined,
    eyeMove: undefined,
    eyeBlock: undefined,
    pattern: undefined,
    growth: undefined,
    expansion: undefined,
    jump: undefined,
    defend: undefined,
    surround: undefined,
    corner: undefined,
    random: undefined,
  };

  const moveOptionGetters: MoveOptions = {
    capture: async () => {
      const surroundMove = await retrieveMoveOption("surround");
      return surroundMove && surroundMove?.newLibertyCount === 0 ? surroundMove : null;
    },
    defendCapture: async () => {
      const defendMove = await retrieveMoveOption("defend");
      return defendMove &&
        defendMove.oldLibertyCount == 1 &&
        defendMove?.newLibertyCount &&
        defendMove?.newLibertyCount > 1
        ? defendMove
        : null;
    },
    eyeMove: () => (endGameAvailable ? null : getEyeCreationMove(board, player, availableSpaces) ?? null),
    eyeBlock: () => (endGameAvailable ? null : getEyeBlockingMove(board, player, availableSpaces) ?? null),
    pattern: async () => {
      const point = endGameAvailable ? null : await findAnyMatchedPatterns(board, player, availableSpaces, smart, rng);
      return point ? { point } : null;
    },
    growth: () => (endGameAvailable ? null : getGrowthMove(board, player, availableSpaces, rng) ?? null),
    expansion: () => getExpansionMove(board, availableSpaces, rng, expansionMoves) ?? null,
    jump: () => getJumpMove(board, player, availableSpaces, rng, expansionMoves) ?? null,
    // defend: () => getDefendMove(board, player, availableSpaces) ?? null,
    defend: () => getDefendMove(board, player, availableSpaces, rng) ?? null, // ###
    surround: () => getSurroundMove(board, player, availableSpaces, smart) ?? null,
    corner: () => {
      const point = getCornerMove(board);
      return point ? { point } : null;
    },
    random: () => {
      // Only offer a random move if there are some contested spaces on the board.
      // (Random move should not be picked if the AI would otherwise pass turn.)
      const point = contestedPoints.length ? availableSpaces[Math.floor(rng * availableSpaces.length)] : null;
      return point ? { point } : null;
    },
  } as const;

  async function retrieveMoveOption(id: MoveType): Promise<Move | null> {
    await waitCycle();
    if (moveOptions[id] !== undefined) {
      return moveOptions[id] ?? null;
    }

    const move = (await moveOptionGetters[id]()) ?? null;
    moveOptions[id] = move;
    return move;
  }

  return moveOptionGetters;
}

/**
 * Netburners mostly just put random points around the board, but occasionally have a smart move
 */
async function getNetburnersPriorityMove(moves: MoveOptions, rng: number): Promise<PointState | null> {
  if (rng < 0.2) {
    return getIlluminatiPriorityMove(moves, rng);
  } else if (rng < 0.4 && moves.expansion()) {
    return moves.expansion()?.point ?? null;
  } else if (rng < 0.6 && moves.growth()) {
    return moves.growth()?.point ?? null;
  } else if (rng < 0.75) {
    return moves.random()?.point ?? null;
  }

  return null;
}

/**
 * Slum snakes prioritize defending their pieces and building chains that snake around as much of the bord as possible.
 */
async function getSlumSnakesPriorityMove(moves: MoveOptions, rng: number): Promise<PointState | null> {
  if (await moves.defendCapture()) {
    return (await moves.defendCapture())?.point ?? null;
  }

  if (rng < 0.2) {
    return getIlluminatiPriorityMove(moves, rng);
  } else if (rng < 0.6 && moves.growth()) {
    return moves.growth()?.point ?? null;
  } else if (rng < 0.65) {
    return moves.random()?.point ?? null;
  }

  return null;
}

/**
 * Black hand just wants to smOrk. They always capture or smother the opponent if possible.
 */
async function getBlackHandPriorityMove(moves: MoveOptions, rng: number): Promise<PointState | null> {
  if (await moves.capture()) {
    //console.debug("capture: capture move chosen");
    return (await moves.capture())?.point ?? null;
  }

  const surround = moves.surround();

  if (surround && surround.point && (surround.newLibertyCount ?? 999) <= 1) {
    //console.debug("surround move chosen");
    return surround.point;
  }

  if (await moves.defendCapture()) {
    //console.debug("defend capture: defend move chosen");
    return (await moves.defendCapture())?.point ?? null;
  }

  if (surround && surround.point && (surround?.newLibertyCount ?? 999) <= 2) {
    //console.debug("surround move chosen");
    return surround.point;
  }

  if (rng < 0.3) {
    return getIlluminatiPriorityMove(moves, rng);
  } else if (rng < 0.75 && surround) {
    return surround.point;
  } else if (rng < 0.8) {
    return moves.random()?.point ?? null;
  }

  return null;
}

/**
 * Tetrads really like to be up close and personal, cutting and circling their opponent
 */
async function getTetradPriorityMove(moves: MoveOptions, rng: number): Promise<PointState | null> {
  if (await moves.capture()) {
    //console.debug("capture: capture move chosen");
    return (await moves.capture())?.point ?? null;
  }

  if (await moves.defendCapture()) {
    //console.debug("defend capture: defend move chosen");
    return (await moves.defendCapture())?.point ?? null;
  }

  if (await moves.pattern()) {
    //console.debug("pattern match move chosen");
    return (await moves.pattern())?.point ?? null;
  }

  const surround = moves.surround();
  if (surround && surround.point && (surround?.newLibertyCount ?? 9) <= 1) {
    //console.debug("surround move chosen");
    return surround.point;
  }

  if (rng < 0.4) {
    return getIlluminatiPriorityMove(moves, rng);
  }

  return null;
}

/**
 * Daedalus almost always picks the Illuminati move, but very occasionally gets distracted.
 */
async function getDaedalusPriorityMove(moves: MoveOptions, rng: number): Promise<PointState | null> {
  if (rng < 0.9) {
    return await getIlluminatiPriorityMove(moves, rng);
  }

  return null;
}

/**
 * First prioritizes capturing of opponent pieces.
 * Then, preventing capture of their own pieces.
 * Then, creating "eyes" to solidify their control over the board
 * Then, finding opportunities to capture on their next move
 * Then, blocking the opponent's attempts to create eyes
 * Finally, will match any of the predefined local patterns indicating a strong move.
 */
async function getIlluminatiPriorityMove(moves: MoveOptions, rng: number): Promise<PointState | null> {
  if (await moves.capture()) {
    //console.debug("capture: capture move chosen");
    return (await moves.capture())?.point ?? null;
  }

  if (await moves.defendCapture()) {
    //console.debug("defend capture: defend move chosen");
    return (await moves.defendCapture())?.point ?? null;
  }

  if (moves.eyeMove()) {
    //console.debug("Create eye move chosen");
    return moves.eyeMove()?.point ?? null;
  }

  const surround = moves.surround();
  if (surround && surround.point && (surround?.newLibertyCount ?? 9) <= 1) {
    //console.debug("surround move chosen");
    return surround.point;
  }

  if (moves.eyeBlock()) {
    //console.debug("Block eye move chosen");
    return moves.eyeBlock()?.point ?? null;
  }

  if (moves.corner()) {
    //console.debug("Corner move chosen");
    return moves.corner()?.point ?? null;
  }

  const hasMoves = [moves.eyeMove(), moves.eyeBlock(), moves.growth(), moves.defend(), surround].filter(
    (m) => m,
  ).length;
  const usePattern = rng > 0.25 || !hasMoves;

  if ((await moves.pattern()) && usePattern) {
    //console.debug("pattern match move chosen");
    return (await moves.pattern())?.point ?? null;
  }

  if (rng > 0.4 && moves.jump()) {
    //console.debug("Jump move chosen");
    return moves.jump()?.point ?? null;
  }

  if (rng < 0.6 && surround && surround.point && (surround?.newLibertyCount ?? 9) <= 2) {
    //console.debug("surround move chosen");
    return surround.point;
  }

  return null;
}

/**
 * Given a group of move options, chooses one based on the given opponent's personality (if any fit their priorities)
 */
async function getFactionMove(moves: MoveOptions, faction: GoOpponent, rng: number): Promise<PointState | null> {
  if (faction === GoOpponent.Netburners) {
    return getNetburnersPriorityMove(moves, rng);
  }
  if (faction === GoOpponent.SlumSnakes) {
    return getSlumSnakesPriorityMove(moves, rng);
  }
  if (faction === GoOpponent.TheBlackHand) {
    return getBlackHandPriorityMove(moves, rng);
  }
  if (faction === GoOpponent.Tetrads) {
    return getTetradPriorityMove(moves, rng);
  }
  if (faction === GoOpponent.Daedalus) {
    return getDaedalusPriorityMove(moves, rng);
  }

  return getIlluminatiPriorityMove(moves, rng);
}


// src/Go/boardAnalysis/boardAnalysis.ts
export function blankPointState(color: GoColor, x: number, y: number): PointState {
  return {
    // color: color,
    color, // ###
    y,
    x,
    chain: "",
    liberties: null,
  };
}

/** Creates a board object from a simple board. The resulting board has no analytics (liberties/chains) */
export function boardFromSimpleBoard(simpleBoard: SimpleBoard): Board {
  return simpleBoard.map((column, x) =>
    column.split("").map((char, y) => {
      if (char === "#") return null;
      if (char === "X") return blankPointState(GoColor.black, x, y);
      if (char === "O") return blankPointState(GoColor.white, x, y);
      return blankPointState(GoColor.empty, x, y);
    }),
  );
}

/**
 * Retrieves a simplified version of the board state.
 * "X" represents black pieces, "O" white, "." empty points, and "#" offline nodes.
 *
 * For example, a 5x5 board might look like this:
 * ```
 * [
 *   "XX.O.",
 *   "X..OO",
 *   ".XO..",
 *   "XXO..",
 *   ".XOO.",
 * ]
 * ```
 *
 * Each string represents a vertical column on the board, and each character in the string represents a point.
 *
 * Traditional notation for Go is e.g. "B,1" referring to second ("B") column, first rank. This is the equivalent of
 * index (1 * N) + 0 , where N is the size of the board.
 *
 * Note that index 0 (the [0][0] point) is shown on the bottom-left on the visual board (as is traditional), and each
 * string represents a vertical column on the board. In other words, the printed example above can be understood to
 * be rotated 90 degrees clockwise compared to the board UI as shown in the IPvGO game.
 *
 */
export function simpleBoardFromBoard(board: Board): SimpleBoard {
  return board.map((column) =>
    column.reduce((str, point) => {
      if (!point) {
        return str + "#";
      }
      if (point.color === GoColor.black) {
        return str + "X";
      }
      if (point.color === GoColor.white) {
        return str + "O";
      }
      return str + ".";
    }, ""),
  );
}

/**
 * Returns a string representation of the given board.
 * The string representation is the same as simpleBoardFromBoard() but concatenated into a single string
 *
 * For example, a 5x5 board might look like this:
 * ```
 *   "XX.O.X..OO.XO..XXO...XOO."
 * ```
 */
export function boardStringFromBoard(board: Board): string {
  return simpleBoardFromBoard(board).join("");
}

/**
 * Finds all groups of connected pieces, or empty space groups
 */
export function getAllChains(board: Board): PointState[][] {
  const chains: { [s: string]: PointState[] } = {};

  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      const point = board[x]?.[y];
      // If the current chain is already analyzed, skip it
      if (!point || point.chain === "") {
        continue;
      }

      chains[point.chain] = chains[point.chain] || [];
      chains[point.chain].push(point);
    }
  }

  return Object.keys(chains).map((key) => chains[key]);
}

export function getColorOnBoardString(boardString: string, x: number, y: number): GoColor | null {
  const boardSize = Math.round(Math.sqrt(boardString.length));
  const char = boardString[x * boardSize + y];
  if (char === "X") return GoColor.black;
  if (char === "O") return GoColor.white;
  if (char === ".") return GoColor.empty;
  return null;
}

/**
 * Returns an object that includes which of the cardinal neighbors are empty
 * (adjacent 'liberties' of the current piece )
 */
export function findAdjacentLibertiesForPoint(board: Board, x: number, y: number): Neighbor {
  const neighbors = findNeighbors(board, x, y);

  const hasNorthLiberty = neighbors.north && neighbors.north.color === GoColor.empty;
  const hasEastLiberty = neighbors.east && neighbors.east.color === GoColor.empty;
  const hasSouthLiberty = neighbors.south && neighbors.south.color === GoColor.empty;
  const hasWestLiberty = neighbors.west && neighbors.west.color === GoColor.empty;

  return {
    north: hasNorthLiberty ? neighbors.north : null,
    east: hasEastLiberty ? neighbors.east : null,
    south: hasSouthLiberty ? neighbors.south : null,
    west: hasWestLiberty ? neighbors.west : null,
  };
}

/**
 * Returns an object that includes which of the cardinal neighbors are either empty or contain the
 * current player's pieces. Used for making the connection map on the board
 */
export function findAdjacentLibertiesAndAlliesForPoint(
  board: Board,
  x: number,
  y: number,
  _player?: GoColor,
): Neighbor {
  const currentPoint = board[x]?.[y];
  const player = _player || (!currentPoint || currentPoint.color === GoColor.empty ? undefined : currentPoint.color);
  const adjacentLiberties = findAdjacentLibertiesForPoint(board, x, y);
  const neighbors = findNeighbors(board, x, y);

  return {
    north: adjacentLiberties.north || neighbors.north?.color === player ? neighbors.north : null,
    east: adjacentLiberties.east || neighbors.east?.color === player ? neighbors.east : null,
    south: adjacentLiberties.south || neighbors.south?.color === player ? neighbors.south : null,
    west: adjacentLiberties.west || neighbors.west?.color === player ? neighbors.west : null,
  };
}

/**
 * Find the number of open spaces that are connected to chains adjacent to a given point, and return the maximum
 */
export function findMaxLibertyCountOfAdjacentChains(boardState: BoardState, x: number, y: number, player: GoColor) {
  const neighbors = findAdjacentLibertiesAndAlliesForPoint(boardState.board, x, y, player);
  const friendlyNeighbors = [neighbors.north, neighbors.east, neighbors.south, neighbors.west]
    .filter(isNotNullish)
    .filter((neighbor) => neighbor.color === player);

  return friendlyNeighbors.reduce((max, neighbor) => Math.max(max, neighbor?.liberties?.length ?? 0), 0);
}

export function findEnemyNeighborChainWithFewestLiberties(board: Board, x: number, y: number, player: GoColor) {
  const chains = getAllChains(board);
  const neighbors = findAdjacentLibertiesAndAlliesForPoint(board, x, y, player);
  const friendlyNeighbors = [neighbors.north, neighbors.east, neighbors.south, neighbors.west]
    .filter(isNotNullish)
    .filter((neighbor) => neighbor.color === player);

  const minimumLiberties = friendlyNeighbors.reduce(
    (min, neighbor) => Math.min(min, neighbor?.liberties?.length ?? 0),
    friendlyNeighbors?.[0]?.liberties?.length ?? 99,
  );

  const chainId = friendlyNeighbors.find((neighbor) => neighbor?.liberties?.length === minimumLiberties)?.chain;
  return chains.find((chain) => chain[0].chain === chainId);
}

/**
 * Find the number of open spaces that are connected to chains adjacent to a given point, and return the minimum
 */
export function findMinLibertyCountOfAdjacentChains(board: Board, x: number, y: number, player: GoColor) {
  const chain = findEnemyNeighborChainWithFewestLiberties(board, x, y, player);
  return chain?.[0]?.liberties?.length ?? 99;
}

/**
  Clear the chain and liberty data of all points in the given chains
 */
const resetChainsById = (board: Board, chainIds: string[]) => {
  for (const column of board) {
    for (const point of column) {
      if (!point || !chainIds.includes(point.chain)) continue;
      point.chain = "";
      point.liberties = [];
    }
  }
};

/**
 * Determines if chain has a point that matches the given coordinates
 */
export function isPointInChain(point: PointState, chain: PointState[]) {
  return !!chain.find((chainPoint) => chainPoint.x === point.x && chainPoint.y === point.y);
}

/**
 * Gets all points adjacent to the given point
 */
export function getAllNeighbors(board: Board, chain: PointState[]) {
  const allNeighbors = chain.reduce((chainNeighbors: Set<PointState>, point: PointState) => {
    getArrayFromNeighbor(findNeighbors(board, point.x, point.y))
      .filter((neighborPoint) => !isPointInChain(neighborPoint, chain))
      .forEach((neighborPoint) => chainNeighbors.add(neighborPoint));
    return chainNeighbors;
  }, new Set<PointState>());
  return [...allNeighbors];
}

/**
 * Find all empty points adjacent to any piece in a given chain
 */
export function findLibertiesForChain(board: Board, chain: PointState[]): PointState[] {
  return getAllNeighbors(board, chain).filter((neighbor) => neighbor && neighbor.color === GoColor.empty);
}

function findCapturedChainOfColor(chainList: PointState[][], playerColor: GoColor) {
  return chainList.filter((chain) => chain?.[0].color === playerColor && chain?.[0].liberties?.length === 0);
}

/**
 * Find any group of stones with no liberties (who therefore are to be removed from the board)
 */
export function findAllCapturedChains(chainList: PointState[][], playerWhoMoved: GoColor) {
  const opposingPlayer = playerWhoMoved === GoColor.white ? GoColor.black : GoColor.white;
  const enemyChainsToCapture = findCapturedChainOfColor(chainList, opposingPlayer);

  if (enemyChainsToCapture.length) {
    return enemyChainsToCapture;
  }

  const friendlyChainsToCapture = findCapturedChainOfColor(chainList, playerWhoMoved);
  if (friendlyChainsToCapture.length) {
    return friendlyChainsToCapture;
  }

  return null; // ### ???
}

/**
 * Create a new evaluation board and play out the results of the given move on the new board
 * @returns the evaluation board
 */
export function evaluateMoveResult(board: Board, x: number, y: number, player: GoColor, resetChains = false): Board {
  const evaluationBoard = getBoardCopy(board);
  const point = evaluationBoard[x]?.[y];
  if (!point) return board;

  point.color = player;

  const neighbors = getArrayFromNeighbor(findNeighbors(board, x, y));
  const chainIdsToUpdate = [point.chain, ...neighbors.map((point) => point.chain)];
  resetChainsById(evaluationBoard, chainIdsToUpdate);
  updateCaptures(evaluationBoard, player, resetChains);
  return evaluationBoard;
}

/**
 * Determines if the given player can legally make a move at the specified coordinates.
 *
 * You cannot repeat previous board states, to prevent endless loops (superko rule)
 *
 * You cannot make a move that would remove all liberties of your own piece(s) unless it captures opponent's pieces
 *
 * You cannot make a move in an occupied space
 *
 * You cannot make a move if it is not your turn, or if the game is over
 *
 * @returns a validity explanation for if the move is legal or not
 */
export function evaluateIfMoveIsValid(boardState: BoardState, x: number, y: number, player: GoColor, shortcut = true) {
  const point = boardState.board[x]?.[y];

  if (boardState.previousPlayer === null) {
    return GoValidity.gameOver;
  }
  if (boardState.previousPlayer === player) {
    return GoValidity.notYourTurn;
  }
  if (!point) {
    return GoValidity.pointBroken;
  }
  if (point.color !== GoColor.empty) {
    return GoValidity.pointNotEmpty;
  }

  // Detect if the move might be an immediate repeat (only one board of history is saved to check)
  const possibleRepeat = boardState.previousBoards.find((board) => getColorOnBoardString(board, x, y) === player);

  if (shortcut) {
    // If the current point has some adjacent open spaces, it is not suicide. If the move is not repeated, it is legal
    const liberties = findAdjacentLibertiesForPoint(boardState.board, x, y);
    const hasLiberty = liberties.north || liberties.east || liberties.south || liberties.west;
    if (!possibleRepeat && hasLiberty) {
      return GoValidity.valid;
    }

    // If a connected friendly chain has more than one liberty, the move is not suicide. If the move is not repeated, it is legal
    const neighborChainLibertyCount = findMaxLibertyCountOfAdjacentChains(boardState, x, y, player);
    if (!possibleRepeat && neighborChainLibertyCount > 1) {
      return GoValidity.valid;
    }

    // If there is any neighboring enemy chain with only one liberty, and the move is not repeated, it is valid,
    // because it would capture the enemy chain and free up some liberties for itself
    const potentialCaptureChainLibertyCount = findMinLibertyCountOfAdjacentChains(
      boardState.board,
      x,
      y,
      player === GoColor.black ? GoColor.white : GoColor.black,
    );
    if (!possibleRepeat && potentialCaptureChainLibertyCount < 2) {
      return GoValidity.valid;
    }

    // If there is no direct liberties for the move, no captures, and no neighboring friendly chains with multiple liberties,
    // the move is not valid because it would suicide the piece
    if (!hasLiberty && potentialCaptureChainLibertyCount >= 2 && neighborChainLibertyCount <= 1) {
      return GoValidity.noSuicide;
    }
  }

  // If the move has been played before and is not obviously illegal, we have to actually play it out to determine
  // if it is a repeated move, or if it is a valid move
  const evaluationBoard = evaluateMoveResult(boardState.board, x, y, player, true);
  if (evaluationBoard[x]?.[y]?.color !== player) {
    return GoValidity.noSuicide;
  }
  if (possibleRepeat && boardState.previousBoards.length) {
    const simpleEvalBoard = boardStringFromBoard(evaluationBoard);
    if (boardState.previousBoards.includes(simpleEvalBoard)) {
      return GoValidity.boardRepeated;
    }
  }

  return GoValidity.valid;
}

/**
 * Returns a list of points that are valid moves for the given player
 */
export function getAllValidMoves(boardState: BoardState, player: GoColor) {
  return getEmptySpaces(boardState.board).filter(
    (point) => evaluateIfMoveIsValid(boardState, point.x, point.y, player) === GoValidity.valid,
  );
}

/**
 * Gets all points that have player pieces adjacent to the given point
 */
export function getPlayerNeighbors(board: Board, chain: PointState[]) {
  return getAllNeighbors(board, chain).filter((neighbor) => neighbor && neighbor.color !== GoColor.empty);
}

/**
 * Get all player chains that are adjacent / touching the current chain
 */
export function getAllNeighboringChains(board: Board, chain: PointState[], allChains: PointState[][]) {
  const playerNeighbors = getPlayerNeighbors(board, chain);

  const neighboringChains = playerNeighbors.reduce(
    (neighborChains, neighbor) =>
      neighborChains.add(allChains.find((chain) => chain[0].chain === neighbor.chain) || []),
    new Set<PointState[]>(),
  );

  return [...neighboringChains];
}

/**
  Find all empty spaces completely surrounded by a single player color.
  For each player chain number, add any empty space chains that are completely surrounded by a single player's color to
   an array at that chain number's index.
 */
export function getAllPotentialEyes(board: Board, allChains: PointState[][], player: GoColor, _maxSize?: number) {
  const nodeCount = board.map((row) => row.filter((p) => p)).flat().length;
  const maxSize = _maxSize ?? Math.min(nodeCount * 0.4, 11);
  const emptyPointChains = allChains.filter((chain) => chain[0].color === GoColor.empty);
  const eyeCandidates: { neighbors: PointState[][]; chain: PointState[]; id: string }[] = [];

  emptyPointChains
    .filter((chain) => chain.length <= maxSize)
    .forEach((chain) => {
      const neighboringChains = getAllNeighboringChains(board, chain, allChains);

      const hasWhitePieceNeighbor = neighboringChains.find(
        (neighborChain) => neighborChain[0]?.color === GoColor.white,
      );
      const hasBlackPieceNeighbor = neighboringChains.find(
        (neighborChain) => neighborChain[0]?.color === GoColor.black,
      );

      // Record the neighbor chains of the eye candidate empty chain, if all of its neighbors are the same color piece
      if (
        (hasWhitePieceNeighbor && !hasBlackPieceNeighbor && player === GoColor.white) ||
        (!hasWhitePieceNeighbor && hasBlackPieceNeighbor && player === GoColor.black)
      ) {
        eyeCandidates.push({
          neighbors: neighboringChains,
          chain: chain,
          id: chain[0].chain,
        });
      }
    });

  return eyeCandidates;
}

/**
 * Determine the furthest that a chain extends in each of the cardinal directions
 */
function findFurthestPointsOfChain(chain: PointState[]) {
  return chain.reduce(
    (directions, point) => {
      if (point.y > directions.north) {
        directions.north = point.y;
      }
      if (point.y < directions.south) {
        directions.south = point.y;
      }
      if (point.x > directions.east) {
        directions.east = point.x;
      }
      if (point.x < directions.west) {
        directions.west = point.x;
      }

      return directions;
    },
    {
      north: chain[0].y,
      east: chain[0].x,
      south: chain[0].y,
      west: chain[0].x,
    },
  );
}

/**
 * Removes an element from an array at the given index
 */
function removePointAtIndex(arr: PointState[][], index: number) {
  const newArr = [...arr];
  newArr.splice(index, 1);
  return newArr;
}

/**
 *  For each chain bordering an eye candidate:
 *    remove all other neighboring chains. (replace with empty points)
 *    check if the eye candidate is a simple true eye now
 *       If so, the original candidate is a true eye.
 */
function findNeighboringChainsThatFullyEncircleEmptySpace(
  board: Board,
  candidateChain: PointState[],
  neighborChainList: PointState[][],
  allChains: PointState[][],
) {
  const boardMax = board[0].length - 1;
  const candidateSpread = findFurthestPointsOfChain(candidateChain);
  return neighborChainList.filter((neighborChain, index) => {
    // If the chain does not go far enough to surround the eye in question, don't bother building an eval board
    const neighborSpread = findFurthestPointsOfChain(neighborChain);

    const couldWrapNorth =
      neighborSpread.north > candidateSpread.north ||
      (candidateSpread.north === boardMax && neighborSpread.north === boardMax);
    const couldWrapEast =
      neighborSpread.east > candidateSpread.east ||
      (candidateSpread.east === boardMax && neighborSpread.east === boardMax);
    const couldWrapSouth =
      neighborSpread.south < candidateSpread.south || (candidateSpread.south === 0 && neighborSpread.south === 0);
    const couldWrapWest =
      neighborSpread.west < candidateSpread.west || (candidateSpread.west === 0 && neighborSpread.west === 0);

    if (!couldWrapNorth || !couldWrapEast || !couldWrapSouth || !couldWrapWest) {
      return false;
    }

    const evaluationBoard = getBoardCopy(board);
    const examplePoint = candidateChain[0];
    const otherChainNeighborPoints = removePointAtIndex(neighborChainList, index).flat().filter(isNotNullish);
    otherChainNeighborPoints.forEach((point) => {
      const pointToEdit = evaluationBoard[point.x]?.[point.y];
      if (pointToEdit) {
        pointToEdit.color = GoColor.empty;
      }
    });
    updateChains(evaluationBoard);
    const newChains = getAllChains(evaluationBoard);
    const newChainID = evaluationBoard[examplePoint.x]?.[examplePoint.y]?.chain;
    const chain = newChains.find((chain) => chain[0].chain === newChainID) || [];
    const newNeighborChains = getAllNeighboringChains(board, chain, allChains);

    return newNeighborChains.length === 1;
  });
}

/**
  Find all empty point groups where either:
  * all of its immediate surrounding player-controlled points are in the same continuous chain, or
  * it is completely surrounded by some single larger chain and the edge of the board

  Eyes are important, because a chain of pieces cannot be captured if it fully surrounds two or more eyes.
 */
export function getAllEyesByChainId(board: Board, player: GoColor) {
  const allChains = getAllChains(board);
  const eyeCandidates = getAllPotentialEyes(board, allChains, player);
  const eyes: { [s: string]: PointState[][] } = {};

  eyeCandidates.forEach((candidate) => {
    if (candidate.neighbors.length === 0) {
      return;
    }

    // If only one chain surrounds the empty space, it is a true eye
    if (candidate.neighbors.length === 1) {
      const neighborChainID = candidate.neighbors[0][0].chain;
      eyes[neighborChainID] = eyes[neighborChainID] || [];
      eyes[neighborChainID].push(candidate.chain);
      return;
    }

    // If any chain fully encircles the empty space (even if there are other chains encircled as well), the eye is true
    const neighborsEncirclingEye = findNeighboringChainsThatFullyEncircleEmptySpace(
      board,
      candidate.chain,
      candidate.neighbors,
      allChains,
    );
    neighborsEncirclingEye.forEach((neighborChain) => {
      const neighborChainID = neighborChain[0].chain;
      eyes[neighborChainID] = eyes[neighborChainID] || [];
      eyes[neighborChainID].push(candidate.chain);
    });
  });

  return eyes;
}

/**
 * Get a list of all eyes, grouped by the chain they are adjacent to
 */
export function getAllEyes(board: Board, player: GoColor, eyesObject?: { [s: string]: PointState[][] }) {
  const eyes = eyesObject ?? getAllEyesByChainId(board, player);
  return Object.keys(eyes).map((key) => eyes[key]);
}

/**
 * For a potential move, determine what the liberty of the point would be if played, by looking at adjacent empty nodes
 * as well as the remaining liberties of neighboring friendly chains
 */
export function findEffectiveLibertiesOfNewMove(board: Board, x: number, y: number, player: GoColor) {
  const friendlyChains = getAllChains(board).filter((chain) => chain[0].color === player);
  const neighbors = findAdjacentLibertiesAndAlliesForPoint(board, x, y, player);
  const neighborPoints = [neighbors.north, neighbors.east, neighbors.south, neighbors.west].filter(isNotNullish);
  // Get all chains that the new move will connect to
  const allyNeighbors = neighborPoints.filter((neighbor) => neighbor.color === player);
  const allyNeighborChainLiberties = allyNeighbors
    .map((neighbor) => {
      const chain = friendlyChains.find((chain) => chain[0].chain === neighbor.chain);
      return chain?.[0]?.liberties ?? null;
    })
    .flat()
    .filter(isNotNullish);

  // Get all empty spaces that the new move connects to that aren't already part of friendly liberties
  const directLiberties = neighborPoints.filter((neighbor) => neighbor.color === GoColor.empty);

  const allLiberties = [...directLiberties, ...allyNeighborChainLiberties];

  // filter out duplicates, and starting point
  return allLiberties
    .filter(
      (liberty, index) =>
        allLiberties.findIndex((neighbor) => liberty.x === neighbor.x && liberty.y === neighbor.y) === index,
    )
    .filter((liberty) => liberty.x !== x || liberty.y !== y);
}


// src/Go/boardAnalysis/patternMatching.ts
export const threeByThreePatterns = [
  // 3x3 piece patterns; X,O are color pieces; x,o are any state except the opposite color piece;
  // " " is off the edge of the board; "?" is any state (even off the board)
  [
    "XOX", // hane pattern - enclosing hane
    "...",
    "???",
  ],
  [
    "XO.", // hane pattern - non-cutting hane
    "...",
    "?.?",
  ],
  [
    "XO?", // hane pattern - magari
    "X..",
    "o.?",
  ],
  [
    ".O.", // generic pattern - katatsuke or diagonal attachment; similar to magari
    "X..",
    "...",
  ],
  [
    "XO?", // cut1 pattern (kiri] - unprotected cut
    "O.x",
    "?x?",
  ],
  [
    "XO?", // cut1 pattern (kiri] - peeped cut
    "O.X",
    "???",
  ],
  [
    "?X?", // cut2 pattern (de]
    "O.O",
    "xxx",
  ],
  [
    "OX?", // cut keima
    "x.O",
    "???",
  ],
  [
    "X.?", // side pattern - chase
    "O.?",
    "   ",
  ],
  [
    "OX?", // side pattern - block side cut
    "X.O",
    "   ",
  ],
  [
    "?X?", // side pattern - block side connection
    "o.O",
    "   ",
  ],
  [
    "?XO", // side pattern - sagari
    "o.o",
    "   ",
  ],
  [
    "?OX", // side pattern - cut
    "X.O",
    "   ",
  ],
];

function rotate90Degrees(pattern: string[]) {
  return [
    `${pattern[2][0]}${pattern[1][0]}${pattern[0][0]}`,
    `${pattern[2][1]}${pattern[1][1]}${pattern[0][1]}`,
    `${pattern[2][2]}${pattern[1][2]}${pattern[0][2]}`,
  ];
}

function verticalMirror(pattern: string[]) {
  return [pattern[2], pattern[1], pattern[0]];
}

function horizontalMirror(pattern: string[]) {
  return [
    pattern[0].split("").reverse().join(),
    pattern[1].split("").reverse().join(),
    pattern[2].split("").reverse().join(),
  ];
}

/**
 * Finds all variations of the pattern list, by expanding it using rotation and mirroring
 */
function expandAllThreeByThreePatterns() {
  const rotatedPatterns = [
    ...threeByThreePatterns,
    ...threeByThreePatterns.map(rotate90Degrees),
    ...threeByThreePatterns.map(rotate90Degrees).map(rotate90Degrees),
    ...threeByThreePatterns.map(rotate90Degrees).map(rotate90Degrees).map(rotate90Degrees),
  ];
  const mirroredPatterns = [...rotatedPatterns, ...rotatedPatterns.map(verticalMirror)];
  return [...mirroredPatterns, ...mirroredPatterns.map(horizontalMirror)];
}

/**
 * Gets the 8 points adjacent and diagonally adjacent to the given point
 */
function getNeighborhood(board: Board, x: number, y: number) {
  return [
    [board[x - 1]?.[y - 1], board[x - 1]?.[y], board[x - 1]?.[y + 1]],
    [board[x]?.[y - 1], board[x]?.[y], board[x]?.[y + 1]],
    [board[x + 1]?.[y - 1], board[x + 1]?.[y], board[x + 1]?.[y + 1]],
  ];
}

/**
 * @returns true if the given point matches the given string representation, false otherwise
 *
 * Capital X and O only match stones of that color
 * lowercase x and o match stones of that color, or empty space, or the edge of the board
 * a period "." only matches empty nodes
 * A space " " only matches the edge of the board
 * question mark "?" matches anything
 */
function matches(stringPoint: string, point: PointState | null, player: GoColor) {
  const opponent = player === GoColor.white ? GoColor.black : GoColor.white;
  switch (stringPoint) {
    case "X": {
      return point?.color === player;
    }
    case "O": {
      return point?.color === opponent;
    }
    case "x": {
      return point?.color !== opponent;
    }
    case "o": {
      return point?.color !== player;
    }
    case ".": {
      return point?.color === GoColor.empty;
    }
    case " ": {
      return point === null;
    }
    case "?": {
      return true;
    }
  }
  return null; // ### ???
}

/**
  Returns false if any point does not match the pattern, and true if it matches fully.
 */
function checkMatch(neighborhood: (PointState | null)[][], pattern: string[], player: GoColor) {
  const patternArr = pattern.join("").split("");
  const neighborhoodArray = neighborhood.flat();
  return patternArr.every((str, index) => matches(str, neighborhoodArray[index], player));
}

/**
 * Searches the board for any point that matches the expanded pattern set
 */
export async function findAnyMatchedPatterns(
  board: Board,
  player: GoColor,
  availableSpaces: PointState[],
  smart = true,
  rng: number,
) {
  const boardSize = board[0].length;
  const patterns = expandAllThreeByThreePatterns();
  const moves = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      const neighborhood = getNeighborhood(board, x, y);
      const matchedPattern = patterns.find((pattern) => checkMatch(neighborhood, pattern, player));

      if (
        matchedPattern &&
        availableSpaces.find((availablePoint) => availablePoint.x === x && availablePoint.y === y) &&
        (!smart || findEffectiveLibertiesOfNewMove(board, x, y, player).length > 1)
      ) {
        moves.push(board[x][y]);
      }
    }
    await sleep(10);
  }
  return moves[Math.floor(rng * moves.length)] || null;
}


// src/Go/boardState/boardState.ts
/**
 * Finds all empty spaces on the board.
 */
export function getEmptySpaces(board: Board): PointState[] {
  const emptySpaces: PointState[] = [];

  board.forEach((column) => {
    column.forEach((point) => {
      if (point && point.color === GoColor.empty) {
        emptySpaces.push(point);
      }
    });
  });

  return emptySpaces;
}

export function findNeighbors(board: Board, x: number, y: number): Neighbor {
  return {
    north: board[x]?.[y + 1],
    east: board[x + 1]?.[y],
    south: board[x]?.[y - 1],
    west: board[x - 1]?.[y],
  };
}

export function isNotNullish<T>(argument: T | undefined | null): argument is T {
  return argument != null;
}

/** Make a deep copy of a board */
export function getBoardCopy(board: Board): Board {
  return structuredClone(board);
}

export function getArrayFromNeighbor(neighborObject: Neighbor): PointState[] {
  return [neighborObject.north, neighborObject.east, neighborObject.south, neighborObject.west].filter(isNotNullish);
}

/**
 * Removes the chain data from all points on a board, in preparation for being recalculated later
 * Updates the board in-place
 */
function clearChains(board: Board): void {
  for (const column of board) {
    for (const point of column) {
      if (!point) continue;
      point.chain = "";
      point.liberties = null;
    }
  }
}

export function contains(arr: PointState[], point: PointState) {
  return !!arr.find((p) => p && p.x === point.x && p.y === point.y);
}

/**
 * Finds all the pieces in the current continuous group, or 'chain'
 *
 * Iteratively traverse the adjacent pieces of the same color to find all the pieces in the same chain,
 * which are the pieces connected directly via a path consisting only of only up/down/left/right
 */
export function findAdjacentPointsInChain(board: Board, x: number, y: number) {
  const point = board[x][y];
  if (!point) {
    return [];
  }
  const checkedPoints: PointState[] = [];
  const adjacentPoints: PointState[] = [point];
  const pointsToCheckNeighbors: PointState[] = [point];

  while (pointsToCheckNeighbors.length) {
    const currentPoint = pointsToCheckNeighbors.pop();
    if (!currentPoint) {
      break;
    }

    checkedPoints.push(currentPoint);
    const neighbors = findNeighbors(board, currentPoint.x, currentPoint.y);

    [neighbors.north, neighbors.east, neighbors.south, neighbors.west].filter(isNotNullish).forEach((neighbor) => {
      if (neighbor && neighbor.color === currentPoint.color && !contains(checkedPoints, neighbor)) {
        adjacentPoints.push(neighbor);
        pointsToCheckNeighbors.push(neighbor);
      }
      checkedPoints.push(neighbor);
    });
  }

  return adjacentPoints;
}

/**
 * Finds all groups of connected stones on the board, and updates the points in them with their
 * chain information and liberties.
 * Updates a board in-place.
 */
export function updateChains(board: Board, resetChains = true): void {
  resetChains && clearChains(board);

  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      const point = board[x][y];
      // If the current point is already analyzed, skip it
      if (!point || point.chain !== "") continue;

      const chainMembers = findAdjacentPointsInChain(board, x, y);
      const libertiesForChain = findLibertiesForChain(board, chainMembers);
      const id = `${point.x},${point.y}`;

      chainMembers.forEach((member) => {
        member.chain = id;
        member.liberties = libertiesForChain;
      });
    }
  }
}

/**
 * Removes a chain from the board, after being captured
 */
function captureChain(chain: PointState[]) {
  chain.forEach((point) => {
    point.color = GoColor.empty;
    point.chain = "";
    point.liberties = [];
  });
}

/**
 * Assign each point on the board a chain ID, and link its list of 'liberties' (which are empty spaces
 * adjacent to some point on the chain including the current point).
 *
 * Then, remove any chains with no liberties.
 * Modifies the board in place.
 */
export function updateCaptures(board: Board, playerWhoMoved: GoColor, resetChains = true): void {
  updateChains(board, resetChains);
  const chains = getAllChains(board);

  const chainsToCapture = findAllCapturedChains(chains, playerWhoMoved);
  if (!chainsToCapture?.length) {
    return;
  }

  chainsToCapture?.forEach((chain) => captureChain(chain));
  updateChains(board);
}


// src/Go/boardAnalysis/controlledTerritory.ts
/**
 * Any empty space fully encircled by the opponent is not worth playing in, unless one of its borders explicitly has a weakness
 *
 * Specifically, ignore any empty space encircled by the opponent, unless one of the chains that is on the exterior:
 *   * does not have too many more liberties
 *   * has been fully encircled on the outside by the current player
 *   * Only has liberties remaining inside the abovementioned empty space
 *
 * In which case, only the liberties of that one weak chain are worth considering. Other parts of that fully-encircled
 * enemy space, and other similar spaces, should be ignored, otherwise the game drags on too long
 */
export function findDisputedTerritory(boardState: BoardState, player: GoColor, excludeFriendlyEyes?: boolean) {
  let validMoves = getAllValidMoves(boardState, player);
  if (excludeFriendlyEyes) {
    const friendlyEyes = getAllEyes(boardState.board, player)
      .filter((eye) => eye.length >= 2)
      .flat()
      .flat();
    validMoves = validMoves.filter((point) => !contains(friendlyEyes, point));
  }
  const opponent = player === GoColor.white ? GoColor.black : GoColor.white;
  const chains = getAllChains(boardState.board);
  const emptySpacesToAnalyze = getAllPotentialEyes(boardState.board, chains, opponent);
  const nodesInsideEyeSpacesToAnalyze = emptySpacesToAnalyze.map((space) => space.chain).flat();

  const playableNodesInsideOfEnemySpace = emptySpacesToAnalyze.reduce((playableNodes: PointState[], space) => {
    // Look for any opponent chains on the border of the empty space, to see if it has a weakness
    const attackableLiberties = space.neighbors
      .map((neighborChain) => {
        const liberties = neighborChain[0].liberties ?? [];

        // Ignore border chains with too many liberties, they can't effectively be attacked
        if (liberties.length > 4) {
          return [];
        }

        // Get all opponent chains that make up the border of the opponent-controlled space
        const neighborChains = getAllNeighboringChains(boardState.board, neighborChain, chains);

        // Ignore border chains that do not touch the current player's pieces somewhere, as they are likely fully interior
        // to the empty space in question, or only share a border with the edge of the board and the space, or are not yet
        // surrounded on the exterior and ready to be attacked within
        if (!neighborChains.find((chain) => chain?.[0]?.color === player)) {
          return [];
        }

        const libertiesInsideOfSpaceToAnalyze = liberties
          .filter(isNotNullish)
          .filter((point) => contains(space.chain, point));

        // If the chain has any liberties outside the empty space being analyzed, it is not yet fully surrounded,
        // and should not be attacked yet
        if (libertiesInsideOfSpaceToAnalyze.length !== liberties.length) {
          return [];
        }

        // If the enemy chain is fully surrounded on the outside of the space by the current player, then its liberties
        // inside the empty space is worth considering for an attack
        return libertiesInsideOfSpaceToAnalyze;
      })
      .flat();

    return [...playableNodes, ...attackableLiberties];
  }, []);

  // Return only valid moves that are not inside enemy surrounded empty spaces, or ones that are explicitly next to an enemy chain that can be attacked
  return validMoves.filter(
    (move) => !contains(nodesInsideEyeSpacesToAnalyze, move) || contains(playableNodesInsideOfEnemySpace, move),
  );
}

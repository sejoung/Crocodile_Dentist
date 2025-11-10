const canvas = document.getElementById('croc-canvas');
const gl = canvas ? canvas.getContext('webgl') : null;

const startBtn = document.querySelector('[data-action="start"]');
const resetBtn = document.querySelector('[data-action="reset"]');
const messageEl = document.querySelector('[data-message]');
const roundEl = document.querySelector('[data-round]');
const safeCountEl = document.querySelector('[data-safe-count]');
const bestEl = document.querySelector('[data-best]');

const TEETH_LAYOUT = [
  { x: -0.72, width: 0.12, height: 0.18, offsetY: 0.08, jaw: 'upper' },
  { x: -0.52, width: 0.13, height: 0.2, offsetY: 0.09, jaw: 'upper' },
  { x: -0.32, width: 0.14, height: 0.21, offsetY: 0.1, jaw: 'upper' },
  { x: -0.12, width: 0.14, height: 0.21, offsetY: 0.11, jaw: 'upper' },
  { x: 0.12, width: 0.14, height: 0.21, offsetY: 0.11, jaw: 'upper' },
  { x: 0.34, width: 0.13, height: 0.2, offsetY: 0.09, jaw: 'upper' },
  { x: 0.54, width: 0.12, height: 0.18, offsetY: 0.08, jaw: 'upper' },
  { x: -0.62, width: 0.12, height: 0.18, offsetY: 0.08, jaw: 'lower' },
  { x: -0.42, width: 0.13, height: 0.2, offsetY: 0.09, jaw: 'lower' },
  { x: -0.22, width: 0.14, height: 0.21, offsetY: 0.11, jaw: 'lower' },
  { x: 0, width: 0.14, height: 0.21, offsetY: 0.12, jaw: 'lower' },
  { x: 0.22, width: 0.14, height: 0.21, offsetY: 0.11, jaw: 'lower' },
  { x: 0.42, width: 0.13, height: 0.2, offsetY: 0.09, jaw: 'lower' },
  { x: 0.62, width: 0.12, height: 0.18, offsetY: 0.08, jaw: 'lower' },
];

const state = {
  round: 0,
  safeCount: 0,
  best: 0,
  dangerTooth: null,
  gameActive: false,
  hoverTooth: null,
  teethStatus: Array(TEETH_LAYOUT.length).fill('idle'),
};

const animationState = {
  mouthOpen: 0.35,
  targetMouthOpen: 0.35,
  time: 0,
  eyeOpen: 1,
  wiggle: 0,
  upperJawCenter: 0.3,
  lowerJawCenter: -0.25,
  toothBounds: Array(TEETH_LAYOUT.length).fill(null),
};

let program = null;
let positionBuffer = null;
let attribLocations = null;
let uniformLocations = null;
let animationFrameId = null;
let lastFrameTime = 0;

const COLORS = {
  background: [0.01, 0.05, 0.08, 1],
  bodyBase: [0.07, 0.5, 0.28, 1],
  bodyShadow: [0.03, 0.29, 0.16, 1],
  upperJaw: [0.05, 0.36, 0.18, 1],
  lowerJaw: [0.04, 0.26, 0.13, 1],
  innerMouth: [0.02, 0.08, 0.08, 1],
  tongue: [0.82, 0.25, 0.28, 1],
  eyeWhite: [0.98, 0.99, 1, 1],
  eyeLid: [0.15, 0.45, 0.23, 1],
  pupil: [0.02, 0.05, 0.06, 1],
  nostril: [0.03, 0.1, 0.06, 1],
  toothIdle: [0.98, 0.98, 0.98, 1],
  toothHover: [0.95, 0.85, 0.55, 1],
  toothSafe: [0.65, 0.95, 0.65, 1],
  toothDanger: [0.98, 0.35, 0.35, 1],
};

function createShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);
  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    console.error(glContext.getShaderInfoLog(shader));
    glContext.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(glContext, vertexSource, fragmentSource) {
  const vertexShader = createShader(glContext, glContext.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const prog = glContext.createProgram();
  glContext.attachShader(prog, vertexShader);
  glContext.attachShader(prog, fragmentShader);
  glContext.linkProgram(prog);
  if (!glContext.getProgramParameter(prog, glContext.LINK_STATUS)) {
    console.error(glContext.getProgramInfoLog(prog));
    glContext.deleteProgram(prog);
    return null;
  }
  return prog;
}

function setupWebGL() {
  if (!gl) {
    setMessage('WebGL을 지원하는 브라우저가 필요합니다.');
    if (startBtn) startBtn.disabled = true;
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main() {
      gl_FragColor = u_color;
    }
  `;

  program = createProgram(gl, vertexSource, fragmentSource);
  if (!program) {
    setMessage('WebGL 초기화에 실패했습니다.');
    if (startBtn) startBtn.disabled = true;
    return;
  }

  positionBuffer = gl.createBuffer();
  attribLocations = {
    position: gl.getAttribLocation(program, 'a_position'),
  };
  uniformLocations = {
    color: gl.getUniformLocation(program, 'u_color'),
  };

  gl.enableVertexAttribArray(attribLocations.position);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(attribLocations.position, 2, gl.FLOAT, false, 0, 0);

  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  lastFrameTime = performance.now();
  const frame = (time) => {
    const delta = Math.min((time - lastFrameTime) / 1000, 0.1);
    lastFrameTime = time;
    updateAnimation(delta);
    renderScene();
    animationFrameId = requestAnimationFrame(frame);
  };
  animationFrameId = requestAnimationFrame(frame);
}

function resizeCanvas() {
  if (!gl || !canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(canvas.clientWidth * dpr);
  const displayHeight = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function drawGeometry(vertices, color) {
  if (!gl) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
  gl.vertexAttribPointer(attribLocations.position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform4fv(uniformLocations.color, color);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
}

function drawRect(x, y, width, height, color) {
  const x1 = x - width / 2;
  const x2 = x + width / 2;
  const y1 = y - height / 2;
  const y2 = y + height / 2;
  const vertices = [
    x1, y1,
    x2, y1,
    x1, y2,
    x1, y2,
    x2, y1,
    x2, y2,
  ];
  drawGeometry(vertices, color);
}

function drawEllipse(cx, cy, rx, ry, color, segments = 32) {
  const vertices = [];
  for (let i = 0; i < segments; i += 1) {
    const angle1 = (i / segments) * Math.PI * 2;
    const angle2 = ((i + 1) / segments) * Math.PI * 2;
    vertices.push(
      cx,
      cy,
      cx + Math.cos(angle1) * rx,
      cy + Math.sin(angle1) * ry,
      cx + Math.cos(angle2) * rx,
      cy + Math.sin(angle2) * ry,
    );
  }
  drawGeometry(vertices, color);
}

function updateAnimation(delta) {
  animationState.time += delta;
  animationState.wiggle = Math.sin(animationState.time * 2) * 0.01;
  const blinkWave = Math.pow(Math.max(0, Math.sin(animationState.time * 0.9)), 8);
  animationState.eyeOpen = 1 - 0.7 * blinkWave;
  const lerpFactor = Math.min(delta * 6, 1);
  animationState.mouthOpen += (animationState.targetMouthOpen - animationState.mouthOpen) * lerpFactor;
}

function getJawCenters() {
  const wiggle = animationState.wiggle * 0.5;
  const mouth = animationState.mouthOpen;
  const upper = 0.25 + mouth * 0.35 + wiggle;
  const lower = -0.2 - mouth * 0.45 - wiggle;
  animationState.upperJawCenter = upper;
  animationState.lowerJawCenter = lower;
  return { upper, lower };
}

function getToothBounds(idx) {
  const layout = TEETH_LAYOUT[idx];
  const centers = {
    upper: animationState.upperJawCenter,
    lower: animationState.lowerJawCenter,
  };
  const centerY = centers[layout.jaw];
  const direction = layout.jaw === 'upper' ? -1 : 1;
  const y = centerY + direction * layout.offsetY;
  return {
    x: layout.x,
    y,
    width: layout.width,
    height: layout.height,
  };
}

function renderScene() {
  if (!gl || !program) return;
  gl.useProgram(program);
  gl.clearColor(...COLORS.background);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const { upper, lower } = getJawCenters();
  const mouthGap = upper - lower;
  const innerHeight = Math.max(mouthGap * 0.8, 0.2);
  const innerCenter = (upper + lower) / 2;

  drawRect(0, 0.15, 2.4, 1.5, COLORS.bodyShadow);
  drawRect(0, 0.2 + animationState.wiggle * 0.2, 2.3, 1.3, COLORS.bodyBase);

  drawRect(0, upper + 0.2, 2.2, 0.9, COLORS.upperJaw);
  drawRect(0, lower - 0.15, 2.2, 0.8, COLORS.lowerJaw);

  drawRect(0, innerCenter, 1.9, innerHeight, COLORS.innerMouth);
  drawRect(0, lower + 0.2, 1.2, 0.2, COLORS.tongue);

  const eyeHeight = 0.12 * animationState.eyeOpen;
  drawEllipse(-0.4, 0.85, 0.18, eyeHeight + 0.02, COLORS.eyeLid);
  drawEllipse(0.4, 0.85, 0.18, eyeHeight + 0.02, COLORS.eyeLid);
  drawEllipse(-0.4, 0.87, 0.16, eyeHeight, COLORS.eyeWhite);
  drawEllipse(0.4, 0.87, 0.16, eyeHeight, COLORS.eyeWhite);
  drawEllipse(-0.4 + animationState.wiggle * 0.5, 0.85, 0.07, eyeHeight * 0.7, COLORS.pupil);
  drawEllipse(0.4 + animationState.wiggle * 0.5, 0.85, 0.07, eyeHeight * 0.7, COLORS.pupil);

  drawRect(-0.2, upper + 0.35, 0.1, 0.05, COLORS.nostril);
  drawRect(0.2, upper + 0.35, 0.1, 0.05, COLORS.nostril);

  TEETH_LAYOUT.forEach((_, idx) => {
    const bounds = getToothBounds(idx);
    animationState.toothBounds[idx] = bounds;
    const status = state.teethStatus[idx];
    let color = COLORS.toothIdle;
    if (status === 'safe') color = COLORS.toothSafe;
    if (status === 'danger') color = COLORS.toothDanger;
    if (state.hoverTooth === idx && status === 'idle' && state.gameActive) {
      color = COLORS.toothHover;
    }
    drawRect(bounds.x, bounds.y, bounds.width, bounds.height, color);
  });
}

function canvasToClipSpace(event) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = (1 - (event.clientY - rect.top) / rect.height) * 2 - 1;
  return { x, y };
}

function toothFromCoords(x, y) {
  for (let i = 0; i < animationState.toothBounds.length; i += 1) {
    const bounds = animationState.toothBounds[i];
    if (!bounds) continue;
    const withinX = x >= bounds.x - bounds.width / 2 && x <= bounds.x + bounds.width / 2;
    const withinY = y >= bounds.y - bounds.height / 2 && y <= bounds.y + bounds.height / 2;
    if (withinX && withinY) {
      return i;
    }
  }
  return null;
}

function handleCanvasClick(event) {
  if (!state.gameActive) return;
  const clip = canvasToClipSpace(event);
  if (!clip) return;
  const idx = toothFromCoords(clip.x, clip.y);
  if (idx === null || state.teethStatus[idx] !== 'idle') return;

  if (idx === state.dangerTooth) {
    state.teethStatus[idx] = 'danger';
    animationState.targetMouthOpen = 0.12;
    revealDanger();
    endRound({ won: false });
  } else {
    state.teethStatus[idx] = 'safe';
    state.safeCount += 1;
    state.best = Math.max(state.best, state.safeCount);
    updateScoreboard();
    setMessage('좋아요! 계속 눌러보세요.');
    if (state.safeCount === TEETH_LAYOUT.length - 1) {
      revealDanger();
      endRound({ won: true });
    }
  }
}

function startRound() {
  if (state.gameActive) return;
  state.round += 1;
  state.safeCount = 0;
  state.gameActive = true;
  state.dangerTooth = Math.floor(Math.random() * TEETH_LAYOUT.length);
  state.hoverTooth = null;
  state.teethStatus = Array(TEETH_LAYOUT.length).fill('idle');
  animationState.targetMouthOpen = 0.6;
  setMessage('위험한 이빨을 조심하세요!');
  updateScoreboard();
  if (startBtn) startBtn.disabled = true;
}

function endRound({ won }) {
  state.gameActive = false;
  state.hoverTooth = null;
  animationState.targetMouthOpen = won ? 0.4 : 0.15;
  if (won) {
    setMessage('모든 안전한 이빨을 찾았어요! 🎉');
  } else {
    setMessage('악어가 물었어요! 다시 도전해 보세요.');
  }
  if (startBtn) startBtn.disabled = false;
}

function resetGame() {
  state.round = 0;
  state.safeCount = 0;
  state.best = 0;
  state.gameActive = false;
  state.dangerTooth = null;
  state.hoverTooth = null;
  state.teethStatus = Array(TEETH_LAYOUT.length).fill('idle');
  animationState.targetMouthOpen = 0.35;
  setMessage('라운드 시작해 악어 입을 열어보세요.');
  updateScoreboard();
  if (startBtn) startBtn.disabled = false;
}

function revealDanger() {
  state.teethStatus = state.teethStatus.map((status, idx) => (idx === state.dangerTooth ? 'danger' : status));
}

function updateScoreboard() {
  if (roundEl) roundEl.textContent = String(state.round);
  if (safeCountEl) safeCountEl.textContent = String(state.safeCount);
  if (bestEl) bestEl.textContent = String(state.best);
}

function setMessage(text) {
  if (messageEl) messageEl.textContent = text;
}

function handleCanvasHover(event) {
  if (!state.gameActive) {
    if (state.hoverTooth !== null) state.hoverTooth = null;
    return;
  }
  const clip = canvasToClipSpace(event);
  if (!clip) {
    if (state.hoverTooth !== null) state.hoverTooth = null;
    return;
  }
  const idx = toothFromCoords(clip.x, clip.y);
  state.hoverTooth = idx;
}

function clearHover() {
  state.hoverTooth = null;
}

if (canvas) {
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', handleCanvasHover);
  canvas.addEventListener('mouseleave', clearHover);
}
if (startBtn) startBtn.addEventListener('click', startRound);
if (resetBtn) resetBtn.addEventListener('click', resetGame);

setupWebGL();
updateScoreboard();

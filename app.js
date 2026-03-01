// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMJPlKEdwbIiHxm3YLSn87rv_WPwZxF1Rp6NyrDVvOn62AIdxSgO4gu6eF9Mh5lu2x/exec";

// State Variables
let currentRound = 1;
const totalRounds = 3;
let sessionResults = [];
let referenceColor = { h: 0, s: 100, l: 50 };
let currentColor = { h: 0, s: 100, l: 50 };
let userGender = "";

// Initialize App State
function init() {
    setupEventListeners();
    resetSession();
}

function resetSession() {
    currentRound = 1;
    sessionResults = [];
    document.getElementById('btn-submit').innerHTML = `Confirmar Igualdad (1/3)`;

    // Reset Finish Screen Visuals
    document.getElementById('score-container').style.display = 'none';
    document.getElementById('stats-comparison').style.display = 'none';
    document.getElementById('score-title').textContent = "Calculando...";
    document.getElementById('score-message').textContent = "";
    document.getElementById('score-circle').setAttribute('stroke-dasharray', `0, 100`);

    randomizeExperiment();
    updateUIColors();
}

function randomizeExperiment() {
    document.getElementById('round-counter').textContent = `Color ${currentRound} de ${totalRounds}`;

    referenceColor.h = Math.floor(Math.random() * 361);
    referenceColor.s = Math.floor(Math.random() * 70) + 30;

    let offsetH = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 40) + 20);
    let offsetS = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 30) + 15);

    currentColor.h = (referenceColor.h + offsetH + 360) % 360; // Wrap around
    currentColor.s = Math.max(0, Math.min(100, referenceColor.s + offsetS)); // Clamp 0-100

    document.getElementById('slider-hue').value = currentColor.h;
    document.getElementById('slider-sat').value = currentColor.s;

    updateSliderBackgrounds();
}

function updateUIColors() {
    const refEl = document.getElementById('color-reference');
    const adjEl = document.getElementById('color-adjustable');

    refEl.style.backgroundColor = `hsl(${referenceColor.h}, ${referenceColor.s}%, ${referenceColor.l}%)`;
    adjEl.style.backgroundColor = `hsl(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%)`;

    document.getElementById('val-hue').textContent = `${currentColor.h}°`;
    document.getElementById('val-sat').textContent = `${currentColor.s}%`;

    updateSliderBackgrounds();
}

function updateSliderBackgrounds() {
    const satSlider = document.getElementById('slider-sat');
    satSlider.style.background = `linear-gradient(to right, hsl(${currentColor.h}, 0%, 50%), hsl(${currentColor.h}, 100%, 50%))`;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    // Make background neutral grey only during experiment for accurate color perception
    if (screenId === 'screen-experiment') {
        document.querySelector('.color-display').classList.add('neutral-bg');
    } else {
        document.querySelector('.color-display').classList.remove('neutral-bg');
    }
}

function setupEventListeners() {
    document.getElementById('btn-start').addEventListener('click', () => {
        const genderSelect = document.getElementById('user-gender');
        if (!genderSelect.value) {
            alert("Por favor, selecciona tu sexo biológico para continuar con el estudio.");
            genderSelect.focus();
            return;
        }
        userGender = genderSelect.value;
        resetSession();
        showScreen('screen-experiment');
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        resetSession();
        showScreen('screen-experiment');
    });

    const sliderHue = document.getElementById('slider-hue');
    const sliderSat = document.getElementById('slider-sat');

    sliderHue.addEventListener('input', (e) => {
        currentColor.h = parseInt(e.target.value);
        updateUIColors();
    });

    sliderSat.addEventListener('input', (e) => {
        currentColor.s = parseInt(e.target.value);
        updateUIColors();
    });

    const adjustValue = (property, amount, min, max, wrap) => {
        let val = currentColor[property] + amount;
        if (wrap) {
            val = (val + max + 1) % (max + 1);
        } else {
            val = Math.max(min, Math.min(max, val));
        }
        currentColor[property] = val;

        if (property === 'h') sliderHue.value = val;
        if (property === 's') sliderSat.value = val;

        updateUIColors();
    };

    document.getElementById('btn-hue-minus').addEventListener('click', () => adjustValue('h', -1, 0, 360, true));
    document.getElementById('btn-hue-plus').addEventListener('click', () => adjustValue('h', 1, 0, 360, true));

    document.getElementById('btn-sat-minus').addEventListener('click', () => adjustValue('s', -1, 0, 100, false));
    document.getElementById('btn-sat-plus').addEventListener('click', () => adjustValue('s', 1, 0, 100, false));

    document.getElementById('btn-submit').addEventListener('click', async () => {

        const dh = Math.abs(referenceColor.h - currentColor.h);
        const dhCorrected = dh > 180 ? 360 - dh : dh;
        const ds = Math.abs(referenceColor.s - currentColor.s);

        sessionResults.push({
            round: currentRound,
            referenceColor: { ...referenceColor },
            matchedColor: { ...currentColor },
            differences: { dh: dhCorrected, ds: ds }
        });

        if (currentRound < totalRounds) {
            currentRound++;
            document.getElementById('btn-submit').innerHTML = `Confirmar Igualdad (${currentRound}/${totalRounds})`;
            randomizeExperiment();
            updateUIColors();
        } else {
            const btn = document.getElementById('btn-submit');
            btn.innerHTML = 'Guardando...';
            btn.disabled = true;

            await finishSession();

            btn.disabled = false;
        }
    });
}

function calculateSessionScore() {
    let totalHueDiff = 0;
    let totalSatDiff = 0;

    sessionResults.forEach(res => {
        totalHueDiff += res.differences.dh;
        totalSatDiff += res.differences.ds;
    });

    const avgHueDiff = totalHueDiff / totalRounds;
    const avgSatDiff = totalSatDiff / totalRounds;

    // Fórmula de puntuación (arbitraria pero intuitiva)
    // Max Hue Diff tolerable: 30 grados
    // Max Sat Diff tolerable: 30%
    const hueScore = Math.max(0, 100 - (avgHueDiff / 30) * 100);
    const satScore = Math.max(0, 100 - (avgSatDiff / 30) * 100);

    // Tono (Hue) tiene más peso visualmente
    const finalScore = Math.round((hueScore * 0.7) + (satScore * 0.3));

    return {
        score: finalScore,
        avgHueDiff: avgHueDiff.toFixed(2),
        avgSatDiff: avgSatDiff.toFixed(2)
    };
}

function updateScoreUI(scoreData) {
    const scoreVal = scoreData.score;
    const scoreCircle = document.getElementById('score-circle');
    const scorePercentage = document.getElementById('score-percentage');
    const scoreMessage = document.getElementById('score-message');
    const scoreTitle = document.getElementById('score-title');
    const iconContainer = document.getElementById('score-icon');

    document.getElementById('score-container').style.display = 'block';

    // Animation setup
    setTimeout(() => {
        scoreCircle.setAttribute('stroke-dasharray', `${scoreVal}, 100`);
    }, 100);

    // Counter animation
    let count = 0;
    const interval = setInterval(() => {
        if (count >= scoreVal) {
            clearInterval(interval);
            scorePercentage.textContent = `${scoreVal}%`;
        } else {
            count += Math.ceil((scoreVal - count) / 5) || 1;
            scorePercentage.textContent = `${count}%`;
        }
    }, 30);

    // Gamification text
    if (scoreVal >= 90) {
        scoreCircle.setAttribute('stroke', '#10b981'); // Green
        scoreTitle.textContent = "¡Visión Perfecta!";
        scoreMessage.textContent = `Impresionante precisión superando la prueba del color. Tu nivel de detalle es increíble.`;
        iconContainer.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M12 15l-3-3m0 0l3-3m-3 3h8M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"/></svg>`;
    } else if (scoreVal >= 70) {
        scoreCircle.setAttribute('stroke', '#3b82f6'); // Blue
        scoreTitle.textContent = "¡Gran Trabajo!";
        scoreMessage.textContent = "Muy buena percepción del color. Felicidades.";
        iconContainer.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>`;
    } else if (scoreVal >= 40) {
        scoreCircle.setAttribute('stroke', '#f59e0b'); // Yellow
        scoreTitle.textContent = "Aceptable";
        scoreMessage.textContent = "Tienes una percepción de color normal. Seguro que la próxima vez lo clavas.";
        iconContainer.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"/></svg>`;
    } else {
        scoreCircle.setAttribute('stroke', '#ef4444'); // Red
        scoreTitle.textContent = "Mmm... ¡Inténtalo de nuevo!";
        scoreMessage.textContent = "Parece que te cuesta un poco diferenciar colores sutiles. ¡No pasa nada! Tus datos nos ayudan al estudio.";
        iconContainer.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    }
}

async function finishSession() {
    const scoreData = calculateSessionScore();

    // Convert timestamp strictly to readable local string format to prevent timezone bugs
    const timestampStr = new Date().toLocaleString("es-ES");

    const payload = {
        timestamp: timestampStr,
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        gender: userGender,
        roundsCompleted: totalRounds,
        sessionScore: scoreData.score,
        avgHueError: parseFloat(scoreData.avgHueDiff),
        avgSatError: parseFloat(scoreData.avgSatDiff),
        rounds: sessionResults.map(r => ({ ...r }))
    };

    try {
        // Fetch to Google Script Web App
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        console.log("Datos enviados a Google Sheets.");
    } catch (error) {
        console.error("Fetch request failed: ", error);
    }

    updateScoreUI(scoreData);
    showScreen('screen-finish');
}


// Start app
window.addEventListener('DOMContentLoaded', () => {
    init();
});

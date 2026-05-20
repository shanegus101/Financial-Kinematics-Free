function calculateKinematics(t, nominalRate, inflation, principal, monthlyDeposit, target) {
    const r_real = ((1 + nominalRate) / (1 + inflation)) - 1;
    const r = r_real > 0 ? r_real : 0.0001; 
    
    const P = principal;
    const PMT = monthlyDeposit * 12; 
    const C = P + (PMT / r);
    const lnA = Math.log(1 + r);

    const balance = C * Math.pow(1 + r, t) - (PMT / r);
    const velocity = C * lnA * Math.pow(1 + r, t);
    const acceleration = C * Math.pow(lnA, 2) * Math.pow(1 + r, t);

    const path = [];
    const targetLine = [];
    for (let i = 0; i <= 40; i += 1) {
        const val = C * Math.pow(1 + r, i) - (PMT / r);
        path.push({ x: i, y: val });
        targetLine.push({ x: i, y: target });
    }

    let yearsToTarget = null;
    const numerator = target + (PMT / r);
    if (numerator > 0 && C > 0) {
        const targetT = Math.log(numerator / C) / lnA;
        if (targetT > 0 && targetT < 100) {
            yearsToTarget = targetT;
        }
    }

    return {
        current: { balance, velocity, acceleration },
        path,
        targetLine,
        yearsToTarget,
        realRate: r
    };
}

const ctx = document.getElementById('mainChart').getContext('2d');
const mainChart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Projected Wealth (Real)',
                data: [],
                borderColor: '#4472c4',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                fill: true,
                backgroundColor: 'rgba(68, 114, 196, 0.1)',
                tension: 0.4 
            }, 
            {
                label: 'Target Wealth',
                data: [],
                borderColor: '#2ecc71',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false
            },
            {
                label: 'Current Position',
                data: [{x: 0, y: 0}],
                backgroundColor: '#ed7d31',
                borderColor: '#fff',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 10,
                type: 'scatter'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: 'easeOutQuart' },
        scales: {
            x: { type: 'linear', position: 'bottom', min: 0, max: 40, title: { display: true, text: 'Years', font: { weight: 'bold' } } },
            y: { beginAtZero: true, ticks: { callback: v => '$' + (v/1000000).toFixed(1) + 'M' } }
        },
        plugins: { 
            legend: { display: true, position: 'top', labels: { filter: item => item.text !== 'Current Position' } },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        if (context.datasetIndex === 1) return `Target: $${context.parsed.y.toLocaleString()}`;
                        
                        const t = context.parsed.x;
                        const inf = parseFloat(document.getElementById('infInput').value) / 100 || 0;
                        const nom = parseFloat(document.getElementById('rateInput').value) / 100 || 0;
                        const P = parseFloat(document.getElementById('principalInput').value) || 0;
                        const PMT = (parseFloat(document.getElementById('depositInput').value) || 0) * 12;
                        
                        const r = ((1 + nom) / (1 + inf)) - 1;
                        const C = P + (PMT / r);
                        const lnA = Math.log(1 + r);
                        
                        const bal = context.parsed.y;
                        const vel = C * lnA * Math.pow(1 + r, t);
                        
                        return [
                            `Balance: $${Math.round(bal).toLocaleString()}`,
                            `Velocity: $${Math.round(vel).toLocaleString()} / yr`
                        ];
                    }
                }
            }
        }
    }
});

const controlPairs = [
    { slider: document.getElementById('yearSlider'), input: document.getElementById('yearInput') },
    { slider: document.getElementById('rateSlider'), input: document.getElementById('rateInput') },
    { slider: document.getElementById('infSlider'), input: document.getElementById('infInput') },
    { slider: document.getElementById('principalSlider'), input: document.getElementById('principalInput') },
    { slider: document.getElementById('depositSlider'), input: document.getElementById('depositInput') },
    { slider: document.getElementById('targetSlider'), input: document.getElementById('targetInput') }
];

function updateApp() {
    const t = parseFloat(document.getElementById('yearInput').value) || 0;
    const nominalRate = parseFloat(document.getElementById('rateInput').value) / 100 || 0;
    const inflation = parseFloat(document.getElementById('infInput').value) / 100 || 0;
    const principal = parseFloat(document.getElementById('principalInput').value) || 0;
    const deposit = parseFloat(document.getElementById('depositInput').value) || 0;
    const target = parseFloat(document.getElementById('targetInput').value) || 0;

    const results = calculateKinematics(t, nominalRate, inflation, principal, deposit, target);

    document.getElementById('balDisp').innerText = "$" + Math.round(results.current.balance).toLocaleString();
    document.getElementById('velDisp').innerText = "$" + Math.round(results.current.velocity).toLocaleString() + "/yr";
    document.getElementById('accDisp').innerText = "$" + Math.round(results.current.acceleration).toLocaleString() + "/yr²";
    
    const targetEl = document.getElementById('targetDisp');
    if (results.yearsToTarget) {
        targetEl.innerText = results.yearsToTarget.toFixed(1) + " yrs";
        targetEl.style.color = "#2ecc71";
    } else {
        targetEl.innerText = "Unreachable";
        targetEl.style.color = "#e74c3c";
    }

    mainChart.data.datasets[0].data = results.path;
    mainChart.data.datasets[1].data = results.targetLine;
    mainChart.data.datasets[2].data = [{ x: t, y: results.current.balance }];
    mainChart.update();
}

controlPairs.forEach(pair => {
    pair.slider.addEventListener('input', (e) => {
        pair.input.value = e.target.value;
        updateApp();
    });
    
    pair.input.addEventListener('input', (e) => {
        pair.slider.value = e.target.value;
        updateApp();
    });
});

updateApp();

// --- Helper: Standard Normal Distribution Generator (Box-Muller Transform) ---
function randomNormal(mean, stdDev) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return (z * stdDev) + mean;
}

function calculateKinematics(t, nominalRate, inflation, principal, monthlyDeposit, target, volatility) {
    const r = ((1 + nominalRate) / (1 + inflation)) - 1;
    const P = principal;
    const PMT = monthlyDeposit * 12; 
    
    let balance, velocity, acceleration;
    const lnA = (r > -1 && r !== 0) ? Math.log(1 + r) : 0;

    // 1. Calculate Expected Kinematic State (Text Display)
    if (Math.abs(r) < 1e-7) {
        balance = P + PMT * t;
        velocity = PMT;
        acceleration = 0;
    } else {
        const C = P + (PMT / r);
        balance = C * Math.pow(1 + r, t) - (PMT / r);
        velocity = C * lnA * Math.pow(1 + r, t);
        acceleration = C * Math.pow(lnA, 2) * Math.pow(1 + r, t);
    }

    const path = [];
    const contributionsPath = [];
    const targetLine = [];
    const path5 = [];
    const path95 = [];
    const pathMedian = [];
    
    // 2. Monte Carlo Simulation Engine
    if (volatility > 0) {
        const numPaths = 250;
        const simPaths = Array.from({length: 41}, () => []);
        
        for (let p = 0; p < numPaths; p++) {
            let currentBal = P;
            simPaths[0].push(currentBal);
            for (let i = 1; i <= 40; i++) {
                const annualReturn = randomNormal(nominalRate, volatility);
                const realRate = ((1 + annualReturn) / (1 + inflation)) - 1;
                currentBal = currentBal * (1 + realRate) + PMT;
                simPaths[i].push(currentBal);
            }
        }

        for (let i = 0; i <= 40; i++) {
            simPaths[i].sort((a, b) => a - b);
            path5.push({ x: i, y: simPaths[i][Math.floor(numPaths * 0.05)] });
            pathMedian.push({ x: i, y: simPaths[i][Math.floor(numPaths * 0.5)] });
            path95.push({ x: i, y: simPaths[i][Math.floor(numPaths * 0.95)] });
            contributionsPath.push({ x: i, y: P + (PMT * i) });
            targetLine.push({ x: i, y: target });
        }
    } else {
        // Deterministic Fallback
        for (let i = 0; i <= 40; i += 1) {
            let val = (Math.abs(r) < 1e-7) ? (P + PMT * i) : ((P + (PMT / r)) * Math.pow(1 + r, i) - (PMT / r));
            path.push({ x: i, y: val });
            contributionsPath.push({ x: i, y: P + (PMT * i) });
            targetLine.push({ x: i, y: target });
        }
    }

    let yearsToTarget = null;
    if (P >= target) {
        yearsToTarget = 0;
    } else if (Math.abs(r) < 1e-7) {
        if (PMT > 0) {
            const targetT = (target - P) / PMT;
            if (targetT >= 0) yearsToTarget = targetT;
        }
    } else {
        const C = P + (PMT / r);
        const numerator = target + (PMT / r);
        if (C > 0 && numerator > 0) {
            const targetT = Math.log(numerator / C) / lnA;
            if (targetT >= 0 && targetT < 100) yearsToTarget = targetT;
        }
    }

    let crossoverYear = null;
    if (r > 0 && PMT > 0) {
        const C = P + (PMT / r);
        const argument = (2 * PMT) / (r * C);
        if (argument > 0) {
            const tCross = Math.log(argument) / lnA;
            if (tCross >= 0 && tCross <= 40) {
                crossoverYear = tCross;
            } else if (tCross < 0) {
                crossoverYear = 0;
            }
        }
    }

    return {
        current: { balance, velocity, acceleration },
        path: volatility > 0 ? pathMedian : path,
        path5: volatility > 0 ? path5 : [],
        path95: volatility > 0 ? path95 : [],
        contributionsPath,
        targetLine,
        yearsToTarget,
        crossoverYear,
        realRate: r
    };
}

const crossoverPlugin = {
    id: 'crossoverLine',
    afterDraw: (chart, args, options) => {
        if (options && options.xVal !== null) {
            const xVal = options.xVal;
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            
            if (xVal >= xAxis.min && xVal <= xAxis.max) {
                const xPixel = xAxis.getPixelForValue(xVal);
                const topY = yAxis.top;
                const bottomY = yAxis.bottom;
                const ctx = chart.ctx;
                
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([6, 4]);
                ctx.moveTo(xPixel, topY);
                ctx.lineTo(xPixel, bottomY);
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#e74c3c'; 
                ctx.stroke();
                
                const textSpace = 8;
                ctx.font = 'bold 11px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
                
                if (xPixel + 130 > xAxis.right) {
                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#e74c3c';
                    ctx.fillText('⚡ Compounding Crossover', xPixel - textSpace, topY + 15);
                    ctx.font = '10px sans-serif';
                    ctx.fillStyle = '#555';
                    ctx.fillText(`Year ${xVal.toFixed(1)} (Growth ≥ Deposits)`, xPixel - textSpace, topY + 30);
                } else {
                    ctx.textAlign = 'left';
                    ctx.fillStyle = '#e74c3c';
                    ctx.fillText('⚡ Compounding Crossover', xPixel + textSpace, topY + 15);
                    ctx.font = '10px sans-serif';
                    ctx.fillStyle = '#555';
                    ctx.fillText(`Year ${xVal.toFixed(1)} (Growth ≥ Deposits)`, xPixel + textSpace, topY + 30);
                }
                ctx.restore();
            }
        }
    }
};

// Global tracker to preserve the active timeline snapshot during slider modifications
let lastHoveredYear = null;

// Isolated layout renderer to dynamically compile timeline performance parameters
function renderExternalTooltip(chart, exactYear) {
    const tooltipEl = document.getElementById('graphTooltipBox');
    if (!tooltipEl || exactYear === null) return;

    const lookupIndex = Math.min(40, Math.max(0, Math.round(exactYear)));
    let htmlContent = `<div class="tooltip-title">Year ${exactYear.toFixed(1)}</div>`;

    const contribVal = chart.data.datasets[0].data[lookupIndex]?.y;
    const p5Val = chart.data.datasets[1].data[lookupIndex]?.y;
    const p95Val = chart.data.datasets[2].data[lookupIndex]?.y;
    const totalBal = chart.data.datasets[3].data[lookupIndex]?.y;
    const targetVal = chart.data.datasets[4].data[lookupIndex]?.y;

    if (contribVal !== undefined) {
        htmlContent += `
            <div class="tooltip-row"><strong>Contributions:</strong> <span>$${Math.round(contribVal).toLocaleString()}</span></div>
        `;
    }

    if (totalBal !== undefined && contribVal !== undefined) {
        const growthVal = Math.max(0, totalBal - contribVal);
        htmlContent += `
            <div class="tooltip-row"><strong>Compound Growth:</strong> <span>$${Math.round(growthVal).toLocaleString()}</span></div>
            <div class="tooltip-row" style="border-top: 1px solid #cbd5e0; padding-top: 4px; margin-top: 4px;">
                <strong>Total Real Wealth:</strong> <span style="color:#4472c4; font-weight:bold;">$${Math.round(totalBal).toLocaleString()}</span>
            </div>
        `;
    }

    if (p5Val !== undefined && p95Val !== undefined && chart.data.datasets[1].data.length > 0) {
        htmlContent += `
            <div class="tooltip-row" style="margin-top: 8px; border-top: 1px dashed #cbd5e0; padding-top: 4px;"><strong>95th Percentile:</strong> <span>$${Math.round(p95Val).toLocaleString()}</span></div>
            <div class="tooltip-row"><strong>5th Percentile:</strong> <span>$${Math.round(p5Val).toLocaleString()}</span></div>
            <div class="tooltip-row-nested">↳ Shaded Horizon: Market variance bounds (90% probability)</div>
        `;
    }

    if (targetVal !== undefined) {
        htmlContent += `
            <div class="tooltip-row" style="margin-top: 4px; font-size: 0.9em; color: #2ecc71;"><strong>Target Wealth:</strong> <span>$${Math.round(targetVal).toLocaleString()}</span></div>
        `;
    }

    tooltipEl.innerHTML = htmlContent;
}

const ctx = document.getElementById('mainChart').getContext('2d');
const mainChart = new Chart(ctx, {
    type: 'line',
    plugins: [crossoverPlugin],
    data: {
        datasets: [
            {
                label: 'Cumulative Contributions', // Index 0
                data: [],
                borderColor: '#cbd5e0',
                borderWidth: 2,
                pointRadius: 0,
                fill: 'origin',
                backgroundColor: 'rgba(160, 174, 192, 0.25)', 
                tension: 0.4
            },
            {
                label: '5th Percentile', // Index 1
                data: [],
                borderColor: 'transparent',
                borderWidth: 0,
                pointRadius: 0,
                fill: false,
                tension: 0.4
            },
            {
                label: '95th Percentile', // Index 2
                data: [],
                borderColor: 'transparent',
                borderWidth: 0,
                pointRadius: 0,
                fill: 1, 
                backgroundColor: 'rgba(68, 114, 196, 0.1)', 
                tension: 0.4
            },
            {
                label: 'Compound Growth', // Index 3
                data: [],
                borderColor: '#4472c4',
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
                fill: 0, 
                backgroundColor: 'rgba(68, 114, 196, 0.25)', 
                tension: 0.4 
            }, 
            {
                label: 'Target Wealth', // Index 4
                data: [],
                borderColor: '#2ecc71',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            },
            {
                label: 'Current Position', // Index 5
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
        
        // 1. CHANGE INTERACTION MODE to 'nearest' along the X-axis
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        
        scales: {
            x: { type: 'linear', position: 'bottom', min: 0, max: 40, title: { display: true, text: 'Years', font: { weight: 'bold' } } },
            y: { 
                beginAtZero: true, 
                ticks: { 
                    callback: function(v) {
                        if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
                        if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
                        return '$' + v;
                    }
                } 
            }
        },
        plugins: { 
            legend: { 
                display: true, 
                position: 'top', 
                labels: { filter: item => !['Current Position', '5th Percentile', '95th Percentile'].includes(item.text) } 
            },
            crossoverLine: { xVal: null },
            tooltip: {
                enabled: false, 
                // 2. REMOVE the filter function completely. 
                // We WANT the orange dot to be recognized so we can pull its exact decimal X-value.
                external: function(context) {
                    const tooltipModel = context.tooltip;
                    if (tooltipModel.opacity === 0) return; 

                    if (tooltipModel.body) {
                        const activePoint = tooltipModel.dataPoints[0];
                        if (activePoint) {
                            lastHoveredYear = activePoint.parsed.x;
                            renderExternalTooltip(context.chart, lastHoveredYear);
                        }
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
    { slider: document.getElementById('targetSlider'), input: document.getElementById('targetInput') },
    { slider: document.getElementById('volSlider'), input: document.getElementById('volInput') }
];

function updateApp() {
    const t = parseFloat(document.getElementById('yearInput').value) || 0;
    const nominalRate = parseFloat(document.getElementById('rateInput').value) / 100 || 0;
    const inflation = parseFloat(document.getElementById('infInput').value) / 100 || 0;
    const principal = parseFloat(document.getElementById('principalInput').value) || 0;
    const deposit = parseFloat(document.getElementById('depositInput').value) || 0;
    const target = parseFloat(document.getElementById('targetInput').value) || 0;
    const volatility = parseFloat(document.getElementById('volInput').value) / 100 || 0;

    const results = calculateKinematics(t, nominalRate, inflation, principal, deposit, target, volatility);

    document.getElementById('balDisp').innerText = "$" + Math.round(results.current.balance).toLocaleString();
    document.getElementById('velDisp').innerText = "$" + Math.round(results.current.velocity).toLocaleString() + "/yr";
    document.getElementById('accDisp').innerText = "$" + Math.round(results.current.acceleration).toLocaleString() + "/yr²";
    
    const targetEl = document.getElementById('targetDisp');
    if (results.yearsToTarget !== null) {
        targetEl.innerText = results.yearsToTarget.toFixed(1) + " yrs";
        targetEl.style.color = "#2ecc71";
    } else {
        targetEl.innerText = "Unreachable";
        targetEl.style.color = "#e74c3c";
    }

    if (target < 1000000 && target > 0) {
        mainChart.options.scales.y.max = Math.max(target * 2.5, results.current.balance * 1.2, 50000);
    } else {
        mainChart.options.scales.y.max = undefined;
    }

    mainChart.options.plugins.crossoverLine.xVal = results.crossoverYear;
    mainChart.data.datasets[0].data = results.contributionsPath;
    mainChart.data.datasets[1].data = results.path5;
    mainChart.data.datasets[2].data = results.path95;
    mainChart.data.datasets[3].data = results.path;
    mainChart.data.datasets[4].data = results.targetLine;
    mainChart.data.datasets[5].data = [{ x: t, y: results.current.balance }];
    mainChart.update();

    // FIXES STALE SLIDER BOX BUG: Repaints panel template dynamically if a user alters underlying mathematical assumptions
    if (lastHoveredYear !== null) {
        renderExternalTooltip(mainChart, lastHoveredYear);
    }
}

controlPairs.forEach(pair => {
    pair.slider.addEventListener('input', (e) => {
        pair.input.value = e.target.value;
        updateApp();
    });
    
    pair.input.addEventListener('input', (e) => {
        pair.slider.value = parseFloat(e.target.value) || 0;
        updateApp();
    });
});

updateApp();

function calculateKinematics(t, nominalRate, principal, monthlyDeposit) {
    const r = nominalRate > 0 ? nominalRate : 0.0001; 
    
    const P = principal;
    const PMT = monthlyDeposit * 12; 
    const C = P + (PMT / r);
    const lnA = Math.log(1 + r);

    const balance = C * Math.pow(1 + r, t) - (PMT / r);
    const velocity = C * lnA * Math.pow(1 + r, t);

    const path = [];
    for (let i = 0; i <= 40; i += 1) {
        const val = C * Math.pow(1 + r, i) - (PMT / r);
        path.push({ x: i, y: val });
    }

    return {
        current: { balance, velocity },
        path,
        realRate: r
    };
}

const ctx = document.getElementById('mainChart').getContext('2d');
const mainChart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Projected Wealth',
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
                        const t = context.parsed.x;
                        const nom = parseFloat(document.getElementById('rateInput').value) / 100 || 0;
                        const P = parseFloat(document.getElementById('principalInput').value) || 0;
                        const PMT = (parseFloat(document.getElementById('depositInput').value) || 0) * 12;
                        
                        const r = nom > 0 ? nom : 0.0001;
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
    { slider: document.getElementById('principalSlider'), input: document.getElementById('principalInput') },
    { slider: document.getElementById('depositSlider'), input: document.getElementById('depositInput') }
];

function updateApp() {
    const t = parseFloat(document.getElementById('yearInput').value) || 0;
    const nominalRate = parseFloat(document.getElementById('rateInput').value) / 100 || 0;
    const principal = parseFloat(document.getElementById('principalInput').value) || 0;
    const deposit = parseFloat(document.getElementById('depositInput').value) || 0;

    const results = calculateKinematics(t, nominalRate, principal, deposit);

    document.getElementById('balDisp').innerText = "$" + Math.round(results.current.balance).toLocaleString();
    document.getElementById('velDisp').innerText = "$" + Math.round(results.current.velocity).toLocaleString() + "/yr";
    
    mainChart.data.datasets[0].data = results.path;
    mainChart.data.datasets[1].data = [{ x: t, y: results.current.balance }];
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

// ==========================================
// PREMIUM HOOK LOGIC
// ==========================================
const modal = document.getElementById('premiumModal');
const closeBtn = document.querySelector('.close-btn');
const premiumElements = document.querySelectorAll('.premium-locked');

// Open modal on click of any locked element
premiumElements.forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault(); 
        modal.style.display = 'flex';
    });
});

// Close modal when X is clicked
closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

// Close modal if user clicks outside the box
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

const stats = ["pts", "reb", "ast", "stl", "blk", "three", "foul"];
let teams = { home: [], away: [] };
let saveTimeout = null;
let teamRosters = {};

const colorMap = {
    'yellow': '#ffc107',
    'green': '#28a745',
    'purple': '#6f42c1',
    'orange': '#fd7e14',
    'red': '#dc3545',
    'blue': '#0d6efd',
    'pink': '#d63384',
    'teal': '#20c997',
    'indigo': '#6610f2',
    'cyan': '#0dcaf0'
};

function updateTeamColor(team) {
    const teamName = document.getElementById(`${team}-name`).value.toLowerCase().trim();
    const header = document.getElementById(`${team}-header`);
    const color = colorMap[teamName] || '#6c757d';
    header.style.backgroundColor = color;
    debounceSave();
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function createRow(team, i, jersey, name) {
    const tbody = document.querySelector(`#${team}-stats tbody`);
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="checkbox" class="starter" onchange="debounceSave()"></td>
        <td><input class="jersey" value="${sanitizeHTML(jersey)}" onchange="debounceSave()"></td>
        <td><input class="player" value="${sanitizeHTML(name)}" onchange="debounceSave()"></td>
        ${stats.map(s => `
            <td>
                <div class="stat">
                    <button data-team="${team}" data-row="${i}" data-stat="${s}" data-val="-1" class="stat-btn">-</button>
                    <span id="${team}_${s}_${i}">0</span>
                    <button data-team="${team}" data-row="${i}" data-stat="${s}" data-val="1" class="stat-btn">+</button>
                </div>
            </td>`).join("")}
    `;
    tbody.appendChild(tr);
}

function change(team, row, stat, val) {
    const el = document.getElementById(`${team}_${stat}_${row}`);
    let num = parseInt(el.innerText) || 0;
    num = Math.max(0, Math.min(999, num + val));
    el.innerText = num;
    updateScore(team);
    debounceSave();
}

function updateScore(team) {
    const tbody = document.querySelector(`#${team}-stats tbody`);
    const rows = tbody.querySelectorAll('tr');
    let total = 0;
    rows.forEach((row, i) => {
        const pts = document.getElementById(`${team}_pts_${i}`);
        if (pts) total += parseInt(pts.innerText) || 0;
    });
    document.getElementById(`${team}-score`).innerText = total;
}

function debounceSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 300);
}

function saveData() {
    try {
        const data = { 
            home: { name: document.getElementById('home-name').value, players: [] }, 
            away: { name: document.getElementById('away-name').value, players: [] } 
        };
        ['home', 'away'].forEach(team => {
            const tbody = document.querySelector(`#${team}-stats tbody`);
            const rows = tbody.querySelectorAll('tr');
            rows.forEach((row, i) => {
                const player = { 
                    jersey: row.querySelector('.jersey').value, 
                    name: row.querySelector('.player').value,
                    starter: row.querySelector('.starter').checked
                };
                stats.forEach(s => {
                    const el = document.getElementById(`${team}_${s}_${i}`);
                    player[s] = el ? el.innerText : '0';
                });
                data[team].players.push(player);
            });
            updateScore(team);
        });
        localStorage.setItem("basket_stats", JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save data:', e);
        alert('Failed to save data. Storage might be full.');
    }
}

function loadData() {
    try {
        const data = JSON.parse(localStorage.getItem("basket_stats"));
        if (!data) return;
        if (data.home?.name) {
            document.getElementById('home-name').value = data.home.name;
            updateTeamColor('home');
        }
        if (data.away?.name) {
            document.getElementById('away-name').value = data.away.name;
            updateTeamColor('away');
        }
        ['home', 'away'].forEach(team => {
            if (data[team]?.players) {
                data[team].players.forEach((p, i) => {
                    if (document.getElementById(`${team}_pts_${i}`)) {
                        document.querySelector(`#${team}-stats tbody tr:nth-child(${i + 1}) .jersey`).value = p.jersey;
                        document.querySelector(`#${team}-stats tbody tr:nth-child(${i + 1}) .player`).value = p.name;
                        document.querySelector(`#${team}-stats tbody tr:nth-child(${i + 1}) .starter`).checked = p.starter || false;
                        stats.forEach(s => {
                            const el = document.getElementById(`${team}_${s}_${i}`);
                            if (el) el.innerText = p[s] || 0;
                        });
                    }
                });
                updateScore(team);
            }
        });
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

function loadTeam(team) {
    const select = document.getElementById(`${team}-select`);
    const teamName = select.value;
    if (!teamName) return;
    
    const tbody = document.querySelector(`#${team}-stats tbody`);
    if (tbody.querySelectorAll('tr').length > 0) {
        if (!confirm('Changing teams will clear all current stats. Continue?')) {
            select.value = '';
            return;
        }
    }
    
    document.getElementById(`${team}-name`).value = teamName.toUpperCase();
    updateTeamColor(team);
    
    tbody.innerHTML = '';
    
    const roster = teamRosters[teamName.toLowerCase()] || [];
    roster.forEach((player, i) => {
        createRow(team, i, player[0], player[1]);
    });
    
    debounceSave();
}

async function loadTeamRosters() {
    try {
        const response = await fetch('Teams/');
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = Array.from(doc.querySelectorAll('a')).filter(a => a.href.endsWith('.csv'));
        
        for (const link of links) {
            const fileName = link.href.split('/').pop();
            const teamName = fileName.replace('.csv', '').toLowerCase();
            try {
                const res = await fetch(`Teams/${fileName}`);
                const csvText = await res.text();
                const lines = csvText.split('\n').filter(l => l.trim());
                teamRosters[teamName] = lines.slice(1).map(line => {
                    const [jersey, name] = line.split(',').map(s => s.trim());
                    return [jersey, name];
                }).filter(p => p[0] && p[1]);
            } catch (e) {
                console.error(`Failed to load ${teamName} roster:`, e);
            }
        }
    } catch (e) {
        const teamFiles = ['yellow', 'green', 'purple', 'orange'];
        for (const teamName of teamFiles) {
            try {
                const response = await fetch(`Teams/${teamName.charAt(0).toUpperCase() + teamName.slice(1)}.csv`);
                const text = await response.text();
                const lines = text.split('\n').filter(l => l.trim());
                teamRosters[teamName] = lines.slice(1).map(line => {
                    const [jersey, name] = line.split(',').map(s => s.trim());
                    return [jersey, name];
                }).filter(p => p[0] && p[1]);
            } catch (e) {
                console.error(`Failed to load ${teamName} roster:`, e);
            }
        }
    }
}

function uploadCSV(team) {
    const file = document.getElementById(`${team}-upload`).files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
        alert('Please upload a CSV file');
        return;
    }
    
    const teamName = file.name.replace('.csv', '').replace(/[_-]/g, ' ');
    document.getElementById(`${team}-name`).value = teamName;
    updateTeamColor(team);
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            const tbody = document.querySelector(`#${team}-stats tbody`);
            tbody.innerHTML = '';
            lines.slice(1).forEach((line, i) => {
                const [jersey, name] = line.split(',').map(s => s.trim());
                if (jersey && name) createRow(team, i, jersey, name);
            });
            debounceSave();
        } catch (e) {
            console.error('Failed to parse CSV:', e);
            alert('Failed to parse CSV file');
        }
    };
    reader.onerror = () => alert('Failed to read file');
    reader.readAsText(file);
}

function exportCSV() {
    const homeName = document.getElementById('home-name').value.replace(/\s+/g, '_');
    const awayName = document.getElementById('away-name').value.replace(/\s+/g, '_');
    const today = new Date().toISOString().split('T')[0];
    let csv = '';
    ['home', 'away'].forEach(team => {
        const teamName = document.getElementById(`${team}-name`).value;
        csv += `${teamName}\n`;
        csv += 'Player Name,Jersey Number,Points,Rebounds,Assists,Steals,Blocks,3 Pointers,Fouls\n';
        const tbody = document.querySelector(`#${team}-stats tbody`);
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, i) => {
            const name = row.querySelector('.player').value;
            const jersey = row.querySelector('.jersey').value;
            const pts = document.getElementById(`${team}_pts_${i}`)?.innerText || '0';
            const reb = document.getElementById(`${team}_reb_${i}`)?.innerText || '0';
            const ast = document.getElementById(`${team}_ast_${i}`)?.innerText || '0';
            const stl = document.getElementById(`${team}_stl_${i}`)?.innerText || '0';
            const blk = document.getElementById(`${team}_blk_${i}`)?.innerText || '0';
            const three = document.getElementById(`${team}_three_${i}`)?.innerText || '0';
            const foul = document.getElementById(`${team}_foul_${i}`)?.innerText || '0';
            csv += `${name},${jersey},${pts === '0' ? '' : pts},${reb === '0' ? '' : reb},${ast === '0' ? '' : ast},${stl === '0' ? '' : stl},${blk === '0' ? '' : blk},${three === '0' ? '' : three},${foul === '0' ? '' : foul}\n`;
        });
        csv += '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${homeName}_vs_${awayName}_${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadTeamRosters();
    
    Object.keys(teamRosters).forEach(team => {
        const option1 = document.createElement('option');
        option1.value = team;
        option1.textContent = team.charAt(0).toUpperCase() + team.slice(1);
        document.getElementById('home-select').appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = team;
        option2.textContent = team.charAt(0).toUpperCase() + team.slice(1);
        document.getElementById('away-select').appendChild(option2);
    });
    
    loadData();
    updateTeamColor('home');
    updateTeamColor('away');
    
    window.addEventListener('beforeunload', (e) => {
        const homeRows = document.querySelector('#home-stats tbody').querySelectorAll('tr');
        const awayRows = document.querySelector('#away-stats tbody').querySelectorAll('tr');
        if (homeRows.length > 0 || awayRows.length > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('stat-btn')) {
            const { team, row, stat, val } = e.target.dataset;
            change(team, parseInt(row), stat, parseInt(val));
        }
    });
});

window.loadTeam = loadTeam;
window.uploadCSV = uploadCSV;
window.exportCSV = exportCSV;
window.saveData = saveData;
window.updateTeamColor = updateTeamColor;

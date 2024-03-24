async function fetchData(playerId, numberOfMatch) {
  const response = await fetch(`https://api.opendota.com/api/players/${playerId}/matches?limit=${numberOfMatch}&lobby_type=7`);
  return await response.json();
}

async function createGraph() {
  const playerId = document.getElementById('playerId').value;
  const initialMmr = parseInt(document.getElementById('currentMmr').value);
  const numberOfMatch = parseInt(document.getElementById('numberOfMatch').value);
  const data = await fetchData(playerId, numberOfMatch);
  let mmr = initialMmr;
  const mmrData = [];
  const labels = Array.from({length: numberOfMatch}, (_, i) => i + 1);

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      mmrData.push(mmr)
    } else {
      const playerSlot = data[i - 1].player_slot;
      const isRadiant = playerSlot < 128;
      const wonMatch = (isRadiant && data[i - 1].radiant_win) || (!isRadiant && !data[i - 1].radiant_win);
      if (wonMatch) {
        mmr -= 25;
      } else {
        mmr += 25;
      }
      mmrData.unshift(mmr);
    }
  }

  const ctx = document.getElementById('dotaGraph').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'MMR: ',
        data: mmrData,
        borderColor: 'rgb(75, 192, 192)',
        fill: false,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: false,
      scales: {
        x: {
          title: {
            display: false
          }
        },
        y: {
          title: {
            display: true,
            text: 'MMR'
          }
        }
      }
    }
  });
}

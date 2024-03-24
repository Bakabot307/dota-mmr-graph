async function fetchData(playerId, numberOfMatch) {
  const response = await fetch(
      `https://api.opendota.com/api/players/${playerId}/matches?limit=${numberOfMatch}&lobby_type=7`);
  return await response.json();
}

let myChart;

async function createGraph() {
  const canvas = document.getElementById('dotaGraph');
  const ctx = canvas.getContext('2d');

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (myChart) {
    myChart.destroy(); // Destroy the previous chart if it exists
  }

  const playerId = document.getElementById('playerId').value;
  const initialMmr = parseInt(document.getElementById('currentMmr').value);
  const numberOfMatch = parseInt(
      document.getElementById('numberOfMatch').value);
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
      const wonMatch = (isRadiant && data[i - 1].radiant_win) || (!isRadiant
          && !data[i - 1].radiant_win);
      if (wonMatch) {
        mmr -= 25;
      } else {
        mmr += 25;
      }
      mmrData.unshift(mmr);
    }
  }

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'MMR: ',
        data: mmrData,
        borderColor: 'rgb(75, 192, 192)',
        fill: false,
        pointRadius: numberOfMatch < 101 ? 5 : 0,
      }]
    },
    options: {
      responsive: false,
      scales: {
        x: {
          title: {
            display: false,
            title:'Number of game'
          },
          ticks: {
            maxTicksLimit: 12
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



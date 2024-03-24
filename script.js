async function fetchData(playerId, numberOfMatch) {
  try {
    const response = await fetch(
        `https://api.opendota.com/api/players/${playerId}/matches?limit=${numberOfMatch}&lobby_type=7`);
    if (!response.ok) {
      throw new Error('Failed to fetch data! try again later');
    }
    const data = await response.json();
    if (data.length === 0) {
      throw new Error('Player ID does not exist');
    }
    document.getElementById('errors').textContent = "";
    return data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    document.getElementById('errors').textContent = error.message;
    return null;
  }
}
let myChart;

async function createGraph() {
  const playerId = parseInt(document.getElementById('playerId').value);
  const currentMmr = parseInt(document.getElementById('currentMmr').value);
  const numberOfMatch = parseInt(document.getElementById('numberOfMatch').value);

  console.log(playerId,currentMmr,numberOfMatch)
  if (isNaN(playerId) || playerId <= 0) {
    document.getElementById('errors').textContent = 'Id > 0';
    return;
  }

  if (isNaN(currentMmr) || currentMmr <= 0) {
    document.getElementById('errors').textContent = 'Mmr > 0';
    return;
  }

  if (isNaN(numberOfMatch) || numberOfMatch <= 1) {
    document.getElementById('errors').textContent = 'Number of match > 1';
    return;
  }


  const canvas = document.getElementById('dotaGraph');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (myChart) {
    myChart.destroy(); // Destroy the previous chart if it exists
  }

  const data = await fetchData(playerId, numberOfMatch, currentMmr);
  let mmr = currentMmr;
  const mmrData = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      mmrData.push(mmr);
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

  let lowestMMRIndex = mmrData.length - 1 - mmrData.slice().reverse().indexOf(
      Math.min(...mmrData));
  let highestMMRIndex = mmrData.length - 1 - mmrData.slice().reverse().indexOf(
      Math.max(...mmrData));

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({length: numberOfMatch}, (_, i) => i + 1),
      datasets: [{
        label: 'MMR',
        data: mmrData,
        borderColor: 'rgb(75, 192, 192)',
        fill: false,
        pointRadius: numberOfMatch < 101 ? 5 : 0,
        datalabels: {
          align: function (context) {
            if (context.dataIndex === lowestMMRIndex) {
              return 'bottom';
            } else if (context.dataIndex === highestMMRIndex) {
              return 'top';
            } else {
              return null;
            }
          },
          display: function (context) {
            return context.dataIndex === lowestMMRIndex || context.dataIndex
            === highestMMRIndex ? context.dataIndex : '';
          }
        }
      }]
    },
    plugins: [ChartDataLabels],
    options: {
      layout: {
        padding: {
          right: 25,

        }
      },
      responsive: false,
      scales: {
        x: {
          title: {
            display: true,
            text: `MMR PROGRESSION OVER ${numberOfMatch} MATCHES`
          },
          ticks: {
            maxTicksLimit: 12
          }
        },
        y: {
          title: {
            display: true,
            text: 'MMR'
          },
          min: Math.min(...mmrData) - 25,
          max: Math.max(...mmrData) + 25,
        }
      }
    }
  });
  document.getElementById('screenshotBtn').style.display = 'block';
}

async function takeScreenshot() {
  const canvas = document.getElementById('dotaGraph');

  //Save the graph as an image
  const graphImage = await saveGraphAsImage();

  //Create a new canvas with a white background
  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  const newCtx = newCanvas.getContext('2d');

  //Draw the saved graph onto the new canvas with white background
  newCtx.fillStyle = 'white';
  newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
  newCtx.drawImage(graphImage, 0, 0);

  const dataUrl = newCanvas.toDataURL('image/png');

  try {
    const blob = await fetch(dataUrl).then(res => res.blob());
    const item = new ClipboardItem({'image/png': blob});
    await navigator.clipboard.write([item]);
    document.getElementById('messages').style.display = 'block';
    setTimeout(() => {
      document.getElementById('messages').style.display = 'none';
    }, 3000); // Hide after 3 seconds
  } catch (error) {
    console.error('Failed to save screenshot to clipboard:', error);
  }
}

async function saveGraphAsImage() {
  const graphCanvas = document.getElementById('dotaGraph');
  const graphDataUrl = graphCanvas.toDataURL('image/png');
  const graphImage = new Image();
  graphImage.src = graphDataUrl;
  return new Promise((resolve, reject) => {
    graphImage.onload = () => resolve(graphImage);
    graphImage.onerror = (error) => reject(error);
  });
}

document.getElementById('screenshotBtn').addEventListener('click',
    takeScreenshot);





let numberOfId = 1;

async function fetchData(playerIds, numberOfMatch) {
  try {
    const allData = [];
    for (const playerId of playerIds) {
      const response = await fetch(
          `https://api.opendota.com/api/players/${playerId}/matches?limit=${numberOfMatch}&lobby_type=7`);
      if (!response.ok) {
        throw new Error(
            `Failed to fetch data for player ${playerId}! Try again later`);
      }
      const data = await response.json();
      if (data.length === 0) {
        throw new Error(`ID ${playerId} does not exist or is private`);
      }
      allData.push({playerId, data});
    }
    document.getElementById('errors').textContent = "";
    localStorage.setItem("playerIds", JSON.stringify(playerIds));
    return allData;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    document.getElementById('errors').textContent = error.message;
    return null;
  }
}

let myChart;

async function createGraph() {
  const playerIds = [];

  const currentMmr = parseInt(document.getElementById('currentMmr').value);

  const numberOfMatch = parseInt(
      document.getElementById('numberOfMatch').value);
  for (let i = 1; i <= numberOfId; i++) { // Assuming there are four player inputs
    const playerId = parseInt(document.getElementById(`playerId${i}`).value);
    if (!isNaN(playerId) && playerId > 0) {
      playerIds.push(playerId);
    } else {
      document.getElementById('errors').textContent = `Player ${i} ID?`;
      return;
    }
  }
  if (isNaN(currentMmr) && numberOfId === 1 || currentMmr <= 0 && numberOfId
      === 1) {
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

  const datas = await fetchData(playerIds, numberOfMatch, currentMmr);
  if (myChart) {
    myChart.destroy(); // Destroy the previous chart if it exists
  }
  if (numberOfId <= 1) {
    const data = datas[0].data;
    let mmr = currentMmr;
    const mmrData = [];
    const matchIdData = [];

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        mmrData.push(mmr);
        matchIdData.push(data[0].match_id)
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
        matchIdData.unshift(data[i].match_id)
        mmrData.unshift(mmr);
      }
    }

    let lowestMMRIndex = mmrData.length - 1 - mmrData.slice().reverse().indexOf(
        Math.min(...mmrData));
    let highestMMRIndex = mmrData.length - 1
        - mmrData.slice().reverse().indexOf(
            Math.max(...mmrData));

    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: matchIdData,
        datasets: [{
          label: 'MMR',
          data: mmrData,
          borderColor: 'rgb(75, 192, 192)',
          fill: false,
          pointRadius: numberOfMatch < 251 ? 4 : 0,
          datalabels: {
            align: function (context) {
              if (context.dataIndex === lowestMMRIndex) {
                return 'bottom';
              } else if (context.dataIndex === highestMMRIndex) {
                return 'top';
              } else if (context.dataIndex === 0) {
                return 'left';
              } else {
                return null;
              }
            },
            display: function (context) {

              return context.dataIndex === lowestMMRIndex || context.dataIndex
              === highestMMRIndex || context.dataIndex === numberOfMatch - 1 ?
                  context.dataIndex : '';
            }
          }
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        layout: {
          padding: {
            right: 50,

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
              maxTicksLimit: 12,
              callback: function (value, index, values) {
                return index + 1;
              }
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
        },
        animation: {
          onComplete: function () {
            const dotabuffLink = `https://www.dotabuff.com/players/${playerIds[0]}`;
            const dotabuffIcon = document.getElementById('profileBtn');
            dotabuffIcon.href = dotabuffLink;
            document.getElementById('showAfterCreated').style.display = 'block';
          }
        }
      }
    });
  } else {
    function getRandomColor() {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      return `rgb(${r}, ${g}, ${b})`;
    }
    let datasetsArray = [];
    let  max = 0, min = 0;
    for (let i = 0; i < numberOfId; i++) {
      const data = datas[i].data.reverse();
      const mmrData = [];
      mmrData.push(0)
      let mmr = 0;
      for (let j = 1; j < data.length; j++) {
        const playerSlot = data[j].player_slot;
        const isRadiant = playerSlot < 128;
        const wonMatch = (isRadiant && data[j].radiant_win) || (!isRadiant && !data[j].radiant_win);
        if (wonMatch) {
          mmr += 1;
        } else {
          mmr -= 1;
        }
        mmrData.push(mmr);
      }
      const minIndex = mmrData.indexOf(Math.min(...mmrData.slice(1)));
      const maxIndex = mmrData.indexOf(Math.max(...mmrData.slice(1)));
      const subMin =Math.min(...mmrData);
      const subMax =Math.max(...mmrData);
      console.log(subMax)
      console.log(subMin)
      if(subMin < min) {
        min = subMin
      }
      if(subMax > max) {
        max = subMax
      }
      console.log(mmrData)
      datasetsArray.push({
        label: `${datas[i].playerId}`,
        data: mmrData,
        borderColor: getRandomColor(),
        fill: false,
        pointRadius: numberOfMatch < 251 ? 2 : 0,
        datalabels: {
          align: function (context) {
            console.log(context)
            if (context.dataIndex === minIndex) {
              return 'bottom';
            } else if (context.dataIndex === maxIndex) {
              return 'top';
            } else if (context.dataIndex === numberOfMatch-1) {
              return 'right';
            } else {
              return null;
            }
          },
          display: function (context) {
            return context.dataIndex === minIndex || context.dataIndex
            === maxIndex || context.dataIndex === numberOfMatch - 1 ?
                context.dataIndex : '';
          }
        }
      });
    }
    console.log(max,min)
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({length: numberOfMatch}, (_, index) => index + 1),
        datasets: datasetsArray,
      },
      plugins: [ChartDataLabels],
      options: {
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        layout: {
          padding: {
            right: 50,
          }
        },
        responsive: false,
        scales: {
          x: {
            title: {
              display: true,
              text: `COMPARE BETWEEN ${playerIds.length} PLAYERS OVER THE LAST ${numberOfMatch} MATCHES`
            },
            ticks: {
              maxTicksLimit: 12,
              callback: function (value, index, values) {
                return index + 1;
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'GAME RECORDS'
            },
            min:min-1,
            max:max+1
          }
        },
        animation: {
          onComplete: function () {
            const container = document.getElementById('profileBtnContainer');
            container.innerHTML = '';
            for (let i = 0; i < playerIds.length; i++) {
              const dotabuffIcon = document.createElement('a');
              dotabuffIcon.href = `https://www.dotabuff.com/players/${playerIds[i]}`;
              dotabuffIcon.target = "_blank";

              const img = document.createElement('img');
              img.src = "https://pbs.twimg.com/profile_images/879332626414358528/eHLyVWo-_400x400.jpg";
              img.alt = "Dotabuff Icon";
              img.classList.add("dotabuff-icon");

              dotabuffIcon.appendChild(img);
              container.appendChild(dotabuffIcon);
            }

            document.getElementById('showAfterCreated').style.display = 'block';
          }
        }
      }
    });
  }

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

function clickHandler(evt) {
  if(numberOfId===1){
    const points = myChart.getElementsAtEventForMode(evt, 'nearest',
        {intersect: true}, true);
    if (points.length) {
      const firstPoint = points[0];
      const label = myChart.data.labels[firstPoint.index];
      const dotabuffUrl = `https://www.dotabuff.com/matches/${label}`;
      window.open(dotabuffUrl, '_blank')
    }
  }
}

function setLatestPlayerId() {
  const playerId = localStorage.getItem('playerId');
  if (playerId) {
    document.getElementById('playerId1').value = playerId;
  }
}

function togglePlayerInputs() {
  const playerSelection = document.getElementById('playerSelection');
  const playerId2Input = document.getElementById('playerId2');
  const currentMmr = document.getElementById('currentMmr')
  const currentMmrText = document.getElementById('currentMmrText')
  if (playerSelection.value === '1') {
    numberOfId = 1;
    playerId2Input.style.display = 'none';
    currentMmr.style.display = 'block'
    currentMmrText.style.display = 'block'
  } else if (playerSelection.value === '2') {
    numberOfId = 2;
    playerId2Input.style.display = 'block';
    currentMmr.style.display = 'none'
    currentMmrText.style.display = 'none'
  }
}

document.getElementById('screenshotBtn').addEventListener('click',
    takeScreenshot);
document.getElementById('dotaGraph').addEventListener('click', clickHandler);
window.addEventListener('load', setLatestPlayerId);






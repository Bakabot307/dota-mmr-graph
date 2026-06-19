let numberOfId = 1;
let selfCompare = false;

// Global cache for rendering high-res screenshot without refetching
let lastFetchedDatas = null;
let lastPlayerIds = null;
let lastCurrentMmr = 0;
let lastNumberOfMatch = 0;

const el = (id) => document.getElementById(id);

const getGameTypeParam = () => {
  if (numberOfId > 1) {
    return el('gameType').value === '7' ? 'lobby_type=7' : '';
  }
  return 'lobby_type=7';
};

// Curated Dota 2 inspired line colors
const themeColors = [
  '#e22b37', // Crimson Red
  '#f08b18', // Ember Gold
  '#3498db', // Dragon Blue
  '#3bca5c', // Radiant Green
  '#9b59b6', // Abyssal Violet
  '#1abc9c', // Storm Cyan
  '#e67e22', // Orange
  '#f1c40f'  // Gold
];

const getThemeColor = (index) => themeColors[index % themeColors.length];

async function fetchData(playerIdsF, numberOfMatch) {
  let userNumberOfMatch = selfCompare ? numberOfMatch * numberOfId : numberOfMatch;
  const gameType = getGameTypeParam();
  try {
    const allData = [];
    for (const playerId of playerIdsF) {
      const url = `https://api.opendota.com/api/players/${playerId}/matches?limit=${userNumberOfMatch}${gameType ? `&${gameType}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
            `Failed to fetch data for player ${playerId}! Try again later!`);
      }
      const data = await response.json();
      if (data.length === 0) {
        throw new Error(
            `ID ${playerId} does not exist or has no public match data!`);
      } else {
        numberOfMatch = data.length;
        if (selfCompare) {
          numberOfMatch = Math.floor(data.length / numberOfId);
        }
      }
      if (selfCompare) {
        const chunkSize = numberOfMatch;
        for (let i = 0; i < numberOfId; i++) {
          const startIndex = i * chunkSize;
          const endIndex = Math.min(startIndex + chunkSize, data.length);
          const chunkData = data.slice(startIndex, endIndex);
          const timeStart = chunkData[0].start_time;
          const timeEnd = chunkData[chunkSize - 1].start_time;
          allData.push(
              {playerId: convertTime(timeStart, timeEnd), data: chunkData});
        }
      } else {
        if (allData.length === 0) {
          allData.push({playerId, data});
        } else if (allData[0] < data.length) {
          allData.push({playerId, data});
        } else {
          allData.unshift({playerId, data});
        }
      }
    }
    if (!selfCompare && numberOfId > 1) {
      for (let i = 1; i < allData.length; i++) {
        if (allData[i].data.length > allData[0].data.length) {
          allData[i].data = allData[i].data.slice(0, allData[0].data.length);
        }
      }
    }

    el('errors').textContent = "";
    localStorage.setItem("playerIds", JSON.stringify(playerIdsF));
    return allData;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    el('errors').textContent = error.message;
    return null;
  }
}

function convertTime(timeStart, timeEnd) {
  const startDate = new Date(timeStart * 1000);
  const endDate = new Date(timeEnd * 1000);
  const timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
  const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const startDateFormatted = formatDate(startDate);
  const endDateFormatted = formatDate(endDate);
  return `${startDateFormatted} - ${endDateFormatted} (${dayDiff} days)`;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(2);
  return `${day}/${month}/${year}`;
}

let myChart;

// Dynamic configuration generator supporting screen preview and high-res screenshot styles
function buildChartConfig(datas, currentMmr, numberOfMatch, isHighRes = false) {
  const scale = isHighRes ? 2.5 : 1;
  const fontTitleSize = Math.round(12 * scale);
  const fontTickSize = Math.round(11 * scale);
  const fontLabelSize = Math.round(11 * scale);
  const lineWidth = isHighRes ? 6 : 3;
  const pointRadius = numberOfMatch < 251 ? (isHighRes ? 8 : 4) : 0;
  const pointHoverRadius = isHighRes ? 12 : 6;
  const datalabelPadding = isHighRes ? 8 : 4;

  if (numberOfId <= 1 && !selfCompare) {
    const data = datas[0].data;
    let mmr = currentMmr;
    const mmrData = [];
    const matchIdData = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        mmrData.push(mmr);
        matchIdData.push(data[0].match_id);
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
        matchIdData.unshift(data[i].match_id);
        mmrData.unshift(mmr);
      }
    }

    let lowestMMRIndex = mmrData.length - 1 - mmrData.slice().reverse().indexOf(
        Math.min(...mmrData));
    let highestMMRIndex = mmrData.length - 1
        - mmrData.slice().reverse().indexOf(Math.max(...mmrData));

    return {
      type: 'line',
      data: {
        labels: matchIdData,
        datasets: [{
          label: `MMR Progression`,
          data: mmrData,
          borderColor: '#e22b37',
          borderWidth: lineWidth,
          fill: true,
          tension: 0.15,
          backgroundColor: (context) => {
            const chart = context.chart;
            const {ctx: chartCtx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = chartCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(226, 43, 55, 0.22)');
            gradient.addColorStop(1, 'rgba(226, 43, 55, 0.0)');
            return gradient;
          },
          pointRadius: pointRadius,
          pointBackgroundColor: '#e22b37',
          pointBorderColor: '#ffffff',
          pointHoverRadius: pointHoverRadius,
          datalabels: {
            color: '#ffffff',
            font: { family: 'Outfit', weight: 'bold', size: fontLabelSize },
            backgroundColor: 'rgba(18, 16, 23, 0.9)',
            borderColor: '#292435',
            borderWidth: isHighRes ? 2 : 1,
            borderRadius: isHighRes ? 6 : 4,
            padding: datalabelPadding,
            align: function (context) {
              if (context.dataIndex === lowestMMRIndex) return 'bottom';
              if (context.dataIndex === highestMMRIndex) return 'top';
              if (context.dataIndex === 0) return 'left';
              return null;
            },
            display: function (context) {
              return context.dataIndex === lowestMMRIndex || context.dataIndex === highestMMRIndex || context.dataIndex === numberOfMatch - 1
                  ? context.dataIndex : '';
            }
          }
        }]
      },
      plugins: [ChartDataLabels],
      options: {
        plugins: {
          title: {
            display: isHighRes,
            text: 'DOTA 2 MMR PROGRESSION REPORT',
            color: '#ffffff',
            font: { family: 'Outfit', size: 28, weight: '800' },
            padding: { bottom: 25, top: 15 }
          },
          legend: {
            labels: {
              color: '#8b8994',
              font: { family: 'Outfit', size: isHighRes ? 16 : 13, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: '#121017',
            titleColor: '#fff',
            bodyColor: '#f5f6f8',
            borderColor: '#292435',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
            usePointStyle: true,
            titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 13 }
          }
        },
        layout: {
          padding: isHighRes ? 60 : { right: 50, left: 10, top: 10, bottom: 10 }
        },
        responsive: !isHighRes,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            title: {
              display: true,
              text: `MMR progression over the last ${data.length} matches for Player ${playerIds[0]}`,
              color: '#8b8994',
              font: { family: 'Outfit', size: fontTitleSize, weight: 'bold' }
            },
            ticks: {
              color: '#8b8994',
              font: { family: 'Inter', size: fontTickSize },
              maxTicksLimit: 12,
              callback: function (value, index) {
                return index + 1;
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            title: {
              display: true,
              text: 'MMR',
              color: '#8b8994',
              font: { family: 'Outfit', size: fontTitleSize, weight: 'bold' }
            },
            ticks: {
              color: '#8b8994',
              font: { family: 'Inter', size: fontTickSize }
            },
            min: Math.min(...mmrData) - 25,
            max: Math.max(...mmrData) + 25
          }
        }
      }
    };
  } else {
    // Multiplayer comparisons or self compare periods
    let datasetsArray = [];
    let max = 0, min = 0;
    for (let i = 0; i < numberOfId; i++) {
      const data = datas[i].data.slice().reverse();
      const mmrData = [];
      mmrData.push(0);
      let mmr = 0;
      for (let j = 1; j < data.length; j++) {
        const playerSlot = data[j].player_slot;
        const isRadiant = playerSlot < 128;
        const wonMatch = (isRadiant && data[j].radiant_win) || (!isRadiant
            && !data[j].radiant_win);
        if (wonMatch) {
          mmr += 1;
        } else {
          mmr -= 1;
        }
        mmrData.push(mmr);
      }
      const minIndex = mmrData.indexOf(Math.min(...mmrData.slice(1)));
      const maxIndex = mmrData.indexOf(Math.max(...mmrData.slice(1)));
      const subMin = Math.min(...mmrData);
      const subMax = Math.max(...mmrData);
      if (subMin < min) {
        min = subMin;
      }
      if (subMax > max) {
        max = subMax;
      }
      datasetsArray.push({
        label: `${datas[i].playerId}`,
        data: mmrData,
        borderColor: getThemeColor(i),
        borderWidth: lineWidth - 0.5,
        fill: false,
        tension: 0.15,
        pointRadius: pointRadius,
        pointBackgroundColor: getThemeColor(i),
        pointBorderColor: '#ffffff',
        pointHoverRadius: pointHoverRadius - 1,
        datalabels: {
          color: '#ffffff',
          font: { family: 'Outfit', weight: 'bold', size: fontLabelSize },
          backgroundColor: 'rgba(18, 16, 23, 0.9)',
          borderColor: '#292435',
          borderWidth: isHighRes ? 2 : 1,
          borderRadius: isHighRes ? 6 : 4,
          padding: datalabelPadding,
          align: function (context) {
            if (context.dataIndex === minIndex) return 'bottom';
            if (context.dataIndex === maxIndex) return 'top';
            if (context.dataIndex === numberOfMatch - 1) return 'right';
            return null;
          },
          display: function (context) {
            return context.dataIndex === minIndex || context.dataIndex === maxIndex || context.dataIndex === numberOfMatch - 1
                ? context.dataIndex : '';
          }
        }
      });
    }

    return {
      type: 'line',
      data: {
        labels: Array.from({length: datasetsArray[0].data.length}, (_, index) => index + 1),
        datasets: datasetsArray
      },
      plugins: [ChartDataLabels],
      options: {
        plugins: {
          title: {
            display: isHighRes,
            text: 'DOTA 2 MMR COMPARISON REPORT',
            color: '#ffffff',
            font: { family: 'Outfit', size: 28, weight: '800' },
            padding: { bottom: 25, top: 15 }
          },
          legend: {
            labels: {
              color: '#8b8994',
              font: { family: 'Outfit', size: isHighRes ? 16 : 13, weight: '600' }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#121017',
            titleColor: '#fff',
            bodyColor: '#f5f6f8',
            borderColor: '#292435',
            borderWidth: 1,
            padding: 12,
            boxPadding: 4,
            usePointStyle: true,
            titleFont: { family: 'Outfit', size: 14, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 13 },
            callbacks: {
              title: function () {
                return 'Match Record Score';
              }
            }
          }
        },
        layout: {
          padding: isHighRes ? 60 : { right: 50, left: 10, top: 10, bottom: 10 }
        },
        responsive: !isHighRes,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            title: {
              display: true,
              text: selfCompare
                  ? `Self-comparing score across ${datasetsArray[0].data.length * numberOfId} matches in ${numberOfId} periods`
                  : `Compare between ${playerIds.length} players over the last ${datasetsArray[0].data.length} matches`,
              color: '#8b8994',
              font: { family: 'Outfit', size: fontTitleSize, weight: 'bold' }
            },
            ticks: {
              color: '#8b8994',
              font: { family: 'Inter', size: fontTickSize },
              maxTicksLimit: 12,
              callback: function (value, index) {
                return index + 1;
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)'
            },
            title: {
              display: true,
              text: 'Game Record Score (Net Wins)',
              color: '#8b8994',
              font: { family: 'Outfit', size: fontTitleSize, weight: 'bold' }
            },
            ticks: {
              color: '#8b8994',
              font: { family: 'Inter', size: fontTickSize }
            },
            min: min - 1,
            max: max + 1
          }
        }
      }
    };
  }
}

async function createGraph() {
  const playerIds = [];
  const currentMmr = parseInt(el('currentMmr').value);
  const numberOfMatch = parseInt(el('numberOfMatch').value);
  for (let i = 1; i <= (selfCompare ? 1 : numberOfId); i++) {
    const playerId = parseInt(el(`playerId${i}`).value);
    if (!isNaN(playerId) && playerId > 0) {
      playerIds.push(playerId);
    } else {
      el('errors').textContent = `Player ${i} ID is required!`;
      return;
    }
  }
  if (isNaN(currentMmr) && numberOfId === 1 && !selfCompare || currentMmr <= 0
      && numberOfId === 1 && !selfCompare) {
    el('errors').textContent = 'Starting MMR must be greater than 0';
    return;
  }

  if (isNaN(numberOfMatch) || numberOfMatch <= 1) {
    el('errors').textContent = 'Number of matches must be greater than 1';
    return;
  }

  const canvas = el('dotaGraph');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const datas = await fetchData(playerIds, numberOfMatch, currentMmr);
  if (!datas) return;

  // Cache configuration states globally for high-res rendering
  lastFetchedDatas = datas;
  lastPlayerIds = playerIds;
  lastCurrentMmr = currentMmr;
  lastNumberOfMatch = numberOfMatch;

  if (myChart) {
    myChart.destroy(); // Destroy the previous chart if it exists
  }

  // Draw chart in preview mode (responsive)
  const config = buildChartConfig(datas, currentMmr, numberOfMatch, false);
  myChart = new Chart(ctx, config);
}

function somethingFun() {
  const container = el('zoomContainer');
  if (!container || container.children.length === 0) {
    const container = document.createElement('div');
    container.id = 'zoomContainer';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(container);

    const image = new Image();
    image.src = 'https://cdn.7tv.app/emote/659fe79c55fdc99dc17f4b87/4x.png';
    image.style.transition = 'transform 2s';
    image.style.width = '200px';

    image.addEventListener('mouseenter', () => {
      image.style.transform = 'scale(2)';
    });

    image.addEventListener('transitionend', () => {
      setTimeout(() => {
        image.style.transform = 'scale(1)';
      }, 2000);
      setTimeout(() => {
        container.removeChild(image);
        setTimeout(() => {
          document.body.removeChild(container);
        }, 2000);
      }, 2000);
    });
    container.appendChild(image);
  }
}

function onCompleteShowDotaBuff(playerIdsF) {
  const container = el('profileBtnContainer');
  container.innerHTML='';
  if (playerIdsF.length === 1 && playerIdsF[0] === 56939869) {
    somethingFun();
  }
  for (let i = 0; i < playerIdsF.length; i++) {
    const dotabuffIcon = document.createElement('a');
    dotabuffIcon.href = `https://www.dotabuff.com/players/${playerIdsF[i]}`;
    dotabuffIcon.target = "_blank";
    const img = document.createElement('img');
    img.alt = "Dotabuff Icon";
    img.src = "https://pbs.twimg.com/profile_images/879332626414358528/eHLyVWo-_400x400.jpg";
    dotabuffIcon.appendChild(img);
    container.appendChild(dotabuffIcon);
  }
  if (!selfCompare && numberOfId === 1) {
    el('instructions').style.display = 'block';
  } else {
    el('instructions').style.display = 'none';
  }
  el('showAfterCreated').classList.add('active');
}

async function takeScreenshot() {
  if (!lastFetchedDatas) {
    alert('Please create a graph first!');
    return;
  }
  
  const btn = el('screenshotBtn');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Rendering...';
  btn.disabled = true;

  try {
    // 1. Create a large offscreen canvas for a high resolution (1920x1080) snapshot
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1920;
    tempCanvas.height = 1080;
    tempCanvas.style.position = 'fixed';
    tempCanvas.style.left = '-9999px';
    document.body.appendChild(tempCanvas);

    const tempCtx = tempCanvas.getContext('2d');

    // 2. Draw a premium dark dashboard gradient background
    const bgGradient = tempCtx.createLinearGradient(0, 0, 1920, 1080);
    bgGradient.addColorStop(0, '#0b0a0f');
    bgGradient.addColorStop(0.5, '#121017');
    bgGradient.addColorStop(1, '#08070c');
    tempCtx.fillStyle = bgGradient;
    tempCtx.fillRect(0, 0, 1920, 1080);

    // Decorative radial glow effects matching the dark theme
    const crimsonGlow = tempCtx.createRadialGradient(200, 900, 50, 200, 900, 700);
    crimsonGlow.addColorStop(0, 'rgba(226, 43, 55, 0.15)');
    crimsonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    tempCtx.fillStyle = crimsonGlow;
    tempCtx.fillRect(0, 0, 1920, 1080);

    const goldGlow = tempCtx.createRadialGradient(1720, 180, 50, 1720, 180, 600);
    goldGlow.addColorStop(0, 'rgba(240, 139, 24, 0.1)');
    goldGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    tempCtx.fillStyle = goldGlow;
    tempCtx.fillRect(0, 0, 1920, 1080);

    // 3. Draw chart on the high-res canvas (with large text size scaling)
    const highResConfig = buildChartConfig(lastFetchedDatas, lastCurrentMmr, lastNumberOfMatch, true);
    
    // Disable responsiveness and animations for synchronous layout execution
    highResConfig.options.responsive = false;
    highResConfig.options.animation = {
      duration: 0
    };

    let tempChart = new Chart(tempCtx, highResConfig);

    // 4. Export PNG data URL
    const dataUrl = tempCanvas.toDataURL('image/png');

    // 5. Clean up temporary chart and DOM nodes
    tempChart.destroy();
    document.body.removeChild(tempCanvas);

    // 6. Write to clipboard
    const blob = await fetch(dataUrl).then(res => res.blob());
    const item = new ClipboardItem({'image/png': blob});
    await navigator.clipboard.write([item]);

    // Show visual confirmation on screen
    el('messages').style.display = 'block';
    setTimeout(() => {
      el('messages').style.display = 'none';
    }, 3000);
  } catch (error) {
    console.error('Failed to save screenshot to clipboard:', error);
    alert('Clipboard screenshot access failed. Ensure page permissions allow clipboard writes.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

function clickHandler(evt) {
  if (numberOfId === 1 && myChart !== undefined && !selfCompare) {
    const points = myChart.getElementsAtEventForMode(evt, 'nearest',
        {intersect: true}, true);
    if (points.length) {
      const firstPoint = points[0];
      const label = myChart.data.labels[firstPoint.index];
      const dotabuffUrl = `https://www.dotabuff.com/matches/${label}`;
      window.open(dotabuffUrl, '_blank');
    }
  }
}

function loadSavedPlayerIds() {
  const playerIdsF = JSON.parse(localStorage.getItem('playerIds')) || [];
  playerIdsF.forEach((playerId, index) => {
    const elementId = 'playerId' + (index + 1);
    const element = el(elementId);
    if (element) {
      element.value = playerId;
    }
  });
}

function onChangeNumberOfPlayer() {
  numberOfId = parseInt(el("numberOfPlayer").value);
  if (isNaN(numberOfId)) {
    el("numberOfPlayer").value = 1;
    onInPutNumberOfPlayer();
  }
}

function onInPutNumberOfPlayer() {
  numberOfId = parseInt(el("numberOfPlayer").value);
  if (numberOfId < 1) {
    el("numberOfPlayer").value = 1;
    numberOfId = 1;
  }
  if (numberOfId > 5) {
    el("numberOfPlayer").value = 5;
    numberOfId = 5;
  }

  const currentMmr = el('currentMmrWrapper');
  const playerIdContainer = el('inputs');
  const gameTypeWrapper = el('gameTypeWrapper');
  if (selfCompare === false) {
    playerIdContainer.innerHTML = '';
    for (let i = 1; i <= numberOfId; i++) {
      const playerInput = document.createElement('input');
      playerInput.type = 'number';
      playerInput.id = 'playerId' + i;
      playerInput.placeholder = 'Enter Player ' + i + ' ID';
      playerInput.min = '1';
      playerInput.className = "input-field";
      playerIdContainer.appendChild(playerInput);
    }

    if (numberOfId === 1) {
      currentMmr.style.display = 'block';
      gameTypeWrapper.style.display = 'none';
    } else {
      currentMmr.style.display = 'none';
      gameTypeWrapper.style.display = 'flex';
    }
  } else {
    currentMmr.style.display = 'none';
    if (numberOfId === 1) {
      gameTypeWrapper.style.display = 'none';
    } else {
      gameTypeWrapper.style.display = 'flex';
    }
  }
  loadSavedPlayerIds();
}

el('checkbox').addEventListener('change', () => {
  const currentMmr = el('currentMmrWrapper');
  const inputs = el('inputs');
  const gameTypeWrapper = el('gameTypeWrapper');
  if (el('checkbox').checked) {
    selfCompare = true;
    currentMmr.style.display = 'none';
    if (inputs.children.length > 1) {
      for (let i = inputs.children.length - 1; i > 0; i--) {
        inputs.removeChild(inputs.children[i]);
      }
    }
    if (numberOfId === 1) {
      gameTypeWrapper.style.display = 'none';
    } else {
      gameTypeWrapper.style.display = 'flex';
    }
  } else {
    selfCompare = false;
    currentMmr.style.display = 'block';
    numberOfId = 1;
    onInPutNumberOfPlayer();
  }
});

el('screenshotBtn').addEventListener('click', takeScreenshot);
el('createGraphBtn').addEventListener('click', createGraph);
el('numberOfPlayer').addEventListener('change', onChangeNumberOfPlayer);
el('numberOfPlayer').addEventListener('input', onInPutNumberOfPlayer);
el('dotaGraph').addEventListener('click', clickHandler);
window.addEventListener('load', loadSavedPlayerIds);

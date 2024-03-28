let numberOfId = 1;
let selfCompare = false;

async function fetchData(playerIdsF, numberOfMatch) {
  let userNumberOfMatch = numberOfMatch;

  if (selfCompare) {
    userNumberOfMatch = numberOfMatch * numberOfId;
  }

  let gameType = '&lobby_type=7';
  if (numberOfId > 1) {
    const selected = document.getElementById("gameType");
    if (selected.value === "7") {
      gameType = 'lobby_type=7';
    }
    if (selected.value === "1") {
      gameType = ''
    }
  }
  try {
    const allData = [];
    for (const playerId of playerIdsF) {
      const response = await fetch(
          `https://api.opendota.com/api/players/${playerId}/matches?limit=${userNumberOfMatch}&${gameType}`);
      if (!response.ok) {
        throw new Error(
            `Failed to fetch data for player ${playerId}! Try again later!`);
      }
      const data = await response.json();
      if (data.length === 0) {
        throw new Error(
            `ID ${playerId} does not exist or not public matches data!`);
      } else {
        numberOfMatch = data.length
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
          allData.push({playerId, data})
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

    document.getElementById('errors').textContent = "";
    localStorage.setItem("playerIds", JSON.stringify(playerIdsF));
    return allData;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    document.getElementById('errors').textContent = error.message;
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


async function createGraph() {
  const playerIds = [];
  document.getElementById("uploadedLink").innerHTML = '';
  document.getElementById("uploadedLink").href = '';
  document.getElementById("uploadToImgur").style.display = 'inline-block'
  document.getElementById("copyLink").style.display = 'none'
  const currentMmr = parseInt(document.getElementById('currentMmr').value);
  const numberOfMatch = parseInt(
      document.getElementById('numberOfMatch').value);
  for (let i = 1; i <= (selfCompare ? 1 : numberOfId); i++) {
    const playerId = parseInt(document.getElementById(`playerId${i}`).value);
    if (!isNaN(playerId) && playerId > 0) {
      playerIds.push(playerId);
    } else {
      document.getElementById('errors').textContent = `Player ${i} ID?`;
      return;
    }
  }
  if (isNaN(currentMmr) && numberOfId === 1 && !selfCompare || currentMmr <= 0
      && numberOfId === 1 && !selfCompare) {
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
  if (numberOfId <= 1 && !selfCompare) {
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
        - mmrData.slice().reverse().indexOf(Math.max(...mmrData));

    myChart = new Chart(ctx, {
      type: 'line', data: {
        labels: matchIdData, datasets: [{
          label: `MMR`,
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
            }, display: function (context) {
              return context.dataIndex === lowestMMRIndex || context.dataIndex
              === highestMMRIndex || context.dataIndex === numberOfMatch - 1
                  ? context.dataIndex : '';
            }
          }
        }]
      }, plugins: [ChartDataLabels], options: {
        layout: {
          padding: {
            right: 50,

          }
        }, responsive: false, scales: {
          x: {
            title: {
              display: true,
              text: `MMR PROGRESSION OVER ${data.length} MATCHES FOR ${playerIds[0]}`
            }, ticks: {
              maxTicksLimit: 12, callback: function (value, index) {
                return index + 1;
              }
            }
          }, y: {
            title: {
              display: true, text: 'MMR'
            }, min: Math.min(...mmrData) - 25, max: Math.max(...mmrData) + 25,
          }
        }, animation: {
          onComplete: function (chart) {
            if (chart.initial) {
              onCompleteShowDotaBuff(playerIds)
            }
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
    let max = 0, min = 0;
    for (let i = 0; i < numberOfId; i++) {
      const data = datas[i].data.reverse();
      const mmrData = [];
      mmrData.push(0)
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
        min = subMin
      }
      if (subMax > max) {
        max = subMax
      }
      datasetsArray.push({
        label: `${datas[i].playerId}`,
        data: mmrData,
        borderColor: getRandomColor(),
        fill: false,
        pointRadius: numberOfMatch < 251 ? 2 : 0,
        datalabels: {
          align: function (context) {
            if (context.dataIndex === minIndex) {
              return 'bottom';
            } else if (context.dataIndex === maxIndex) {
              return 'top';
            } else if (context.dataIndex === numberOfMatch - 1) {
              return 'right';
            } else {
              return null;
            }
          }, display: function (context) {
            return context.dataIndex === minIndex || context.dataIndex
            === maxIndex || context.dataIndex === numberOfMatch - 1
                ? context.dataIndex : '';
          }
        }
      });
    }

    myChart = new Chart(ctx, {
      type: 'line', data: {
        labels: Array.from({length: datasetsArray[0].data.length},
            (_, index) => index + 1), datasets: datasetsArray,
      }, plugins: [ChartDataLabels], options: {
        plugins: {
          tooltip: {
            mode: 'index', intersect: false, callbacks: {
              title: function () {
                return 'Score'
              }
            }
          }
        }, layout: {
          padding: {
            right: 50,
          }
        }, responsive: false, scales: {
          x: {
            title: {
              display: true,
              text: selfCompare
                  ? `SELF COMPARING SCORE ACROSS ${datasetsArray[0].data.length
                  * numberOfId} MATCHES IN ${numberOfId} PERIODS FOR ${playerIds[0]}`
                  : `COMPARE BETWEEN ${playerIds.length} PLAYERS OVER THE LAST ${datasetsArray[0].data.length} MATCHES`
            }, ticks: {
              maxTicksLimit: 12, callback: function (value, index) {
                return index + 1;
              }
            }
          }, y: {
            title: {
              display: true, text: 'GAME RECORDS'
            }, min: min - 1, max: max + 1
          }
        }, animation: {
          onComplete: function (chart) {
            if (chart.initial) {
              onCompleteShowDotaBuff(playerIds)
            }
          }
        }
      }
    });
  }
}

function somethingFun() {
  const container = document.getElementById('zoomContainer');
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
  const container = document.getElementById('profileBtnContainer');
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
    img.classList.add("dotabuff-icon");
    img.src = "https://pbs.twimg.com/profile_images/879332626414358528/eHLyVWo-_400x400.jpg";
    dotabuffIcon.appendChild(img);
    container.appendChild(dotabuffIcon);
  }
  if (!selfCompare && numberOfId === 1) {
    document.getElementById('instructions').style.display = 'block';
  } else {
    document.getElementById('instructions').style.display = 'none';
  }
  document.getElementById('showAfterCreated').style.display = 'block';
}

async function takeScreenshot() {
  try {
    const blob = await fetch(await createWhiteGraph()).then(res => res.blob());
    const item = new ClipboardItem({'image/png': blob});
    await navigator.clipboard.write([item]);
    document.getElementById('messages').style.display = 'block';
    setTimeout(() => {
      document.getElementById('messages').style.display = 'none';
    }, 3000);
  } catch (error) {
    console.error('Failed to save screenshot to clipboard:', error);
  }
}

async function uploadToImgur() {
  try {
    const formData = new FormData();
    const blob = await fetch(await createWhiteGraph()).then(res => res.blob());
    formData.append('image', blob);
    const clientId = 'da8378f7ca289d2';
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST', headers: {
        Authorization: 'Client-ID ' + clientId,
      }, body: formData
    });

    if (!response.ok) {
      throw new Error('Server error: ' + response.status);
    }
    const data = await response.json();
    if (data.success) {
      const link = data.data.link;
      console.log('Image uploaded successfully. Image link: ' + link);
      const uploadedLink = document.getElementById("uploadedLink");
      const copyButton = document.getElementById('copyLink')
      copyButton.style.display='inline-block';
      copyButton.addEventListener('click', function() {
        copyToClipboard(link);
      });
      uploadedLink.href = link;
      uploadedLink.innerHTML = `${link}`
      saveImageLink(link)

    } else {
      console.error('Upload failed: ' + data.data.error);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    document.getElementById("uploadToImgur").style.display='none';
  }
}

async function createWhiteGraph() {
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
  return newCanvas.toDataURL('image/png');
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

function saveImageLink(link) {
  let uploadedLinks = JSON.parse(localStorage.getItem('uploadedLinks')) || [];
  if (uploadedLinks.length > 10) {
    uploadedLinks.shift();
  }
  uploadedLinks.push(link)
  localStorage.setItem('uploadedLinks', JSON.stringify(uploadedLinks));
}

function clickHandler(evt) {
  if (numberOfId === 1 && myChart !== undefined && !selfCompare) {
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

function loadSavedPlayerIds() {
  const playerIdsF = JSON.parse(localStorage.getItem('playerIds')) || [];
  playerIdsF.forEach((playerId, index) => {
    const elementId = 'playerId' + (index + 1);
    const element = document.getElementById(elementId);
    if (element) {
      element.value = playerId;
    }
  });

}

function loadSavedPlayerLink() {
  const linksContainer = document.getElementById('savedLinkContainer');
  const links = JSON.parse(localStorage.getItem('uploadedLinks')) || [];
  links.reverse().forEach((link, index) => {
    const linkElement = document.createElement('a');
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.marginLeft='5px';
    copyButton.style.marginTop='5px';
    copyButton.addEventListener('click', function() {
      copyToClipboard(link);
    });
    linkElement.href = link;
    linkElement.textContent = `${index + 1}. ${link}`;
    linkElement.setAttribute('target', '_blank');
    linkElement.style.marginTop='5px';

    linksContainer.appendChild(linkElement);
    linksContainer.appendChild(copyButton)
    linksContainer.appendChild(document.createElement('br'));
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
  .then(() => {
    alert(`Link copied to clipboard: ${text}`);
  })
  .catch(err => {
    console.error('Failed to copy link: ', err);
  });
}
function onChangeNumberOfPlayer() {
  numberOfId = parseInt(document.getElementById("numberOfPlayer").value);
  if (isNaN(numberOfId)) {
    document.getElementById("numberOfPlayer").value = 1
    onInPutNumberOfPlayer();
  }

}

function onInPutNumberOfPlayer() {
  numberOfId = parseInt(document.getElementById("numberOfPlayer").value);
  if (numberOfId < 1) {
    document.getElementById("numberOfPlayer").value = 1
    numberOfId = 1
  }
  if (numberOfId > 5) {
    document.getElementById("numberOfPlayer").value = 5
    numberOfId = 5
  }

  const currentMmr = document.getElementById('currentMmr')
  const currentMmrText = document.getElementById('currentMmrText')
  const playerIdContainer = document.getElementById('inputs');
  const gameType = document.getElementById('gameType');
  if (selfCompare === false) {
    playerIdContainer.innerHTML = '';
    for (let i = 1; i <= numberOfId; i++) {
      const playerInput = document.createElement('input');
      playerInput.type = 'number';
      playerInput.id = 'playerId' + i;
      playerInput.placeholder = 'Enter Player ' + i + ' ID';
      playerInput.min = '1';
      playerInput.className = "inputField"
      playerIdContainer.appendChild(playerInput);
    }

    if (numberOfId === 1) {
      currentMmr.style.display = 'block';
      currentMmrText.style.display = 'block';
      gameType.style.display = 'none'
    } else {
      currentMmr.style.display = 'none';
      currentMmrText.style.display = 'none';
      gameType.style.display = 'block'
    }
  } else {
    currentMmr.style.display = 'none';
    currentMmrText.style.display = 'none';
  }
  loadSavedPlayerIds();
}

document.getElementById('checkbox').addEventListener('change', function () {
  const currentMmr = document.getElementById('currentMmr')
  const currentMmrText = document.getElementById('currentMmrText')
  const numberOfPlayerText = document.getElementById('numberOfPlayerText')
  const inputs = document.getElementById('inputs')
  if (this.checked) {
    selfCompare = true;
    currentMmr.style.display = 'none';
    currentMmrText.style.display = 'none';
    numberOfPlayerText.textContent = "Number of Graph:"
    if (inputs.children.length > 1) {
      for (let i = inputs.children.length - 1; i > 0; i--) {
        inputs.removeChild(inputs.children[i]);
      }
    }
  } else {
    selfCompare = false;
    currentMmr.style.display = 'block';
    currentMmrText.style.display = 'block';
    numberOfPlayerText.textContent = "Number of Player:"
    numberOfId = 1;
    onInPutNumberOfPlayer()
  }
});

document.getElementById('screenshotBtn').addEventListener('click',
    takeScreenshot);
document.getElementById('uploadToImgur').addEventListener('click',
    uploadToImgur);
window.addEventListener('load', loadSavedPlayerIds);
window.addEventListener('load', loadSavedPlayerLink);







// Graph structure for visualization (matches backend)
const graph = {
  A: {B: 1, C: 4, E: 2},
  B: {A: 1, C: 2, D: 5},
  C: {A: 4, B: 2, D: 1, F: 3},
  D: {B: 5, C: 1, F: 2, G: 1},
  E: {A: 2, F: 2, H: 4},
  F: {C: 3, D: 2, E: 2, I: 3},
  G: {D: 1, J: 5},
  H: {E: 4, I: 1},
  I: {F: 3, H: 1, J: 2},
  J: {G: 5, I: 2}
};

// Node positions for visualization
const nodePositions = {
  A: {x: 100, y: 100},
  B: {x: 250, y: 80},
  C: {x: 250, y: 200},
  D: {x: 400, y: 200},
  E: {x: 100, y: 300},
  F: {x: 250, y: 350},
  G: {x: 550, y: 150},
  H: {x: 250, y: 450},
  I: {x: 450, y: 400},
  J: {x: 650, y: 300}
};

// DOM elements
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const findBtn = document.getElementById('findBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const resultSection = document.getElementById('resultSection');
const statusIndicator = document.getElementById('statusIndicator');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');

// API Configuration (FIXED)
const API_URL = window.location.origin;
let serverOnline = false;

// Check server status
async function checkServerStatus() {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (response.ok) {
      serverOnline = true;
      statusIndicator.className = 'status-indicator status-online';
      statusIndicator.innerHTML =
        '<div class="status-dot"></div><span>Server Online</span>';
    } else {
      throw new Error();
    }
  } catch {
    serverOnline = false;
    statusIndicator.className = 'status-indicator status-offline';
    statusIndicator.innerHTML =
      '<div class="status-dot"></div><span>Backend Unreachable</span>';
  }
}
// Call Python backend API to get paths
async function getPathsFromBackend(start, end) {
  try {
    const response = await fetch(`${API_URL}/get_paths`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ start, end })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Backend error:', error);
    throw error;
  }
}

// Draw the graph on canvas
function drawGraph(shortestPath = [], secondPath = []) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw edges first
  for (let node in graph) {
    for (let neighbor in graph[node]) {
      if (node < neighbor) { // Draw each edge only once
        const isInShortest = isEdgeInPath(node, neighbor, shortestPath);
        const isInSecond = isEdgeInPath(node, neighbor, secondPath);
        drawEdge(node, neighbor, graph[node][neighbor], isInShortest, isInSecond);
      }
    }
  }

  // Draw nodes on top
  for (let node in nodePositions) {
    const isInShortest = shortestPath.includes(node);
    const isInSecond = secondPath.includes(node);
    drawNode(node, isInShortest, isInSecond);
  }
}

// Check if an edge is part of a path
function isEdgeInPath(node1, node2, path) {
  for (let i = 0; i < path.length - 1; i++) {
    if ((path[i] === node1 && path[i + 1] === node2) ||
        (path[i] === node2 && path[i + 1] === node1)) {
      return true;
    }
  }
  return false;
}

// Draw an edge between two nodes
function drawEdge(from, to, weight, isInShortest, isInSecond) {
  const fromPos = nodePositions[from];
  const toPos = nodePositions[to];

  ctx.beginPath();
  ctx.moveTo(fromPos.x, fromPos.y);
  ctx.lineTo(toPos.x, toPos.y);
  
  // Set edge style based on path membership
  if (isInShortest) {
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 5;
  } else if (isInSecond) {
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 5;
  } else {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
  }
  
  ctx.stroke();

  // Draw weight label
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;
  
  ctx.fillStyle = 'white';
  ctx.fillRect(midX - 12, midY - 12, 24, 24);
  
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(weight, midX, midY);
}

// Draw a node
function drawNode(node, isInShortest, isInSecond) {
  const pos = nodePositions[node];
  
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
  
  // Set node color based on path membership
  if (isInShortest) {
    ctx.fillStyle = '#2196F3';
  } else if (isInSecond) {
    ctx.fillStyle = '#f44336';
  } else {
    ctx.fillStyle = '#667eea';
  }
  
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw node label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node, pos.x, pos.y);
}

// Display results in the UI
function displayResults(shortest, second) {
  if (shortest.path.length === 0 || shortest.cost === -1) {
    resultSection.innerHTML = '<div class="error">❌ No path found between the selected nodes!</div>';
    return;
  }

  let html = '<div class="result-section">';
  
  // Shortest path
  html += `
    <div class="result-item">
      <div class="path-indicator shortest"></div>
      <div class="result-text">
        <strong>Shortest Path:</strong> ${shortest.path.join(' → ')}
      </div>
      <div class="cost">Cost: ${shortest.cost}</div>
    </div>
  `;

  // Second shortest path
  if (second.path.length > 0 && second.cost !== -1) {
    html += `
      <div class="result-item">
        <div class="path-indicator second"></div>
        <div class="result-text">
          <strong>Second Shortest Path:</strong> ${second.path.join(' → ')}
        </div>
        <div class="cost">Cost: ${second.cost}</div>
      </div>
    `;
  } else {
    html += `
      <div class="result-item">
        <div class="path-indicator second"></div>
        <div class="result-text">
          <strong>Second Shortest Path:</strong> Not found
        </div>
      </div>
    `;
  }

  html += '</div>';
  resultSection.innerHTML = html;
}

// Show loading state
function setLoading(loading) {
  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    findBtn.disabled = true;
  } else {
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
    findBtn.disabled = false;
  }
}

// Handle find paths button click
async function handleFindPaths() {
  const start = startInput.value.toUpperCase();
  const end = endInput.value.toUpperCase();

  // Validate input
  if (!start || !end) {
    resultSection.innerHTML = '<div class="error"> Please enter both start and end nodes!</div>';
    return;
  }

  if (!graph[start]) {
    resultSection.innerHTML = `<div class="error"> Invalid start node '${start}'! Use nodes A-J.</div>`;
    return;
  }

  if (!graph[end]) {
    resultSection.innerHTML = `<div class="error"> Invalid end node '${end}'! Use nodes A-J.</div>`;
    return;
  }

  // Check server status first
  if (!serverOnline) {
    resultSection.innerHTML = '<div class="error"> Server is offline! Please start the Python backend server first.<br><small>Run: python server.py</small></div>';
    return;
  }

  setLoading(true);

  try {
    // Call Python backend
    const data = await getPathsFromBackend(start, end);
    
    // Draw graph with paths
    drawGraph(data.shortest.path, data.second.path);
    
    // Display results
    displayResults(data.shortest, data.second);
    
  } catch (error) {
    resultSection.innerHTML = `<div class="error"> Error: ${error.message}<br><small>Make sure the Python server is running on port 8000</small></div>`;
    drawGraph(); // Draw empty graph
  } finally {
    setLoading(false);
  }
}

// Event listeners
findBtn.addEventListener('click', handleFindPaths);

// Allow Enter key to trigger search
startInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFindPaths();
});

endInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleFindPaths();
});

// Initialize
checkServerStatus();
setInterval(checkServerStatus, 5000); // Check server status every 5 seconds

drawGraph(); // Draw initial empty graph

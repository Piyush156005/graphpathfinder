from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import heapq
import os
from typing import Dict, List, Tuple

app = FastAPI(title="Graph Path Finder API")

# Allow CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Graph definition
graph = {
    'A': {'B': 1, 'C': 4, 'E': 2},
    'B': {'A': 1, 'C': 2, 'D': 5},
    'C': {'A': 4, 'B': 2, 'D': 1, 'F': 3},
    'D': {'B': 5, 'C': 1, 'F': 2, 'G': 1},
    'E': {'A': 2, 'F': 2, 'H': 4},
    'F': {'C': 3, 'D': 2, 'E': 2, 'I': 3},
    'G': {'D': 1, 'J': 5},
    'H': {'E': 4, 'I': 1},
    'I': {'F': 3, 'H': 1, 'J': 2},
    'J': {'G': 5, 'I': 2}
}

# Request model
class PathRequest(BaseModel):
    start: str
    end: str

# Response models
class PathResponse(BaseModel):
    cost: float
    path: List[str]

class PathsResponse(BaseModel):
    shortest: PathResponse
    second: PathResponse

def dijkstra(graph_copy: Dict, start: str, end: str) -> Tuple[float, List[str]]:
    """
    Dijkstra's algorithm implementation
    Returns: (cost, path) tuple
    """
    # Priority queue: (cost, current_node, path)
    heap = [(0, start, [start])]
    visited = set()
    
    while heap:
        cost, node, path = heapq.heappop(heap)
        
        # If we reached the destination
        if node == end:
            return cost, path
        
        # Skip if already visited
        if node in visited:
            continue
        
        visited.add(node)
        
        # Explore neighbors
        if node in graph_copy:
            for neighbor, weight in graph_copy[node].items():
                if neighbor not in visited:
                    new_cost = cost + weight
                    new_path = path + [neighbor]
                    heapq.heappush(heap, (new_cost, neighbor, new_path))
    
    # No path found
    return float('inf'), []

def find_second_shortest_path(start: str, end: str) -> Tuple[float, List[str]]:
    """
    Find second shortest path by removing edges from shortest path
    """
    # Find the shortest path first
    shortest_cost, shortest_path = dijkstra(graph, start, end)
    
    if not shortest_path:
        return float('inf'), []
    
    second_best_cost = float('inf')
    second_best_path = []
    
    # Try removing each edge from the shortest path
    for i in range(len(shortest_path) - 1):
        u = shortest_path[i]
        v = shortest_path[i + 1]
        
        # Create a copy of the graph and remove the edge
        graph_copy = {node: neighbors.copy() for node, neighbors in graph.items()}
        
        if u in graph_copy and v in graph_copy[u]:
            del graph_copy[u][v]
        if v in graph_copy and u in graph_copy[v]:
            del graph_copy[v][u]
        
        # Find shortest path in modified graph
        cost, path = dijkstra(graph_copy, start, end)
        
        # Update second best if this is better than current second best
        # but different from the shortest path
        if cost < second_best_cost and path != shortest_path:
            second_best_cost = cost
            second_best_path = path
    
    return second_best_cost, second_best_path

@app.get("/")
async def root():
    """Serve the main HTML file"""
    return FileResponse("index.html")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Server is running"}

@app.post("/get_paths", response_model=PathsResponse)
async def get_paths(request: PathRequest):
    """
    Get shortest and second shortest paths between two nodes
    """
    start = request.start.upper()
    end = request.end.upper()
    
    # Validate nodes
    if start not in graph:
        raise HTTPException(status_code=400, detail=f"Start node '{start}' not found in graph")
    if end not in graph:
        raise HTTPException(status_code=400, detail=f"End node '{end}' not found in graph")
    
    # Find shortest path
    shortest_cost, shortest_path = dijkstra(graph, start, end)
    
    # Find second shortest path
    second_cost, second_path = find_second_shortest_path(start, end)
    
    return PathsResponse(
        shortest=PathResponse(
            cost=shortest_cost if shortest_cost != float('inf') else -1,
            path=shortest_path
        ),
        second=PathResponse(
            cost=second_cost if second_cost != float('inf') else -1,
            path=second_path
        )
    )

@app.get("/graph")
async def get_graph():
    """Get the graph structure"""
    return {"graph": graph}
    
@app.get("/style.css")
async def get_css():
    return FileResponse("style.css")

@app.get("/script.js")
async def get_js():
    return FileResponse("script.js")
    
# Mount static files (CSS, JS)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))

    uvicorn.run(app, host="0.0.0.0", port=port)
